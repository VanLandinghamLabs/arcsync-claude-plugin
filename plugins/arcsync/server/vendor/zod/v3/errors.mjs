import errorMap from "./locales/en.mjs";
// ../../node_modules/.pnpm/zod@4.6.7/node_modules/zod/v3/errors.js
var overrideErrorMap = errorMap;
function getErrorMap() {
	return overrideErrorMap;
}
export { errorMap as defaultErrorMap, getErrorMap };
