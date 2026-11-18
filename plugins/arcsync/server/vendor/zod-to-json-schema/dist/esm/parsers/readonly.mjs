import { parseDef } from "../parseDef.mjs";
// ../../node_modules/.pnpm/zod-to-json-schema@3.25.2_zod@4.6.7/node_modules/zod-to-json-schema/dist/esm/parsers/readonly.js
var parseReadonlyDef = (def, refs) => {
	return parseDef(def.innerType._def, refs);
};
export { parseReadonlyDef };
