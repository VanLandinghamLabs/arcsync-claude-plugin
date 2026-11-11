import { ResourceType } from "./types.mjs";
import { lookupByType } from "./typeLookup.mjs";
//#region ../core/dist/graph/stageTypes.js
/**
* API Gateway stage raw provider types, the name extractor and the protocol
* label, in their own module for the same reason `permissionTypes.ts` exists:
* `displayFilter.ts` hides these nodes and stamps the stage name onto the
* surviving API, and `routeTable.ts` resolves the same set itself when it
* walks an *unfiltered* graph. `routeTable` ships in the browser's graph chunk
* and `displayFilter` does not, so importing them from `displayFilter` would
* drag its entire deny list into the frontend bundle.
*/
/** The API Gateway nodes a stage can belong to. Shared with the set above
* because the two are only ever used as a pair — resolving a stage means
* resolving which API it stages. */
var API_TYPES = /* @__PURE__ */ new Set([ResourceType.APIGW_V2_API, ResourceType.APIGW_REST_API]);
var PROTOCOL_LABELS = {
	HTTP: "V2 HTTP",
	WEBSOCKET: "V2 WebSocket"
};
/** "REST" for a REST API, else the V2 protocol's label — for a node already
* known to be an API Gateway (the route table's header). */
function protocolLabelFor(node) {
	if (node.type === ResourceType.APIGW_REST_API) return "REST";
	const protocol = node.attributes.ProtocolType;
	return lookupByType(PROTOCOL_LABELS, typeof protocol === "string" ? protocol : "") ?? "V2";
}
/** The same label for any node, empty when it is not an API Gateway — what a
* container header or Mermaid subgraph label appends after the display name. */
function apiGatewayTypeLabel(node) {
	return API_TYPES.has(node.type) ? protocolLabelFor(node) : "";
}
//#endregion
export { API_TYPES, apiGatewayTypeLabel, protocolLabelFor };
