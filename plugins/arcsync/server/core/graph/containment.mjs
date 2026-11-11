import { EdgeType } from "./types.mjs";
import "./syntheticStateId.mjs";
//#region ../core/dist/graph/containment.js
/** Resolves `graph`'s `CONTAINS` edges under the rule documented on
* {@link Containment}. Edge order is the tie-break, so callers that mint
* edges control which parent wins by where they append. */
function resolveContainment(graph) {
	const nodeIds = new Set(graph.nodes.map((n) => n.id));
	const parentOf = /* @__PURE__ */ new Map();
	const childrenOf = /* @__PURE__ */ new Map();
	const hasChildren = /* @__PURE__ */ new Set();
	for (const edge of graph.edges) {
		if (edge.type !== EdgeType.CONTAINS) continue;
		if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
		hasChildren.add(edge.source);
		if (parentOf.has(edge.target)) continue;
		parentOf.set(edge.target, edge.source);
		const siblings = childrenOf.get(edge.source);
		if (siblings) siblings.push(edge.target);
		else childrenOf.set(edge.source, [edge.target]);
	}
	return {
		parentOf,
		childrenOf,
		hasChildren
	};
}
/**
* `resolveContainment` reshaped as the container → children-set map the
* geometry passes want, with an entry for every container — including one that
* won no children, so `containers.has(id)` keeps answering "is a container"
* rather than "has children of its own".
*/
function containerChildSets(graph) {
	return containerChildSetsOf(resolveContainment(graph));
}
/** `containerChildSets` for a caller that has already resolved the graph and
* would otherwise pay for a second walk over the same `CONTAINS` edges. */
function containerChildSetsOf(containment) {
	const containers = /* @__PURE__ */ new Map();
	for (const id of containment.hasChildren) containers.set(id, new Set(containment.childrenOf.get(id) ?? []));
	return containers;
}
//#endregion
export { containerChildSets, containerChildSetsOf, resolveContainment };
