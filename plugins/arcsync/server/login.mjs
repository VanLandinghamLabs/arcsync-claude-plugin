import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
//#region src/login.ts
var LOGIN_TIMEOUT_MS = 6e5;
var MAX_BODY_BYTES = 4096;
var CLIENT_ID = /^arc_[A-Za-z0-9_-]{8,200}$/;
var CLIENT_SECRET = /^arcsec_[A-Za-z0-9_-]{16,200}$/;
var PAGE_HEADERS = {
	"content-security-policy": "default-src 'none'",
	"cache-control": "no-store",
	"referrer-policy": "no-referrer",
	connection: "close"
};
var connectLabel = (hostname) => `arcsync-mcp on ${hostname}`.slice(0, 60).trim();
function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > MAX_BODY_BYTES) {
				resolve(null);
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}
var sameSecret = (a, b) => {
	const x = Buffer.from(a);
	const y = Buffer.from(b);
	return x.length === y.length && timingSafeEqual(x, y);
};
/**
* Listen on 127.0.0.1 for the one credential the ArcSync connect page hands
* back. Only a form POST addressed to this exact host and port, carrying this
* listener's `state`, is accepted; it is accepted once, and the listener
* closes after it or after `timeoutMs`.
*
* `state` is what stops a forged callback. Chromium sends `Origin: null` on
* this https-to-loopback navigation, so the origin check can only refuse a
* request that names some other site.
*/
function startLoopbackLogin(opts) {
	const timeoutMs = opts.timeoutMs ?? 6e5;
	const state = randomBytes(32).toString("base64url");
	const appOrigin = new URL(opts.appUrl).origin;
	let settle;
	const credential = new Promise((resolve, reject) => {
		settle = {
			resolve,
			reject
		};
	});
	credential.catch(() => {});
	const server = createServer();
	let done = false;
	const finish = (err, cred) => {
		if (done) return;
		done = true;
		clearTimeout(timer);
		server.close();
		if (err) settle.reject(err);
		else settle.resolve(cred);
	};
	const timer = setTimeout(() => finish(/* @__PURE__ */ new Error("The ArcSync connect link expired before it was used.")), timeoutMs);
	timer.unref();
	const refuse = (res, status, text) => {
		res.writeHead(status, {
			...PAGE_HEADERS,
			"content-type": "text/plain; charset=utf-8"
		});
		res.end(`${text}\n`);
	};
	const handle = async (req, res, port) => {
		if (done) return refuse(res, 410, "This connect link has already been used or has expired.");
		if (req.method !== "POST" || req.url !== "/callback") return refuse(res, 404, "Not found.");
		if (req.headers.host !== `127.0.0.1:${port}`) return refuse(res, 400, "Unexpected host.");
		const { origin } = req.headers;
		if (origin !== void 0 && origin !== "null" && origin !== appOrigin) return refuse(res, 403, "Unexpected origin.");
		if (!req.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) return refuse(res, 415, "Unexpected content type.");
		const body = await readBody(req);
		if (body === null) return refuse(res, 413, "Request too large.");
		const form = new URLSearchParams(body);
		if (!sameSecret(form.get("state") ?? "", state)) return refuse(res, 403, "State mismatch.");
		const clientId = form.get("clientId") ?? "";
		const clientSecret = form.get("secret") ?? "";
		if (!CLIENT_ID.test(clientId) || !CLIENT_SECRET.test(clientSecret)) return refuse(res, 400, "Malformed credential.");
		res.writeHead(200, {
			...PAGE_HEADERS,
			"content-type": "text/html; charset=utf-8"
		});
		res.end("<!doctype html><title>ArcSync connected</title><h1>Connected</h1><p>arcsync-mcp is connected to ArcSync. You can close this tab and return to your coding agent.</p>");
		finish(null, {
			clientId,
			clientSecret
		});
	};
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address();
			if (opts.holdProcess === false) server.unref();
			server.on("request", (req, res) => {
				handle(req, res, port).catch(() => refuse(res, 400, "Bad request."));
			});
			const params = new URLSearchParams({
				port: String(port),
				state,
				label: opts.label,
				exp: String(Math.floor((Date.now() + timeoutMs) / 1e3))
			});
			resolve({
				url: `${opts.appUrl}/settings/mcp/connect?${params}`,
				credential,
				close: () => finish(/* @__PURE__ */ new Error("The ArcSync connect listener was closed."))
			});
		});
	});
}
//#endregion
export { LOGIN_TIMEOUT_MS, connectLabel, startLoopbackLogin };
