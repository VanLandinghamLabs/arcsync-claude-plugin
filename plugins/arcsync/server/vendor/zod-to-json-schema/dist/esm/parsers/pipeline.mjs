import { parseDef } from "../parseDef.mjs";
//#region ../../node_modules/.pnpm/zod-to-json-schema@3.25.2_zod@4.6.7/node_modules/zod-to-json-schema/dist/esm/parsers/pipeline.js
var parsePipelineDef = (def, refs) => {
	if (refs.pipeStrategy === "input") return parseDef(def.in._def, refs);
	else if (refs.pipeStrategy === "output") return parseDef(def.out._def, refs);
	const a = parseDef(def.in._def, {
		...refs,
		currentPath: [
			...refs.currentPath,
			"allOf",
			"0"
		]
	});
	return { allOf: [a, parseDef(def.out._def, {
		...refs,
		currentPath: [
			...refs.currentPath,
			"allOf",
			a ? "1" : "0"
		]
	})].filter((x) => x !== void 0) };
};
//#endregion
export { parsePipelineDef };
