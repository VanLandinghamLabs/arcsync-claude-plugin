//#region ../core/dist/graph/dataModel.js
/**
* A store's model rides on this attribute, set when the graph is built: from an
* authored `erDiagram` block (`parseArcsync`), or by the parser from a DynamoDB
* table's key schema and the app code's schemas (`attachAppSchemas`). The canvas
* only reads it, so no IaC knowledge ships in the SPA.
*/
var DATA_MODEL_ATTRIBUTE = "DataModel";
//#endregion
export { DATA_MODEL_ATTRIBUTE };
