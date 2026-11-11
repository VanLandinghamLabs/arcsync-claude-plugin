import { EdgeType } from "../types.mjs";
//#region ../core/dist/graph/eventFlows/context.js
var NEIGHBOR_EDGE_TYPES = /* @__PURE__ */ new Set([
	EdgeType.REFERENCE,
	EdgeType.IAM,
	EdgeType.DEPENDENCY
]);
/** Undirected adjacency over REFERENCE/IAM/DEPENDENCY edges (CONTAINS, EVENT_FLOW excluded). */
function buildNeighborIndex(edges) {
	const index = /* @__PURE__ */ new Map();
	const add = (a, b) => {
		let set = index.get(a);
		if (!set) {
			set = /* @__PURE__ */ new Set();
			index.set(a, set);
		}
		set.add(b);
	};
	for (const e of edges) {
		if (!NEIGHBOR_EDGE_TYPES.has(e.type)) continue;
		add(e.source, e.target);
		add(e.target, e.source);
	}
	return index;
}
function consumersOf(nodeId, exclude, neighbors) {
	const set = neighbors.get(nodeId);
	if (!set) return [];
	return [...set].filter((id) => !exclude.has(id)).sort();
}
/** The fields shared by every event a subscription-style node derives. */
function subscriptionBase(nodeId, busId, provider, neighbors) {
	return {
		busId,
		targets: consumersOf(nodeId, /* @__PURE__ */ new Set([nodeId, busId]), neighbors),
		absorbedIds: [nodeId],
		derivedFrom: nodeId,
		provider
	};
}
/** The single REFERENCE/IAM/DEPENDENCY neighbor of the given type, or null if none/ambiguous. */
function soleNeighborOfType(nodeId, type, neighbors, nodesById) {
	const set = neighbors.get(nodeId);
	if (!set) return null;
	const matches = [...set].filter((id) => nodesById.get(id)?.type === type);
	return matches.length === 1 ? matches[0] : null;
}
/** Turn a filter derivation into DerivedEvents; summarized -> one node named "{owner} filter". */
function eventsFromFilter(rawFilter, parsed, base, ownerName) {
	if (!parsed || parsed.summarized) return [{
		...base,
		name: `${ownerName} filter`,
		attributes: { filter: rawFilter }
	}];
	return parsed.names.map((n) => n.endsWith("*") ? {
		...base,
		name: n,
		attributes: {
			prefix: n.slice(0, -1),
			filter: rawFilter
		}
	} : {
		...base,
		name: n,
		attributes: {
			eventType: n,
			filter: rawFilter
		}
	});
}
/** Unwrap a possibly hcl2json-array-wrapped block into its (only) object form. */
function firstBlock(value) {
	const v = Array.isArray(value) ? value[0] : value;
	return v != null && typeof v === "object" && !Array.isArray(v) ? v : null;
}
//#endregion
export { buildNeighborIndex, consumersOf, eventsFromFilter, firstBlock, soleNeighborOfType, subscriptionBase };
