//#region ../core/dist/quotaErrorCodes.js
/**
* Every `errorCode` a quota refusal (429 with tier/limit/used/resetAt) carries.
* Other 429s (PAT pastes, invites, share-link reads) are rate limits, not
* quotas, and must not open the SPA's quota wall.
*
* Kept apart from `quotaLimits` so the SPA's eager api chunk can import the
* guard without pulling in the tier-limit tables.
*/
var QUOTA_ERROR_CODES = [
	"QUOTA_EXCEEDED",
	"RATE_LIMITED",
	"DIAGRAM_LIMIT",
	"COST_FREEZE",
	"REPARSE_LIMIT",
	"SYNTH_QUOTA_EXCEEDED",
	"SYNTH_PLAN_REQUIRED"
];
var isQuotaErrorCode = (value) => QUOTA_ERROR_CODES.includes(value);
//#endregion
export { QUOTA_ERROR_CODES, isQuotaErrorCode };
