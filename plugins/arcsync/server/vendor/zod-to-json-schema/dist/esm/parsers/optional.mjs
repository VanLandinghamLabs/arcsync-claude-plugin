import { parseAnyDef } from "./any.mjs";
import { parseDef } from "../parseDef.mjs";
//#region ../../node_modules/.pnpm/zod-to-json-schema@3.25.2_zod@4.6.7/node_modules/zod-to-json-schema/dist/esm/parsers/optional.js
var parseOptionalDef = (def, refs) => {
	if (refs.currentPath.toString() === refs.propertyPath?.toString()) return parseDef(def.innerType._def, refs);
	const innerSchema = parseDef(def.innerType._def, {
		...refs,
		currentPath: [
			...refs.currentPath,
			"anyOf",
			"1"
		]
	});
	return innerSchema ? { anyOf: [{ not: parseAnyDef(refs) }, innerSchema] } : parseAnyDef(refs);
};
//#endregion
export { parseOptionalDef };
