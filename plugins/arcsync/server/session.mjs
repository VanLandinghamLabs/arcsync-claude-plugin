import { ApiError, CredentialRejectedError } from "./api.mjs";
//#region src/session.ts
var reason = (err) => err instanceof Error ? err.message : String(err);
/**
* An ApiClient that finds its credential lazily: the environment, then the
* stored file, then a browser connect link returned as the tool error, which
* the agent relays to the user. A credential arriving through that link is
* used from the next call on, with no restart.
*/
function makeSessionClient(deps) {
	let client = null;
	let clientId = "";
	let fromStore = false;
	let pending = null;
	const use = (credential, stored) => {
		client = deps.makeClient(credential);
		clientId = credential.clientId;
		fromStore = stored;
		return client;
	};
	const onLinked = async (credential) => {
		use(credential, true);
		await deps.store.write(credential).catch((err) => {
			deps.warn(`connected, but could not save the credential to ${deps.store.path} (${reason(err)}); it lasts until this server exits`);
		});
	};
	function startOnce() {
		if (pending) return pending;
		const p = deps.startLogin().then((started) => {
			started.credential.then(onLinked).catch(() => {}).finally(() => {
				if (pending === p) pending = null;
			});
			return started;
		});
		p.catch(() => {
			if (pending === p) pending = null;
		});
		pending = p;
		return p;
	}
	async function connectPrompt() {
		const { url } = await startOnce();
		return `ArcSync is not connected. Ask the user to open this link and click Connect, then call this tool again: ${url}\nThe link works once and expires in 10 minutes.`;
	}
	async function current() {
		if (client) return client;
		if (deps.envCredential) return use(deps.envCredential, false);
		const stored = await deps.store.read();
		if (stored) return use(stored, true);
		throw new ApiError(401, await connectPrompt());
	}
	let recovery = null;
	/** Another arcsync-mcp process (or `login`) may have saved a newer
	* credential; only delete the file if it still holds the rejected one. */
	async function replacement(rejected) {
		const stored = await deps.store.read().catch(() => null);
		if (stored && stored.clientId !== rejected) return use(stored, true);
		await deps.store.clear().catch((err) => {
			deps.warn(`could not delete the rejected credential at ${deps.store.path} (${reason(err)})`);
		});
		return null;
	}
	async function call(fn, retried = false) {
		const c = await current();
		try {
			return await fn(c);
		} catch (err) {
			if (!(err instanceof CredentialRejectedError)) throw err;
			if (client === c) {
				if (!fromStore) throw err;
				client = null;
				recovery = replacement(clientId);
			}
			if ((client ?? await recovery) && !retried) return call(fn, true);
			throw new ApiError(401, `ArcSync rejected the saved credential; it was probably revoked. ${await connectPrompt()}`);
		}
	}
	return {
		get: (path) => call((c) => c.get(path)),
		post: (path, body) => call((c) => c.post(path, body))
	};
}
//#endregion
export { makeSessionClient };
