//#region src/graph.ts
var str = (v) => typeof v === "string" && v.length > 0 ? v : void 0;
var num = (v) => {
	const n = typeof v === "string" ? Number(v) : v;
	return typeof n === "number" && Number.isFinite(n) ? n : void 0;
};
/** Drops undefined fields so the JSON an agent reads carries no noise. */
var compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== void 0));
var canvasUrl = (appUrl, graphId) => `${appUrl}/canvas/${encodeURIComponent(graphId)}`;
function repoLabel(row) {
	const owner = str(row.displayOwner);
	const repo = str(row.displayRepo);
	if (owner && repo) return `${owner}/${repo}`;
	return str(row.repoUrl)?.replace(/^https?:\/\/(www\.)?github\.com\//, "").replace(/\.git$/, "");
}
function diagramTitle(row) {
	const repo = repoLabel(row) ?? "diagram";
	const branch = str(row.branch);
	const subpath = str(row.subpath);
	return `${repo}${branch ? `@${branch}` : ""}${subpath ? ` (${subpath})` : ""}`;
}
/** One row of `GET /graphs`, reduced to what an agent needs to pick a diagram. */
function summarizeListItem(row, appUrl) {
	const graphId = str(row.graphId) ?? "";
	return compact({
		graphId,
		title: diagramTitle(row),
		repoUrl: str(row.repoUrl),
		branch: str(row.branch),
		subpath: str(row.subpath),
		projectType: str(row.projectType),
		provider: str(row.provider),
		status: str(row.status),
		resources: num(row.nodeCount),
		relationships: num(row.edgeCount),
		lastParsedAt: str(row.lastParsedAt),
		prNumber: num(row.prNumber),
		canvasUrl: canvasUrl(appUrl, graphId)
	});
}
function matchesQuery(row, query) {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return [
		row.repoUrl,
		row.branch,
		row.subpath,
		row.displayOwner,
		row.displayRepo,
		row.projectType
	].filter((v) => typeof v === "string").some((v) => v.toLowerCase().includes(q));
}
function graphOf(raw) {
	const g = raw.graphData;
	return g && Array.isArray(g.nodes) && Array.isArray(g.edges) ? g : null;
}
var MAX_CANDIDATES = 20;
/** Exact id, then exact name (case-insensitive), then a substring of id, name
* or resource type. A unique hit at any stage wins. */
function findResource(graph, query) {
	const q = query.trim().toLowerCase();
	if (!q) return { kind: "none" };
	const byId = graph.nodes.find((n) => n.id === query.trim());
	if (byId) return {
		kind: "found",
		node: byId
	};
	const stages = [graph.nodes.filter((n) => n.id.toLowerCase() === q || n.name?.toLowerCase() === q), graph.nodes.filter((n) => [
		n.id,
		n.name,
		n.resourceType
	].some((v) => v?.toLowerCase().includes(q)))];
	for (const hits of stages) {
		if (hits.length === 1) return {
			kind: "found",
			node: hits[0]
		};
		if (hits.length > 1) return {
			kind: "ambiguous",
			candidates: hits.slice(0, MAX_CANDIDATES)
		};
	}
	return { kind: "none" };
}
var nodeRef = (n) => compact({
	id: n.id,
	name: n.name,
	resourceType: n.resourceType
});
var MAX_ATTRIBUTE_CHARS = 6e3;
/** Attributes are IaC source values and can be large (inline policies, user
* data). Past the budget the JSON is cut and says so, rather than flooding the
* agent's context. */
function boundedAttributes(attrs) {
	const text = JSON.stringify(attrs ?? {});
	if (text.length <= MAX_ATTRIBUTE_CHARS) return attrs ?? {};
	return {
		truncated: true,
		note: `attributes are ${text.length} characters; showing the first ${MAX_ATTRIBUTE_CHARS}`,
		json: text.slice(0, MAX_ATTRIBUTE_CHARS)
	};
}
function describeResource(graph, node) {
	const byId = new Map(graph.nodes.map((n) => [n.id, n]));
	const peer = (id) => {
		const n = byId.get(id);
		return n ? nodeRef(n) : { id };
	};
	return compact({
		id: node.id,
		name: node.name,
		type: node.type,
		resourceType: node.resourceType,
		provider: node.provider,
		engine: node.engine,
		attributes: boundedAttributes(node.attributes),
		outgoing: graph.edges.filter((e) => e.source === node.id).map((e) => compact({
			type: e.type,
			label: e.label,
			to: peer(e.target)
		})),
		incoming: graph.edges.filter((e) => e.target === node.id).map((e) => compact({
			type: e.type,
			label: e.label,
			from: peer(e.source)
		}))
	});
}
/** The graph as plain lists, for an agent that wants to reason over it rather
* than read a picture. */
function graphAsJson(graph) {
	return {
		resources: graph.nodes.map((n) => compact({
			...nodeRef(n),
			type: n.type
		})),
		relationships: graph.edges.map((e) => compact({
			source: e.source,
			target: e.target,
			type: e.type,
			label: e.label
		}))
	};
}
//#endregion
export { boundedAttributes, canvasUrl, compact, describeResource, diagramTitle, findResource, graphAsJson, graphOf, matchesQuery, nodeRef, summarizeListItem };
