import { EdgeType, ResourceType } from "./types.mjs";
import { createEdgeIdMinter } from "./edgeIds.mjs";
import { stackMembership } from "./groupByStack.mjs";
//#region ../core/dist/graph/collapseIntegrations.js
var CUSTOM_DOMAIN_RESOURCE_TYPES = /* @__PURE__ */ new Set([
	"AWS::ApiGatewayV2::DomainName",
	"aws_apigatewayv2_domain_name",
	"aws:apigatewayv2/domainName:DomainName",
	"aws-native:apigatewayv2:DomainName",
	"AWS::ApiGateway::DomainName",
	"aws_api_gateway_domain_name",
	"aws:apigateway/domainName:DomainName",
	"aws-native:apigateway:DomainName"
]);
var API_MAPPING_RESOURCE_TYPES = /* @__PURE__ */ new Set([
	"AWS::ApiGatewayV2::ApiMapping",
	"aws_apigatewayv2_api_mapping",
	"aws:apigatewayv2/apiMapping:ApiMapping",
	"aws-native:apigatewayv2:ApiMapping",
	"AWS::ApiGateway::BasePathMapping",
	"aws_api_gateway_base_path_mapping",
	"aws:apigateway/basePathMapping:BasePathMapping",
	"aws-native:apigateway:BasePathMapping"
]);
/**
* Transforms APIGW_V2_INTEGRATION nodes into labeled edges.
*
* Routes connect directly to their Lambda targets (labeled with integration name).
* The API Gateway becomes a container (CONTAINS edges) for its routes and targets.
* A target in a different stack than its API is not contained: it belongs in its
* own stack's box, which `groupByStack` only draws around uncontained nodes (#2514).
*/
function collapseIntegrations(graph) {
	const integrationIds = new Set(graph.nodes.filter((n) => n.type === ResourceType.APIGW_V2_INTEGRATION).map((n) => n.id));
	if (integrationIds.size === 0) return graph;
	const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
	const stackOf = stackMembership(graph);
	const edgesBySource = /* @__PURE__ */ new Map();
	const edgesByTarget = /* @__PURE__ */ new Map();
	const edgeBySourceTarget = /* @__PURE__ */ new Map();
	for (const edge of graph.edges) {
		let bySource = edgesBySource.get(edge.source);
		if (!bySource) {
			bySource = [];
			edgesBySource.set(edge.source, bySource);
		}
		bySource.push(edge);
		let byTarget = edgesByTarget.get(edge.target);
		if (!byTarget) {
			byTarget = [];
			edgesByTarget.set(edge.target, byTarget);
		}
		byTarget.push(edge);
		const key = `${edge.source}->${edge.target}`;
		if (!edgeBySourceTarget.has(key)) edgeBySourceTarget.set(key, edge);
	}
	const newEdges = [];
	const nextEdgeId = createEdgeIdMinter(graph.edges);
	const edgesToRemove = /* @__PURE__ */ new Set();
	const containment = /* @__PURE__ */ new Map();
	for (const integrationId of integrationIds) {
		const integration = nodeById.get(integrationId);
		if (!integration) continue;
		const outEdges = edgesBySource.get(integrationId) ?? [];
		let apiId;
		const targetIds = [];
		for (const edge of outEdges) {
			const targetNode = nodeById.get(edge.target);
			if (targetNode && (targetNode.type === ResourceType.APIGW_V2_API || targetNode.type === ResourceType.APIGW_REST_API)) apiId = edge.target;
			else if (targetNode) targetIds.push(edge.target);
		}
		if (!apiId) continue;
		const routeEdges = (edgesByTarget.get(integrationId) ?? []).filter((e) => !integrationIds.has(e.source));
		for (const routeEdge of routeEdges) {
			const routeId = routeEdge.source;
			edgesToRemove.add(routeEdge.id);
			const routeToApi = edgeBySourceTarget.get(`${routeId}->${apiId}`);
			if (routeToApi) edgesToRemove.add(routeToApi.id);
			for (const targetId of targetIds) newEdges.push({
				id: nextEdgeId(),
				source: routeId,
				target: targetId,
				type: EdgeType.REFERENCE,
				label: integration.name
			});
			if (!containment.has(apiId)) containment.set(apiId, /* @__PURE__ */ new Set());
			const children = containment.get(apiId);
			if (!children) continue;
			children.add(routeId);
			for (const targetId of targetIds) {
				const targetStack = stackOf.get(targetId);
				if (targetStack !== void 0 && targetStack !== stackOf.get(apiId)) continue;
				children.add(targetId);
			}
		}
	}
	const customDomainNodesToRemove = /* @__PURE__ */ new Set();
	if (containment.size > 0) {
		const apiContainerIds = new Set(containment.keys());
		const outEdges = /* @__PURE__ */ new Map();
		const inEdges = /* @__PURE__ */ new Map();
		for (const edge of graph.edges) {
			if (edge.type === EdgeType.CONTAINS) continue;
			if (integrationIds.has(edge.source) || integrationIds.has(edge.target)) continue;
			if (!outEdges.has(edge.source)) outEdges.set(edge.source, /* @__PURE__ */ new Set());
			const outSet = outEdges.get(edge.source);
			if (outSet) outSet.add(edge.target);
			if (!inEdges.has(edge.target)) inEdges.set(edge.target, /* @__PURE__ */ new Set());
			const inSet = inEdges.get(edge.target);
			if (inSet) inSet.add(edge.source);
		}
		for (const node of graph.nodes) {
			if (node.type !== ResourceType.ROUTE53_RECORD) continue;
			if ([...containment.values()].some((c) => c.has(node.id))) continue;
			const recordTargets = outEdges.get(node.id);
			if (!recordTargets) continue;
			let found = false;
			for (const targetId of recordTargets) if (apiContainerIds.has(targetId)) {
				const children = containment.get(targetId);
				if (children) children.add(node.id);
				found = true;
				break;
			}
			if (!found) for (const intermediateId of recordTargets) {
				if (found) break;
				if (!isResourceTypeIn(nodeById.get(intermediateId), CUSTOM_DOMAIN_RESOURCE_TYPES)) continue;
				const coReferencers = inEdges.get(intermediateId);
				if (!coReferencers) continue;
				for (const bridgeId of coReferencers) {
					if (found) break;
					if (!isResourceTypeIn(nodeById.get(bridgeId), API_MAPPING_RESOURCE_TYPES)) continue;
					const bridgeTargets = outEdges.get(bridgeId);
					if (!bridgeTargets) continue;
					for (const apiId of bridgeTargets) if (apiContainerIds.has(apiId)) {
						const apiChildren = containment.get(apiId);
						if (apiChildren) apiChildren.add(node.id);
						customDomainNodesToRemove.add(intermediateId);
						customDomainNodesToRemove.add(bridgeId);
						found = true;
						break;
					}
				}
			}
		}
	}
	for (const [apiId, children] of containment) for (const childId of children) newEdges.push({
		id: nextEdgeId(),
		source: apiId,
		target: childId,
		type: EdgeType.CONTAINS
	});
	const childToContainer = /* @__PURE__ */ new Map();
	for (const [apiId, children] of containment) for (const childId of children) childToContainer.set(childId, apiId);
	const removedNodes = /* @__PURE__ */ new Set([...integrationIds, ...customDomainNodesToRemove]);
	const nodes = graph.nodes.filter((n) => !removedNodes.has(n.id));
	const mintedEdges = newEdges.filter((e) => !removedNodes.has(e.source) && !removedNodes.has(e.target));
	return {
		nodes,
		edges: [...graph.edges.filter((e) => {
			if (removedNodes.has(e.source) || removedNodes.has(e.target)) return false;
			if (edgesToRemove.has(e.id)) return false;
			if (childToContainer.get(e.source) === e.target) return false;
			if (containment.get(e.source)?.has(e.target) && e.type !== EdgeType.CONTAINS) return false;
			return true;
		}), ...mintedEdges],
		metadata: graph.metadata
	};
}
var isResourceTypeIn = (node, types) => node !== void 0 && types.has(node.resourceType);
//#endregion
export { collapseIntegrations };
