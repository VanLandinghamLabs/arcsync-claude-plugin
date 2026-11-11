import { EdgeType, ResourceType } from "./types.mjs";
import { lookupByType } from "./typeLookup.mjs";
import { createEdgeIdMinter } from "./edgeIds.mjs";
//#region ../core/dist/graph/groupByEngine.js
var ENGINE_LABEL = {
	terraform: "Terraform",
	cloudformation: "CloudFormation",
	serverless: "Serverless"
};
/**
* Groups nodes into per-engine containers using CONTAINS edges.
*
* Must run AFTER `groupByStack` so a multi-stack CloudFormation parse nests as
* engine → stack → resources. Skipped unless at least two engines are present,
* mirroring `groupByStack`'s own single-group bail.
*/
function groupByEngine(graph) {
	const byEngine = /* @__PURE__ */ new Map();
	const nodeEngine = new Map(graph.nodes.map((n) => [n.id, n.engine]));
	for (const node of graph.nodes) {
		if (!node.engine) continue;
		let ids = byEngine.get(node.engine);
		if (!ids) {
			ids = [];
			byEngine.set(node.engine, ids);
		}
		ids.push(node.id);
	}
	if (byEngine.size <= 1) return graph;
	const alreadyContained = /* @__PURE__ */ new Set();
	const stackEngine = /* @__PURE__ */ new Map();
	for (const edge of graph.edges) {
		if (edge.type !== EdgeType.CONTAINS) continue;
		alreadyContained.add(edge.target);
		const childEngine = nodeEngine.get(edge.target);
		if (!childEngine) continue;
		const seen = stackEngine.get(edge.source);
		stackEngine.set(edge.source, seen === void 0 || seen === childEngine ? childEngine : null);
	}
	for (const [stackId, engine] of stackEngine) {
		if (!engine || nodeEngine.get(stackId)) continue;
		byEngine.get(engine).push(stackId);
	}
	const newNodes = [...graph.nodes];
	const newEdges = [...graph.edges];
	const nextEdgeId = createEdgeIdMinter(graph.edges);
	for (const [engine, nodeIds] of byEngine) {
		const containerId = `engine:${engine}`;
		newNodes.push({
			id: containerId,
			type: ResourceType.CLOUDFORMATION_STACK,
			provider: "aws",
			name: lookupByType(ENGINE_LABEL, engine) ?? engine,
			resourceType: `arcsync::engine::${engine}`,
			attributes: {}
		});
		for (const nodeId of nodeIds) {
			if (alreadyContained.has(nodeId)) continue;
			newEdges.push({
				id: nextEdgeId(),
				source: containerId,
				target: nodeId,
				type: EdgeType.CONTAINS
			});
		}
	}
	return {
		nodes: newNodes,
		edges: newEdges,
		metadata: graph.metadata
	};
}
//#endregion
export { groupByEngine };
