//#region src/config.ts
var DEFAULT_API_URL = "https://api.arcsync.dev";
var DEFAULT_APP_URL = "https://arcsync.dev";
var trimSlash = (url) => url.replace(/\/+$/, "");
/** Only https, except for a loopback host during local development: the
* client secret travels in the token-exchange body. */
function checkedUrl(name, raw) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new Error(`${name} is not a valid URL: ${raw}`);
	}
	const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
	if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) throw new Error(`${name} must be an https URL`);
	return trimSlash(url.toString());
}
function readSettings(env) {
	const orgId = env.ARCSYNC_ORG?.trim();
	return {
		apiUrl: checkedUrl("ARCSYNC_API_URL", env.ARCSYNC_API_URL?.trim() || DEFAULT_API_URL),
		appUrl: checkedUrl("ARCSYNC_APP_URL", env.ARCSYNC_APP_URL?.trim() || DEFAULT_APP_URL),
		...orgId ? { orgId } : {}
	};
}
/** The credential from the environment, or null when neither variable is set
* (the server then falls back to a stored one, or the browser connect link). */
function envCredential(env) {
	const clientId = env.ARCSYNC_CLIENT_ID?.trim() ?? "";
	const clientSecret = env.ARCSYNC_CLIENT_SECRET?.trim() ?? "";
	if (!clientId && !clientSecret) return null;
	if (!clientId || !clientSecret) throw new Error(`Missing ${clientId ? "ARCSYNC_CLIENT_SECRET" : "ARCSYNC_CLIENT_ID"}. Set both, or neither to connect through the browser.`);
	return {
		clientId,
		clientSecret
	};
}
//#endregion
export { envCredential, readSettings };
