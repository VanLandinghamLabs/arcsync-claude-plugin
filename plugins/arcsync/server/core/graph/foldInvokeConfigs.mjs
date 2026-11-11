import { EdgeType, ResourceType, hasGraphArrays } from "./types.mjs";
import { fallbackRailFor, namesNode, railLabelFor, readAttribute, readAttributeEntry, referenceToken } from "./fallbackRail.mjs";
//#region ../core/dist/graph/foldInvokeConfigs.js
/**
* Folds each Lambda async-invoke config into the function it configures, the way
* an owned log group becomes a LOGS rail: the node goes, its settings ride on the
* function as an ASYNC rail, and each destination it names gets an edge from the
* function itself, since the function is what sends there.
*
* A destination keeps `OnFailure` as the edge's `viaProperty`, so
* `foldFallbackNodes` still folds a dedicated failure queue onto the function as
* an ON FAIL rail, as it did onto the config before.
*/
var INVOKE_CONFIG_TYPES = /* @__PURE__ */ new Set([
	"AWS::Lambda::EventInvokeConfig",
	"aws_lambda_function_event_invoke_config",
	"aws:lambda/functionEventInvokeConfig:FunctionEventInvokeConfig",
	"aws-native:lambda:EventInvokeConfig"
]);
var SETTING_KEYS = [
	"maximumretryattempts",
	"maximumeventageinseconds",
	"qualifier"
];
/** Every reference token in `value`: CloudFormation `Ref`/`Fn::GetAtt`, a
* Terraform interpolation, or a plain name. */
function tokensIn(value, out = []) {
	const token = referenceToken(value);
	if (token) out.push(token);
	else if (Array.isArray(value)) for (const item of value) tokensIn(item, out);
	else if (value && typeof value === "object") for (const child of Object.values(value)) tokensIn(child, out);
	return out;
}
/** `namesNode`, also accepting a Terraform attribute access other than `.id`/`.arn`
* (`aws_lambda_function.fn.function_name`). */
function tokenNames(token, node) {
	if (namesNode(token, node)) return true;
	const cut = token.lastIndexOf(".");
	return cut > 0 && namesNode(token.slice(0, cut), node);
}
/** `readAttribute` through Terraform's block lists, which hcl2json wraps in arrays. */
function under(value, key) {
	if (Array.isArray(value)) return value.map((item) => under(item, key));
	return value && typeof value === "object" ? readAttribute(value, key) : void 0;
}
var named = (value, node) => tokensIn(value).some((token) => tokenNames(token, node));
function scalar(value) {
	if (typeof value === "number") return String(value);
	return typeof value === "string" && value.length > 0 && !value.startsWith("${") ? value : void 0;
}
function invokeConfigRail(node, failures, successes) {
	const policy = [];
	for (const key of SETTING_KEYS) {
		const found = readAttributeEntry(node.attributes, key);
		const value = scalar(found?.value);
		if (found && value !== void 0) policy.push(`${found.key} ${value}`);
	}
	for (const target of failures) policy.push(`on failure → ${target.name}`);
	for (const target of successes) policy.push(`on success → ${target.name}`);
	const retries = scalar(readAttribute(node.attributes, "maximumretryattempts"));
	const age = scalar(readAttribute(node.attributes, "maximumeventageinseconds"));
	const summary = [retries !== void 0 ? `retries ${retries}` : void 0, age !== void 0 ? `max age ${age}s` : void 0].filter((part) => part !== void 0);
	return fallbackRailFor(node, railLabelFor("invokeconfig"), policy, summary.length > 0 ? summary.join(" · ") : void 0);
}
function foldInvokeConfigs(graph) {
	if (!hasGraphArrays(graph)) return graph;
	const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
	const containerIds = new Set(graph.edges.filter((e) => e.type === EdgeType.CONTAINS).map((e) => e.source));
	const folded = /* @__PURE__ */ new Set();
	const railsByOwner = /* @__PURE__ */ new Map();
	const pending = [];
	for (const node of graph.nodes) {
		if (!INVOKE_CONFIG_TYPES.has(node.resourceType) || containerIds.has(node.id)) continue;
		const incident = graph.edges.filter((e) => e.type !== EdgeType.CONTAINS && e.source !== e.target && (e.source === node.id || e.target === node.id));
		const neighbours = [...new Set(incident.map((e) => e.source === node.id ? e.target : e.source))].map((id) => nodeById.get(id)).filter((n) => n !== void 0);
		const destinations = readAttribute(node.attributes, "destinationconfig");
		const onFailure = under(destinations, "onfailure");
		const onSuccess = under(destinations, "onsuccess");
		const fnName = readAttribute(node.attributes, "functionname");
		const lambdas = neighbours.filter((n) => n.type === ResourceType.LAMBDA_FUNCTION);
		const owner = lambdas.find((n) => named(fnName, n)) ?? (() => {
			const rest = lambdas.filter((n) => !named(destinations, n));
			return rest.length === 1 ? rest[0] : void 0;
		})();
		if (!owner) continue;
		folded.add(node.id);
		const failures = [];
		const successes = [];
		for (const other of neighbours) {
			if (other.id === owner.id) continue;
			const isFailure = named(onFailure, other);
			if (isFailure) failures.push(other);
			else if (named(onSuccess, other)) successes.push(other);
			const edge = incident.find((e) => e.source === other.id || e.target === other.id);
			const viaProperty = isFailure ? "OnFailure" : edge.viaProperty;
			pending.push({
				id: `fold-${node.id}-${other.id}`,
				source: owner.id,
				target: other.id,
				type: edge.type,
				...viaProperty ? { viaProperty } : {}
			});
		}
		const rails = railsByOwner.get(owner.id) ?? [];
		rails.push(invokeConfigRail(node, failures, successes));
		railsByOwner.set(owner.id, rails);
	}
	if (folded.size === 0) return graph;
	const surviving = graph.edges.filter((e) => !folded.has(e.source) && !folded.has(e.target));
	const pairKey = (a, b) => a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
	const drawn = new Set(surviving.filter((e) => e.type !== EdgeType.CONTAINS).map((e) => pairKey(e.source, e.target)));
	const minted = [];
	for (const edge of pending) {
		const key = pairKey(edge.source, edge.target);
		if (drawn.has(key)) continue;
		drawn.add(key);
		minted.push(edge);
	}
	return {
		...graph,
		nodes: graph.nodes.filter((n) => !folded.has(n.id)).map((n) => {
			const rails = railsByOwner.get(n.id);
			return rails ? {
				...n,
				fallbackRails: [...n.fallbackRails ?? [], ...rails]
			} : n;
		}),
		edges: [...surviving, ...minted]
	};
}
//#endregion
export { foldInvokeConfigs };
