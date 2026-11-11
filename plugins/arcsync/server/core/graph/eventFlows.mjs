import { EdgeType, ResourceType, hasGraphArrays } from "./types.mjs";
import { buildNeighborIndex, soleNeighborOfType } from "./eventFlows/context.mjs";
import { resolveTfRef, scopedIdMatch, stringValues } from "./eventFlows/refs.mjs";
import { deriveFromCfnRule, deriveFromSnsSubscription, deriveFromTfRule } from "./eventFlows/aws.mjs";
import { deriveFromEventGridSubscription, deriveFromServiceBusRule } from "./eventFlows/azure.mjs";
import { deriveFromEventarcTrigger, deriveFromPubsubSubscription } from "./eventFlows/gcp.mjs";
//#region ../core/dist/graph/eventFlows.js
var SCHEMA_RESOURCE_TYPES = /* @__PURE__ */ new Set(["AWS::EventSchemas::Schema", "aws_schemas_schema"]);
function schemaNameTail(name) {
	const idx = Math.max(name.lastIndexOf("/"), name.lastIndexOf("@"));
	return idx === -1 ? name : name.slice(idx + 1);
}
function parseSchemaContent(raw) {
	if (typeof raw !== "string") return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}
/** Map schema-name tail -> parsed payload, for AWS::EventSchemas::Schema / aws_schemas_schema nodes. */
function buildSchemaByTail(nodes) {
	const byTail = /* @__PURE__ */ new Map();
	for (const node of nodes) {
		if (!SCHEMA_RESOURCE_TYPES.has(node.resourceType)) continue;
		const isCfn = node.resourceType === "AWS::EventSchemas::Schema";
		const rawName = isCfn ? node.attributes.SchemaName : node.attributes.name;
		const name = typeof rawName === "string" ? rawName : node.name;
		const content = parseSchemaContent(isCfn ? node.attributes.Content : node.attributes.content);
		if (content === null) continue;
		byTail.set(schemaNameTail(name), content);
	}
	return byTail;
}
/**
* Derived event node id. A multi-stack CFN bus/topic id carries its stack as
* a `{Stack}/{Logical}` prefix — keep that prefix in front of `event:` so
* groupByStack's id-prefix grouping puts the event in the bus's own stack
* container instead of fabricating a phantom "event:{Stack}" one.
*
* The event NAME (detail-type, filter value, etc.) is arbitrary user-IaC
* text and may itself contain `/` — replace it (id only; `node.name` stays
* verbatim) so it can't be mistaken for a stack-prefix separator by
* groupByStack's id-prefix split.
*/
function eventNodeId(busId, name) {
	const safeName = name.replaceAll("/", ":");
	if (!busId) return `event:default:${safeName}`;
	const slashIdx = busId.lastIndexOf("/");
	if (slashIdx === -1) return `event:${busId}:${safeName}`;
	return `${busId.slice(0, slashIdx)}/event:${busId.slice(slashIdx + 1)}:${safeName}`;
}
/** Collect valid publish facts (dynamic and nameless facts are unresolvable, skip). Read-only. */
function collectPublishFacts(nodes) {
	const facts = [];
	for (const node of nodes) {
		const publishes = node.attributes?.publishes;
		if (!Array.isArray(publishes)) continue;
		for (const raw of publishes) {
			if (raw == null || typeof raw !== "object") continue;
			const p = raw;
			if (p.dynamic === true) continue;
			if (typeof p.eventName !== "string" || p.eventName === "") continue;
			const payloadShape = p.payloadShape != null && typeof p.payloadShape === "object" && !Array.isArray(p.payloadShape) ? p.payloadShape : void 0;
			facts.push({
				fnId: node.id,
				eventName: p.eventName,
				busRef: typeof p.busRef === "string" ? p.busRef : void 0,
				payloadShape
			});
		}
	}
	return facts;
}
/**
* `attributes.consumes` per node id — payload shapes read off the handlers that
* RECEIVE an event, keyed by the node that declares them.
*
* An event's fields are usually declared once, as a type on the consuming
* handler, and never as a literal a publisher builds — so for most codebases
* this is the only place the shape exists at all.
*/
function collectConsumeFacts(nodes) {
	const byNode = /* @__PURE__ */ new Map();
	for (const node of nodes) {
		const consumes = node.attributes?.consumes;
		if (!Array.isArray(consumes)) continue;
		const facts = [];
		for (const raw of consumes) {
			if (raw == null || typeof raw !== "object") continue;
			const c = raw;
			if (c.payloadShape == null || typeof c.payloadShape !== "object") continue;
			if (Array.isArray(c.payloadShape)) continue;
			facts.push({
				eventName: typeof c.eventName === "string" ? c.eventName : void 0,
				payloadShape: c.payloadShape
			});
		}
		if (facts.length > 0) byNode.set(node.id, facts);
	}
	return byNode;
}
/**
* Every consume fact reachable from one event's targets, then ONE hop past any
* target that declares nothing itself. That hop is what makes the common
* delivery shape work: EventBridge -> SQS -> Lambda puts the queue in the
* target slot, so the handler holding the type is never a direct target.
* Bounded to one hop deliberately — further out, "reachable from this event"
* stops meaning "handles this event".
*
* Two separate sets, not one. `counted` stops a node's facts being taken twice
* when several targets reach it. `expanded` is kept SEPARATE from it so that a
* sibling's hop can never suppress a target's own expansion — conflating the
* two made a target that happened to neighbour ANOTHER target skip its
* expansion, so the payload depended on the order the template listed its
* targets in. `expanded` does no work of its own beyond that separation:
* `targets` is a Set, so no target is visited twice and `expanded.has(target)`
* is never true (see the note at the loop).
*
* `neighbors` is undirected, so a hop can land on a PRODUCER of the queue as
* easily as a consumer of it. That is why the caller still has to check what a
* fact claims rather than trusting reachability.
*/
function consumerCandidatesFor(targets, consumeFacts, neighbors) {
	const counted = /* @__PURE__ */ new Set();
	const expanded = /* @__PURE__ */ new Set();
	const out = [];
	const ownersByKey = /* @__PURE__ */ new Map();
	const take = (id) => {
		if (counted.has(id)) return false;
		const facts = consumeFacts.get(id);
		if (!facts) return false;
		counted.add(id);
		for (const f of facts) {
			const key = consumeKey(f);
			const owners = ownersByKey.get(key);
			if (owners) owners.add(id);
			else ownersByKey.set(key, /* @__PURE__ */ new Set([id]));
		}
		out.push(...facts);
		return true;
	};
	for (const target of targets) {
		if (take(target)) continue;
		if (expanded.has(target)) continue;
		expanded.add(target);
		for (const hop of neighbors.get(target) ?? []) take(hop);
	}
	const seenKeys = /* @__PURE__ */ new Set();
	return {
		candidates: out.filter((c) => {
			const key = consumeKey(c);
			if (seenKeys.has(key)) return false;
			seenKeys.add(key);
			return true;
		}),
		ownersByKey
	};
}
/**
* Identity of a consume fact for counting purposes: its content, never the
* object.
*
* Two handlers unpacking the same imported interface produce byte-identical
* facts as DIFFERENT objects. Because candidates are deduped by content per
* event, an identity-keyed count would see only whichever object happened to
* survive that dedupe — so which event got labelled depended on edge iteration
* order, and a shape both events reach could still label one of them.
*/
function consumeKey(c) {
	return JSON.stringify([c.eventName ?? null, c.payloadShape]);
}
/**
* Consumer-declared payloads per event node id.
*
* Resolved for every event at once rather than one at a time, because the
* decisive question is global: an untagged shape reachable from TWO events
* describes at most one of them, and nothing says which — so it must label
* neither. Per-event resolution cannot see that and would label both.
*/
function resolveConsumerPayloads(entries, consumeFacts, neighbors) {
	const out = /* @__PURE__ */ new Map();
	if (consumeFacts.size === 0) return out;
	const found = entries.map((entry) => ({
		...entry,
		...consumerCandidatesFor(entry.targets, consumeFacts, neighbors)
	}));
	const eventsPerOwner = /* @__PURE__ */ new Map();
	for (const { ownersByKey } of found) {
		const reached = /* @__PURE__ */ new Set();
		for (const owners of ownersByKey.values()) for (const owner of owners) reached.add(owner);
		for (const owner of reached) eventsPerOwner.set(owner, (eventsPerOwner.get(owner) ?? 0) + 1);
	}
	for (const { id, name, candidates, ownersByKey } of found) {
		const named = candidates.filter((c) => c.eventName === name);
		if (named.length === 1) {
			out.set(id, named[0].payloadShape);
			continue;
		}
		const sole = candidates.length === 1 ? candidates[0] : void 0;
		if (!sole) continue;
		if (sole.eventName !== void 0) continue;
		let exclusive = true;
		for (const owner of ownersByKey.get(consumeKey(sole)) ?? []) if (eventsPerOwner.get(owner) !== 1) exclusive = false;
		if (!exclusive) continue;
		out.set(id, sole.payloadShape);
	}
	return out;
}
/** AWS services that put their own events on the default bus, and the
* resource that emits them. A rule matching `source: aws.ecs` subscribes to
* every cluster's task and container state changes, so the cluster is the
* event's producer even though no IaC names it as one. */
var AWS_SOURCE_EMITTERS = /* @__PURE__ */ new Map([["aws.ecs", ResourceType.ECS_CLUSTER]]);
var BUS_NODE_TYPES = /* @__PURE__ */ new Set([
	ResourceType.EVENTBRIDGE_BUS,
	ResourceType.SNS_TOPIC,
	ResourceType.GCP_PUBSUB_TOPIC
]);
/**
* Provider for a producer-derived event node, mirroring how consumer
* derivations label DerivedEvents (GCP topics -> "gcp", Azure -> "azure",
* everything else / no bus -> "aws").
*/
function derivedProviderOf(busNode) {
	if (!busNode) return "aws";
	if (busNode.type === ResourceType.GCP_PUBSUB_TOPIC) return "gcp";
	if (busNode.provider === "azurerm" || busNode.provider === "azure") return "azure";
	return "aws";
}
/**
* Resolve a publish fact's busRef to a node id: bare/owner-prefixed id match
* first (accepted only when the matched node is bus/topic-typed — a busRef
* colliding with an unrelated node's id, e.g. a Lambda, must not resolve),
* then a unique name match among bus/topic-typed nodes. Two same-named buses
* (or no match at all) resolve to null — the caller then falls back to
* name-only join.
*/
function resolveBusRef(busRef, ownerId, nodeIds, nodesById) {
	const idMatch = scopedIdMatch(busRef, ownerId, nodeIds);
	if (idMatch) {
		const idMatchNode = nodesById.get(idMatch);
		if (idMatchNode && BUS_NODE_TYPES.has(idMatchNode.type)) return idMatch;
	}
	let match = null;
	let count = 0;
	for (const node of nodesById.values()) {
		if (!BUS_NODE_TYPES.has(node.type) || node.name !== busRef) continue;
		match = node.id;
		count++;
	}
	return count === 1 ? match : null;
}
/**
* Which engine a derived event belongs to. No IaC file declares one, so it
* inherits: its bus's engine when the bus has one, else the single engine its
* producers and consumers agree on. Left unset when they disagree, mirroring
* `groupByEngine`'s own rule for a stack container whose children disagree —
* an arbitrary pick would put the event in the wrong box, which is worse than
* leaving it loose.
*
* This is the multi-ENGINE counterpart to the `{Stack}/` prefix `eventNodeId`
* keeps for multi-stack CFN, and exists for the same reason: to land the event
* in its neighbours' container. Load-bearing for layout, not cosmetic.
* `groupByEngine` only sweeps nodes carrying `.engine`, so without this the
* event is left parentless beside the engine containers; its edges then cross
* a container boundary, which keeps that cluster compound rather than
* extracted (mermaid's `extractor` skips a cluster with `externalConnections`),
* and dagre's compound ordering cannot interleave a non-member into a
* cluster's rank. The event is therefore exiled past the container's entire
* width instead of sitting beside it — on the multi-engine graph that surfaced
* this, 2,270px from the consumer it fed. That figure is one observation, not
* an invariant; `layoutGraph.test.ts`'s own fixture is what actually holds the
* geometry.
*
* The bus outranks the vote, and not only by symmetry with `eventNodeId`: the
* two rules have to AGREE. A bus id carrying a stack prefix already puts the
* event in that bus's stack container via `groupByStack`, and `groupByEngine`
* then infers that container's engine from its children. A consumers-first
* rule could hand the event an engine its stack siblings disagree with, which
* drives that inference to `null` and orphans the whole stack container from
* every engine box. Deciding both from the same bus makes that unreachable.
*
* Ignores a neighbour with no `engine` of its own rather than treating it as a
* disagreement: `engine` is only stamped on a multi-engine parse, and on one
* of those every real node carries it, so an absent value means "not
* applicable", never "a different engine".
*
* Skips `absorbed` ids, so the vote is taken over exactly the neighbours that
* survive into the graph — the same set the emit loop below keeps. `absorbed`
* and `targets` really do overlap: a second Service Bus rule on one
* subscription reaches the first's `targets` via `consumersOf` while being
* absorbed by its own derivation.
*
* Counting one is wrong in BOTH directions, which is why the filter is not
* merely tidiness. As the only engine-carrying voter it supplies the stamp
* outright, branding the event with a node this same pass deletes. Alongside a
* surviving voter of a DIFFERENT engine it instead vetoes the one that is
* there, and a well-formed event silently loses its container.
*/
function resolveEventEngine(entry, nodesById, absorbed) {
	const busEngine = entry.busId ? nodesById.get(entry.busId)?.engine : void 0;
	if (busEngine) return busEngine;
	const voted = voteEngine([...entry.targets, ...entry.producerIds], nodesById, absorbed);
	if (voted !== null) return voted;
	return voteEngine(entry.emitterIds, nodesById, absorbed) ?? void 0;
}
/** The engine the voters agree on; `undefined` when they disagree, `null`
* when none of them carries one. */
function voteEngine(ids, nodesById, absorbed) {
	let engine = null;
	for (const id of ids) {
		if (absorbed.has(id)) continue;
		const candidate = nodesById.get(id)?.engine;
		if (!candidate) continue;
		if (engine === null) engine = candidate;
		else if (engine !== candidate) return void 0;
	}
	return engine;
}
/** Which deriver reads a consumer node, by the resource type each parser emits. */
var DERIVER_BY_TYPE = /* @__PURE__ */ new Map([
	["AWS::Events::Rule", deriveFromCfnRule],
	["aws_cloudwatch_event_rule", deriveFromTfRule],
	["aws:cloudwatch/eventRule:EventRule", deriveFromTfRule],
	["AWS::SNS::Subscription", deriveFromSnsSubscription],
	["aws_sns_topic_subscription", deriveFromSnsSubscription],
	["aws:sns/topicSubscription:TopicSubscription", deriveFromSnsSubscription],
	["google_pubsub_subscription", deriveFromPubsubSubscription],
	["google_eventarc_trigger", deriveFromEventarcTrigger],
	["azurerm_eventgrid_event_subscription", deriveFromEventGridSubscription],
	["azurerm_servicebus_subscription_rule", deriveFromServiceBusRule],
	["Microsoft.ServiceBus/namespaces/topics/subscriptions/rules", deriveFromServiceBusRule]
]);
/** ARM nests an Event Grid subscription under its scope, so its type is a family.
* `unknown` because a stored graph can predate the parser guard that keeps a
* Type-less CloudFormation resource out (#1434). */
function deriverFor(resourceType) {
	if (typeof resourceType !== "string") return void 0;
	const exact = DERIVER_BY_TYPE.get(resourceType);
	if (exact) return exact;
	return resourceType.startsWith("Microsoft.EventGrid/") && resourceType.endsWith("/eventSubscriptions") ? deriveFromEventGridSubscription : void 0;
}
/**
* Display-time pass: lift EventBridge rule patterns, SNS subscription filter
* policies, GCP Pub/Sub subscription filters, GCP Eventarc trigger matching
* criteria, Azure Event Grid subscription event types, and Azure Service Bus
* subscription-rule filters into first-class event nodes. One node per event
* type per bus/topic; the
* rule/subscription plumbing node is absorbed and its edges replaced by
* bus/topic -> event -> consumer EVENT_FLOW edges.
* Pure; returns the input unchanged when nothing is derivable.
*/
function extractEventFlows(graph) {
	if (!hasGraphArrays(graph)) return graph;
	const nodeIds = new Set(graph.nodes.map((n) => n.id));
	const neighbors = buildNeighborIndex(graph.edges);
	const containsParent = /* @__PURE__ */ new Map();
	for (const e of graph.edges) if (e.type === EdgeType.CONTAINS) containsParent.set(e.target, e.source);
	const nodesById = /* @__PURE__ */ new Map();
	for (const node of graph.nodes) nodesById.set(node.id, node);
	const subTopicOf = (subId) => {
		const subNode = nodesById.get(subId);
		if (subNode && subNode.resourceType === "azurerm_servicebus_subscription") return resolveTfRef(subNode.attributes.topic_id);
		return containsParent.get(subId) ?? null;
	};
	const pubsubTopics = /* @__PURE__ */ new Map();
	for (const node of graph.nodes) if (node.type === ResourceType.GCP_PUBSUB_TOPIC) {
		pubsubTopics.set(node.name, node.id);
		pubsubTopics.set(node.id, node.id);
	}
	const eventBuses = /* @__PURE__ */ new Map();
	for (const node of graph.nodes) {
		if (node.type !== ResourceType.EVENTBRIDGE_BUS) continue;
		eventBuses.set(node.name, eventBuses.has(node.name) ? null : node.id);
	}
	const derived = [];
	const targetsByRule = /* @__PURE__ */ new Map();
	for (const node of graph.nodes) {
		if (node.resourceType === "aws_cloudwatch_event_target") {
			const ruleId = resolveTfRef(node.attributes.rule);
			const targetId = resolveTfRef(node.attributes.arn);
			if (!ruleId) continue;
			let entry = targetsByRule.get(ruleId);
			if (!entry) {
				entry = {
					targetIds: [],
					absorbedIds: []
				};
				targetsByRule.set(ruleId, entry);
			}
			entry.absorbedIds.push(node.id);
			if (targetId && nodeIds.has(targetId)) entry.targetIds.push(targetId);
		}
		if (node.resourceType === "aws:cloudwatch/eventTarget:EventTarget") {
			const ruleId = soleNeighborOfType(node.id, ResourceType.EVENTBRIDGE_RULE, neighbors, nodesById);
			if (!ruleId) continue;
			let entry = targetsByRule.get(ruleId);
			if (!entry) {
				entry = {
					targetIds: [],
					absorbedIds: []
				};
				targetsByRule.set(ruleId, entry);
			}
			entry.absorbedIds.push(node.id);
			const arnRef = typeof node.attributes.arn === "string" ? node.attributes.arn : null;
			if (arnRef && nodeIds.has(arnRef)) entry.targetIds.push(arnRef);
			else for (const nb of neighbors.get(node.id) ?? []) if (nb !== ruleId) entry.targetIds.push(nb);
		}
	}
	const ctx = {
		nodeIds,
		neighbors,
		nodesById,
		targetsByRule,
		eventBuses,
		pubsubTopics,
		containsParent,
		subTopicOf
	};
	for (const node of graph.nodes) {
		const derive = deriverFor(node.resourceType);
		if (derive) derived.push(...derive(node, ctx));
	}
	const publishFacts = collectPublishFacts(graph.nodes);
	if (derived.length === 0 && publishFacts.length === 0) return graph;
	const schemaByTail = buildSchemaByTail(graph.nodes);
	const consumeFacts = collectConsumeFacts(graph.nodes);
	const events = /* @__PURE__ */ new Map();
	const absorbed = /* @__PURE__ */ new Set();
	for (const d of derived) {
		for (const id of d.absorbedIds) absorbed.add(id);
		const eventId = eventNodeId(d.busId, d.name);
		let entry = events.get(eventId);
		if (!entry) {
			entry = {
				node: {
					id: eventId,
					type: ResourceType.EVENT_TYPE,
					provider: d.provider,
					name: d.name,
					resourceType: "arcsync:event",
					attributes: {
						...d.attributes,
						derivedFrom: []
					}
				},
				targets: /* @__PURE__ */ new Set(),
				busId: d.busId,
				derivedFrom: [],
				producerIds: /* @__PURE__ */ new Set(),
				emitterIds: /* @__PURE__ */ new Set(),
				unconsumed: false
			};
			events.set(eventId, entry);
		}
		for (const t of d.targets) entry.targets.add(t);
		entry.derivedFrom.push(d.derivedFrom);
		const own = d.attributes.source;
		const pattern = d.attributes.pattern;
		const sources = typeof own === "string" ? [own] : stringValues(pattern?.source) ?? [];
		for (const source of sources) {
			const emitterType = AWS_SOURCE_EMITTERS.get(source);
			if (!emitterType) continue;
			for (const n of graph.nodes) if (n.type === emitterType) entry.emitterIds.add(n.id);
		}
	}
	const sameName = /* @__PURE__ */ new Map();
	const indexByName = (e) => {
		const list = sameName.get(e.node.name);
		if (list) list.push(e);
		else sameName.set(e.node.name, [e]);
	};
	for (const e of events.values()) indexByName(e);
	const withResolvedBus = publishFacts.map((fact) => ({
		fact,
		resolvedBusId: fact.busRef ? resolveBusRef(fact.busRef, fact.fnId, nodeIds, nodesById) : null
	}));
	const orderedFacts = [...withResolvedBus.filter((f) => f.resolvedBusId), ...withResolvedBus.filter((f) => !f.resolvedBusId)];
	for (const { fact, resolvedBusId } of orderedFacts) {
		let entry;
		let joinBusId = resolvedBusId;
		if (resolvedBusId) entry = events.get(eventNodeId(resolvedBusId, fact.eventName));
		else {
			const candidates = sameName.get(fact.eventName) ?? [];
			if (candidates.length > 1) continue;
			if (candidates.length === 1) {
				entry = candidates[0];
				joinBusId = entry.busId;
			} else joinBusId = null;
		}
		if (!entry) {
			const eventId = eventNodeId(joinBusId, fact.eventName);
			entry = {
				node: {
					id: eventId,
					type: ResourceType.EVENT_TYPE,
					provider: derivedProviderOf(joinBusId ? nodesById.get(joinBusId) : void 0),
					name: fact.eventName,
					resourceType: "arcsync:event",
					attributes: {
						eventType: fact.eventName,
						unconsumed: true,
						derivedFrom: []
					}
				},
				targets: /* @__PURE__ */ new Set(),
				busId: joinBusId,
				derivedFrom: [],
				producerIds: /* @__PURE__ */ new Set(),
				emitterIds: /* @__PURE__ */ new Set(),
				unconsumed: true
			};
			events.set(eventId, entry);
			indexByName(entry);
		}
		entry.producerIds.add(fact.fnId);
		if (fact.payloadShape) {
			const detailType = entry.node.attributes.detailType;
			if (!(typeof detailType === "string" && schemaByTail.has(detailType))) entry.node.attributes.payload = fact.payloadShape;
		}
	}
	const nodes = graph.nodes.filter((n) => !absorbed.has(n.id));
	const edges = graph.edges.filter((e) => !absorbed.has(e.source) && !absorbed.has(e.target));
	const consumerPayloads = resolveConsumerPayloads([...events.values()].map((e) => ({
		id: e.node.id,
		name: e.node.name,
		targets: e.targets
	})), consumeFacts, neighbors);
	let counter = 0;
	for (const entry of events.values()) {
		entry.node.attributes.derivedFrom = entry.derivedFrom;
		const detailType = entry.node.attributes.detailType;
		if (typeof detailType === "string" && schemaByTail.has(detailType)) entry.node.attributes.schema = schemaByTail.get(detailType);
		if (entry.node.attributes.payload === void 0 && entry.node.attributes.schema === void 0) {
			const consumed = consumerPayloads.get(entry.node.id);
			if (consumed) entry.node.attributes.payload = consumed;
		}
		const engine = resolveEventEngine(entry, nodesById, absorbed);
		if (engine) entry.node.engine = engine;
		nodes.push(entry.node);
		if (entry.busId) {
			counter++;
			edges.push(entry.unconsumed ? {
				id: `event-flow-${counter}`,
				source: entry.node.id,
				target: entry.busId,
				type: EdgeType.EVENT_FLOW
			} : {
				id: `event-flow-${counter}`,
				source: entry.busId,
				target: entry.node.id,
				type: EdgeType.EVENT_FLOW
			});
		}
		for (const target of entry.targets) {
			if (absorbed.has(target)) continue;
			counter++;
			edges.push({
				id: `event-flow-${counter}`,
				source: entry.node.id,
				target,
				type: EdgeType.EVENT_FLOW
			});
		}
		for (const producerId of /* @__PURE__ */ new Set([...entry.producerIds, ...entry.emitterIds])) {
			if (absorbed.has(producerId)) continue;
			counter++;
			edges.push({
				id: `event-flow-${counter}`,
				source: producerId,
				target: entry.node.id,
				type: EdgeType.EVENT_FLOW
			});
		}
	}
	return {
		...graph,
		nodes,
		edges
	};
}
//#endregion
export { extractEventFlows };
