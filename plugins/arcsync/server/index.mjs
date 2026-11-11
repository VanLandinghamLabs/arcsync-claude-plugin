import { StdioServerTransport } from "./vendor/@modelcontextprotocol/sdk/dist/esm/server/stdio.mjs";
import { buildServerApi, runCommand } from "./cli.mjs";
import { createServer } from "./server.mjs";
import { spawn } from "node:child_process";
import { homedir, hostname } from "node:os";
//#region src/index.ts
var deps = {
	env: process.env,
	platform: process.platform,
	home: homedir(),
	hostname: hostname(),
	fetch: (url, init) => fetch(url, init),
	now: Date.now,
	spawn,
	log: (message) => console.error(message)
};
try {
	const code = await runCommand(process.argv[2], deps);
	if (code !== null) process.exit(code);
	const { api, settings } = buildServerApi(deps);
	await createServer({
		api,
		appUrl: settings.appUrl
	}).connect(new StdioServerTransport());
} catch (err) {
	console.error(`arcsync-mcp: ${err instanceof Error ? err.message : String(err)}`);
	process.exit(1);
}
//#endregion
