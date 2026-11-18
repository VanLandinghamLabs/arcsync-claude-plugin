import { parseAnyDef } from "./any.mjs";
// ../../node_modules/.pnpm/zod-to-json-schema@3.25.2_zod@4.6.7/node_modules/zod-to-json-schema/dist/esm/parsers/undefined.js
function parseUndefinedDef(refs) {
	return { not: parseAnyDef(refs) };
}
export { parseUndefinedDef };
