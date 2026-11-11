//#region ../../node_modules/.pnpm/@modelcontextprotocol+sdk@1.32.2_supports-color@7.2.0_zod@4.6.7/node_modules/@modelcontextprotocol/sdk/dist/esm/server/completable.js
var COMPLETABLE_SYMBOL = Symbol.for("mcp.completable");
/**
* Checks if a schema is completable (has completion metadata).
*/
function isCompletable(schema) {
	return !!schema && typeof schema === "object" && COMPLETABLE_SYMBOL in schema;
}
/**
* Gets the completer callback from a completable schema, if it exists.
*/
function getCompleter(schema) {
	return schema[COMPLETABLE_SYMBOL]?.complete;
}
var McpZodTypeKind;
(function(McpZodTypeKind) {
	McpZodTypeKind["Completable"] = "McpCompletable";
})(McpZodTypeKind || (McpZodTypeKind = {}));
//#endregion
export { COMPLETABLE_SYMBOL, McpZodTypeKind, getCompleter, isCompletable };
