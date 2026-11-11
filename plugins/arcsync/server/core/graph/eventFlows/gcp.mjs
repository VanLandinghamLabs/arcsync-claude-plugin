import { eventsFromFilter, firstBlock, subscriptionBase } from "./context.mjs";
import { resolveTfRef } from "./refs.mjs";
import { deriveEventNames, parseCelFilter } from "../filterExpr.mjs";
//#region ../core/dist/graph/eventFlows/gcp.js
/**
* GCP event derivations: Pub/Sub subscription CEL filters and Eventarc
* trigger matching criteria.
*/
function pubsubBusId(topicAttr, nodeIds, pubsubTopics) {
	const topicRef = resolveTfRef(topicAttr) ?? (typeof topicAttr === "string" ? pubsubTopics.get(topicAttr) ?? null : null);
	return topicRef && nodeIds.has(topicRef) ? topicRef : null;
}
function deriveFromPubsubSubscription(sub, { nodeIds, pubsubTopics, neighbors }) {
	const filter = sub.attributes.filter;
	if (typeof filter !== "string" || !filter.trim()) return [];
	const topicAttr = sub.attributes.topic;
	const busId = pubsubBusId(topicAttr, nodeIds, pubsubTopics);
	const base = subscriptionBase(sub.id, busId, "gcp", neighbors);
	const ast = parseCelFilter(filter);
	return eventsFromFilter(filter, ast ? deriveEventNames(ast) : null, base, sub.name);
}
function deriveFromEventarcTrigger(trigger, { nodeIds, pubsubTopics, neighbors }) {
	const raw = trigger.attributes.matching_criteria;
	const entries = (Array.isArray(raw) ? raw : [raw]).map((e) => firstBlock(e)).filter((e) => e !== null);
	const types = [];
	const criteria = {};
	for (const entry of entries) {
		if (typeof entry.attribute !== "string" || typeof entry.value !== "string") continue;
		if (entry.attribute === "type") types.push(entry.value);
		else criteria[entry.attribute] = entry.value;
	}
	if (types.length === 0) return [];
	const transport = firstBlock(trigger.attributes.transport);
	const topicAttr = (transport ? firstBlock(transport.pubsub) : null)?.topic;
	const busId = pubsubBusId(topicAttr, nodeIds, pubsubTopics);
	const base = subscriptionBase(trigger.id, busId, "gcp", neighbors);
	return types.map((t) => ({
		...base,
		name: t,
		attributes: {
			eventType: t,
			...Object.keys(criteria).length > 0 ? { criteria } : {}
		}
	}));
}
//#endregion
export { deriveFromEventarcTrigger, deriveFromPubsubSubscription };
