import { isQuotaErrorCode } from "./core/quotaErrorCodes.mjs";
//#region src/api.ts
var ApiError = class extends Error {
	status;
	body;
	constructor(status, message, body) {
		super(message);
		this.status = status;
		this.body = body;
		this.name = "ApiError";
	}
};
/** The token exchange refused the client ID and secret themselves. */
var CredentialRejectedError = class extends ApiError {
	constructor(message) {
		super(401, message);
		this.name = "CredentialRejectedError";
	}
};
/** Refresh this long before `exp`, so a request never leaves with a token that
* expires in flight. */
var EXPIRY_SKEW_MS = 6e4;
var FALLBACK_TTL_MS = 3e5;
function expiryOf(token, nowMs) {
	try {
		const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
		if (typeof payload.exp === "number") return payload.exp * 1e3;
	} catch {}
	return nowMs + FALLBACK_TTL_MS;
}
async function readBody(res) {
	const text = await res.text();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
var QUOTA_ADVICE = {
	RATE_LIMITED: "the workspace's hourly parse limit is reached; retry after the reset time",
	QUOTA_EXCEEDED: "the workspace's monthly parse quota is used up; do not retry before the reset",
	SYNTH_QUOTA_EXCEEDED: "the workspace's monthly CDK/Pulumi synth quota is used up; do not retry before the reset",
	SYNTH_PLAN_REQUIRED: "server-side CDK and Pulumi builds are temporarily limited to paid plans; do not retry on this plan",
	DIAGRAM_LIMIT: "the workspace stores as many diagrams as its plan allows; reuse an existing diagram",
	REPARSE_LIMIT: "this repository failed to parse several times in a row; fix the failure before parsing it again",
	COST_FREEZE: "parsing is frozen for this workspace; do not retry, and ask the workspace owner to contact ArcSync support"
};
/** A quota refusal, spelled out for an agent from its machine fields. */
function quotaText(b) {
	if (typeof b.errorCode !== "string") return void 0;
	const parts = [`${b.errorCode}: ${QUOTA_ADVICE[b.errorCode] ?? "a usage limit was reached"}.`];
	if (typeof b.used === "number" && typeof b.limit === "number") parts.push(`Used ${b.used} of ${b.limit}${typeof b.tier === "string" ? ` on the ${b.tier} plan` : ""}.`);
	const frozen = b.errorCode === "COST_FREEZE";
	if (typeof b.resetAt === "string" && b.resetAt) parts.push(frozen ? `It resumes when the first payment clears, after the trial ends at ${b.resetAt}.` : `Resets at ${b.resetAt}.`);
	if (b.manageBilling === true) parts.push("The workspace's subscription has a payment outstanding; the owner manages it at https://arcsync.dev/account/billing");
	else if ((!frozen || b.tier === "free") && typeof b.upgradeUrl === "string" && b.upgradeUrl) parts.push(`Upgrade: ${b.upgradeUrl}`);
	return parts.join(" ");
}
function errorText(body) {
	if (typeof body === "string") return body.slice(0, 300);
	if (body && typeof body === "object") {
		const b = body;
		if (isQuotaErrorCode(b.errorCode)) return quotaText(b);
		if (typeof b.error === "string") return b.error;
		if (typeof b.message === "string") return b.message;
		return quotaText(b);
	}
}
/** API Gateway's own refusal (the authorizer said no) is `{"message":"Forbidden"}`;
* a handler's 403 carries `error`. Only the former means the credential itself
* cannot reach the route. */
var isGatewayRefusal = (status, body) => (status === 401 || status === 403) && !!body && typeof body === "object" && "message" in body && !("error" in body);
function makeApiClient(config, fetchImpl, now) {
	let cached = null;
	let pending = null;
	async function exchange() {
		const res = await fetchImpl(`${config.apiUrl}/action/token`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				clientId: config.clientId,
				clientSecret: config.clientSecret
			})
		});
		const body = await readBody(res);
		if (res.status === 401) throw new CredentialRejectedError("ArcSync rejected ARCSYNC_CLIENT_ID / ARCSYNC_CLIENT_SECRET. The credential may have been revoked; create a new MCP credential at https://arcsync.dev/settings.");
		if (!res.ok) throw new ApiError(res.status, `ArcSync token exchange failed (${res.status}): ${errorText(body) ?? "no detail"}`);
		const token = body?.accessToken;
		if (typeof token !== "string" || token.length === 0) throw new ApiError(502, "ArcSync token exchange returned no accessToken");
		cached = {
			token,
			expiresAt: expiryOf(token, now())
		};
		return token;
	}
	function token(forceRefresh) {
		if (!forceRefresh && cached && cached.expiresAt - EXPIRY_SKEW_MS > now()) return Promise.resolve(cached.token);
		pending ??= exchange().finally(() => {
			pending = null;
		});
		return pending;
	}
	async function request(method, path, body) {
		const send = async (forceRefresh) => fetchImpl(`${config.apiUrl}${path}`, {
			method,
			headers: {
				authorization: `Bearer ${await token(forceRefresh)}`,
				accept: "application/json",
				...body === void 0 ? {} : { "content-type": "application/json" },
				...config.orgId ? { "x-arcsync-org": config.orgId } : {}
			},
			...body === void 0 ? {} : { body: JSON.stringify(body) }
		});
		let res = await send(false);
		let parsed = await readBody(res);
		if (isGatewayRefusal(res.status, parsed)) {
			res = await send(true);
			parsed = await readBody(res);
		}
		if (res.ok) return parsed;
		if (isGatewayRefusal(res.status, parsed)) throw new ApiError(res.status, "ArcSync refused this credential for this request. Check that it was created as an MCP credential (not a GitHub Action one) at https://arcsync.dev/settings.");
		throw new ApiError(res.status, errorText(parsed) ?? `ArcSync API error ${res.status}`, parsed);
	}
	return {
		get: (path) => request("GET", path),
		post: (path, body) => request("POST", path, body)
	};
}
//#endregion
export { ApiError, CredentialRejectedError, makeApiClient };
