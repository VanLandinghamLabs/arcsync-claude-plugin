import { EdgeType, ResourceType, hasGraphArrays } from "./types.mjs";
import { lookupByType } from "./typeLookup.mjs";
import { fallbackRailFor, namesNode, railLabelFor, readAttributeEntry, referenceToken } from "./fallbackRail.mjs";
import { railBudgetSubscribers } from "./budgetSubscribers.mjs";
//#region ../core/dist/graph/foldEventLeftovers.js
var KIND_BY_RESOURCE_TYPE = {
	"AWS::SNS::Subscription": "subscription",
	aws_sns_topic_subscription: "subscription",
	"aws:sns/topicSubscription:TopicSubscription": "subscription",
	aws_cloudwatch_event_target: "target",
	"aws:cloudwatch/eventTarget:EventTarget": "target"
};
/** Hub types per kind, in preference order: a target names both its rule and
* its bus, and the rule is what actually fires it. */
var HUB_TYPES = {
	subscription: [ResourceType.SNS_TOPIC],
	target: [ResourceType.EVENTBRIDGE_RULE, ResourceType.EVENTBRIDGE_BUS]
};
/** The attribute naming the consumer, normalized. A target or subscription also
* references things that are not its consumer (an ECS target's subnets and
* task definition, a dead-letter queue), so the consumer is read from here
* first, and the node keeps its card when the consumer cannot be told apart. */
var CONSUMER_KEY = {
	subscription: "endpoint",
	target: "arn"
};
/** Attribute keys a rail names and expands to, normalized. */
var RAIL_KEYS = {
	subscription: ["protocol", "endpoint"],
	target: [
		"targetid",
		"id",
		"arn"
	]
};
function isScalar(value) {
	return typeof value === "string" && value.length > 0 && !value.startsWith("${") || typeof value === "number";
}
function leftoverRail(node, kind) {
	const policy = [];
	const parts = [];
	for (const key of RAIL_KEYS[kind]) {
		const found = readAttributeEntry(node.attributes, key);
		if (!found || !isScalar(found.value)) continue;
		policy.push(`${found.key} ${found.value}`);
		parts.push(String(found.value));
	}
	const name = kind === "subscription" ? parts.join(" ") : parts[0];
	return fallbackRailFor(node, railLabelFor(kind), policy, name || void 0);
}
/** Also stamps budgets' inline email subscribers, the inline twin of an email
* subscription's rail (see `railBudgetSubscribers`). */
function foldEventLeftovers(graph) {
	return railBudgetSubscribers(foldSubscriptionsAndTargets(graph));
}
function foldSubscriptionsAndTargets(graph) {
	if (!hasGraphArrays(graph)) return graph;
	const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
	const containerIds = new Set(graph.edges.filter((e) => e.type === EdgeType.CONTAINS).map((e) => e.source));
	const folded = /* @__PURE__ */ new Set();
	const minted = [];
	const railsByHub = /* @__PURE__ */ new Map();
	const pending = [];
	for (const node of graph.nodes) {
		if (node.type !== ResourceType.UNKNOWN) continue;
		const kind = lookupByType(KIND_BY_RESOURCE_TYPE, node.resourceType);
		if (!kind || containerIds.has(node.id)) continue;
		const neighbours = [];
		for (const edge of graph.edges) {
			if (edge.type === EdgeType.CONTAINS) continue;
			const otherId = edge.source === node.id ? edge.target : edge.target === node.id ? edge.source : null;
			const other = otherId === null || otherId === node.id ? void 0 : nodeById.get(otherId);
			if (other && !neighbours.includes(other)) neighbours.push(other);
		}
		let hub;
		for (const type of HUB_TYPES[kind]) {
			hub = neighbours.find((n) => n.type === type);
			if (hub) break;
		}
		if (!hub) continue;
		const hubId = hub.id;
		const others = neighbours.filter((n) => n.id !== hubId);
		const token = referenceToken(readAttributeEntry(node.attributes, CONSUMER_KEY[kind])?.value);
		const named = token ? others.find((n) => namesNode(token, n)) : void 0;
		const rest = others.filter((n) => n !== named && !(kind === "target" && n.type === ResourceType.EVENTBRIDGE_BUS));
		const candidates = named ? [named] : rest;
		if (rest.length > (named ? 0 : 1)) continue;
		folded.add(node.id);
		if (candidates.length === 0) {
			const rails = railsByHub.get(hubId);
			if (rails) rails.push(leftoverRail(node, kind));
			else railsByHub.set(hubId, [leftoverRail(node, kind)]);
			continue;
		}
		pending.push({
			hub: hubId,
			consumer: candidates[0].id,
			node
		});
	}
	if (folded.size === 0) return graph;
	const survivingEdges = graph.edges.filter((e) => !folded.has(e.source) && !folded.has(e.target));
	const drawn = new Set(survivingEdges.filter((e) => e.type !== EdgeType.CONTAINS).map((e) => `${e.source}\u0000${e.target}`));
	for (const { hub, consumer, node } of pending) {
		const key = `${hub}\u0000${consumer}`;
		if (drawn.has(key)) continue;
		drawn.add(key);
		minted.push({
			id: `fold-${node.id}`,
			source: hub,
			target: consumer,
			type: EdgeType.EVENT_FLOW
		});
	}
	return {
		...graph,
		nodes: graph.nodes.filter((n) => !folded.has(n.id)).map((n) => {
			const rails = railsByHub.get(n.id);
			return rails ? {
				...n,
				fallbackRails: [...n.fallbackRails ?? [], ...rails]
			} : n;
		}),
		edges: [...survivingEdges, ...minted]
	};
}
//#endregion
export { foldEventLeftovers };
