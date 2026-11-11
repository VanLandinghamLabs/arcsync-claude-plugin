import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
//#region src/credentialStore.ts
function credentialPath(env, platform, home) {
	const base = env.XDG_CONFIG_HOME?.trim() || platform === "win32" && env.APPDATA?.trim() || join(home, ".config");
	return join(base, "arcsync", "mcp-credential.json");
}
/**
* A 0600 file holding one credential and the API it was minted for; a file
* written against another API (staging, local dev) reads as empty.
*/
function makeFileCredentialStore(path, apiUrl) {
	return {
		path,
		async read() {
			let raw;
			try {
				raw = await readFile(path, "utf8");
			} catch (err) {
				if (err.code === "ENOENT") return null;
				throw err;
			}
			let parsed;
			try {
				parsed = JSON.parse(raw);
			} catch {
				return null;
			}
			const p = parsed ?? {};
			if (p.apiUrl !== apiUrl) return null;
			if (typeof p.clientId !== "string" || typeof p.clientSecret !== "string") return null;
			if (!p.clientId || !p.clientSecret) return null;
			return {
				clientId: p.clientId,
				clientSecret: p.clientSecret
			};
		},
		async write({ clientId, clientSecret }) {
			await mkdir(dirname(path), {
				recursive: true,
				mode: 448
			});
			const tmp = `${path}.${randomBytes(6).toString("hex")}.tmp`;
			const body = JSON.stringify({
				apiUrl,
				clientId,
				clientSecret
			}, null, 2);
			await writeFile(tmp, `${body}\n`, { mode: 384 });
			await rename(tmp, path);
		},
		async clear() {
			await rm(path, { force: true });
		}
	};
}
//#endregion
export { credentialPath, makeFileCredentialStore };
