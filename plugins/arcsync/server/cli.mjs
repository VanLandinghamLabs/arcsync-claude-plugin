import { makeApiClient } from "./api.mjs";
import { envCredential, readSettings } from "./config.mjs";
import { credentialPath, makeFileCredentialStore } from "./credentialStore.mjs";
import { connectLabel, startLoopbackLogin } from "./login.mjs";
import { makeSessionClient } from "./session.mjs";
//#region src/cli.ts
/** Best effort: a headless box has no browser, and the URL is printed anyway. */
function openBrowser(spawn, platform, url) {
	const [command, args] = platform === "darwin" ? ["open", [url]] : platform === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]] : ["xdg-open", [url]];
	try {
		const child = spawn(command, args, {
			detached: true,
			stdio: "ignore"
		});
		child.on("error", () => {});
		child.unref();
	} catch {}
}
function setup(deps, holdProcess) {
	const settings = readSettings(deps.env);
	const store = makeFileCredentialStore(credentialPath(deps.env, deps.platform, deps.home), settings.apiUrl);
	const startLogin = () => (deps.startLogin ?? startLoopbackLogin)({
		appUrl: settings.appUrl,
		label: connectLabel(deps.hostname),
		holdProcess
	});
	return {
		settings,
		store,
		startLogin
	};
}
function buildServerApi(deps) {
	const { settings, store, startLogin } = setup(deps, false);
	return {
		api: makeSessionClient({
			envCredential: envCredential(deps.env),
			store,
			startLogin,
			makeClient: (credential) => makeApiClient({
				...settings,
				...credential
			}, deps.fetch, deps.now),
			warn: (message) => deps.log(`arcsync-mcp: ${message}`)
		}),
		settings
	};
}
async function login(deps, store, start) {
	const pending = await start();
	deps.log(`Open this link to connect arcsync-mcp to ArcSync:\n\n  ${pending.url}\n`);
	openBrowser(deps.spawn, deps.platform, pending.url);
	const credential = await pending.credential;
	await store.write(credential);
	deps.log(`Connected. Saved the credential to ${store.path}.`);
}
/** `login` / `logout`; null for anything else, which runs the MCP server. */
async function runCommand(command, deps) {
	if (command !== "login" && command !== "logout") return null;
	const { settings, store, startLogin } = setup(deps, true);
	if (command === "logout") {
		await store.clear();
		deps.log(`Removed ${store.path}. Revoke the credential itself at ${settings.appUrl}/settings.`);
		return 0;
	}
	await login(deps, store, startLogin);
	return 0;
}
//#endregion
export { buildServerApi, openBrowser, runCommand };
