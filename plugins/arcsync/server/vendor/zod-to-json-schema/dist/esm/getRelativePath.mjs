//#region ../../node_modules/.pnpm/zod-to-json-schema@3.25.2_zod@4.6.7/node_modules/zod-to-json-schema/dist/esm/getRelativePath.js
var getRelativePath = (pathA, pathB) => {
	let i = 0;
	for (; i < pathA.length && i < pathB.length; i++) if (pathA[i] !== pathB[i]) break;
	return [(pathA.length - i).toString(), ...pathB.slice(i)].join("/");
};
//#endregion
export { getRelativePath };
