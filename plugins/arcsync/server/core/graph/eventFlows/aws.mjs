import { ResourceType } from "../types.mjs";
import { consumersOf, soleNeighborOfType } from "./context.mjs";
import { parsePattern, resolveTfRef, scopedCfnRef, stringValues } from "./refs.mjs";
//#region ../core/dist/graph/eventFlows/aws.js
/**
* AWS event derivations: EventBridge rules (CloudFormation and Terraform
* spellings) and SNS subscription filter policies.
*/
function eventsFromRulePattern(pattern, base, ruleName) {
	const detailTypes = stringValues(pattern["detail-type"]);
	if (detailTypes) return detailTypes.map((dt) => ({
		...base,
		name: dt,
		attributes: {
			detailType: dt,
			pattern
		}
	}));
	const sources = stringValues(pattern.source);
	if (sources) return sources.map((s) => ({
		...base,
		name: `source: ${s}`,
		attributes: {
			source: s,
			pattern
		}
	}));
	return [{
		...base,
		name: `${ruleName} pattern`,
		attributes: { pattern }
	}];
}
function deriveFromCfnRule(rule, { nodeIds, eventBuses }) {
	const attrs = rule.attributes;
	const pattern = parsePattern(attrs.EventPattern);
	if (!pattern) return [];
	const busId = scopedCfnRef(attrs.EventBusName, rule.id, nodeIds) ?? (typeof attrs.EventBusName === "string" ? eventBuses.get(attrs.EventBusName) ?? null : null);
	const targets = [];
	if (Array.isArray(attrs.Targets)) for (const t of attrs.Targets) {
		const id = scopedCfnRef(t?.Arn, rule.id, nodeIds);
		if (id) targets.push(id);
	}
	return eventsFromRulePattern(pattern, {
		busId,
		targets,
		absorbedIds: [rule.id],
		derivedFrom: rule.id,
		provider: "aws"
	}, rule.name);
}
function deriveFromTfRule(rule, { nodeIds, targetsByRule, eventBuses, neighbors, nodesById }) {
	const pattern = parsePattern(rule.attributes.event_pattern ?? rule.attributes.eventPattern);
	if (!pattern) return [];
	const busAttr = rule.attributes.event_bus_name ?? rule.attributes.eventBusName;
	const busRef = resolveTfRef(busAttr);
	let busId = busRef && nodeIds.has(busRef) ? busRef : null;
	if (!busId && typeof busAttr === "string") busId = eventBuses.get(busAttr) ?? null;
	if (!busId && rule.resourceType === "aws:cloudwatch/eventRule:EventRule") busId = soleNeighborOfType(rule.id, ResourceType.EVENTBRIDGE_BUS, neighbors, nodesById);
	const linked = targetsByRule.get(rule.id) ?? {
		targetIds: [],
		absorbedIds: []
	};
	return eventsFromRulePattern(pattern, {
		busId,
		targets: linked.targetIds,
		absorbedIds: [rule.id, ...linked.absorbedIds],
		derivedFrom: rule.id,
		provider: "aws"
	}, rule.name);
}
function deriveFromSnsSubscription(sub, { nodeIds, neighbors, nodesById }) {
	const isCfn = sub.resourceType === "AWS::SNS::Subscription";
	const isPulumi = sub.resourceType === "aws:sns/topicSubscription:TopicSubscription";
	const rawPolicy = isCfn ? sub.attributes.FilterPolicy : sub.attributes.filter_policy ?? sub.attributes.filterPolicy;
	const policy = parsePattern(rawPolicy);
	if (!policy || Object.keys(policy).length === 0) return [];
	let topicRef = isCfn ? scopedCfnRef(sub.attributes.TopicArn, sub.id, nodeIds) : resolveTfRef(sub.attributes.topic_arn ?? sub.attributes.topic);
	let endpointRef = isCfn ? scopedCfnRef(sub.attributes.Endpoint, sub.id, nodeIds) : resolveTfRef(sub.attributes.endpoint);
	if (isPulumi) {
		topicRef ??= soleNeighborOfType(sub.id, ResourceType.SNS_TOPIC, neighbors, nodesById);
		if (!endpointRef) {
			const busId0 = topicRef && nodeIds.has(topicRef) ? topicRef : null;
			const others = consumersOf(sub.id, /* @__PURE__ */ new Set([sub.id, busId0]), neighbors);
			endpointRef = others.length === 1 ? others[0] : null;
		}
	}
	const base = {
		busId: topicRef && nodeIds.has(topicRef) ? topicRef : null,
		targets: endpointRef && nodeIds.has(endpointRef) ? [endpointRef] : [],
		absorbedIds: [sub.id],
		derivedFrom: sub.id,
		provider: "aws"
	};
	const keys = Object.keys(policy);
	const soleValues = keys.length === 1 ? stringValues(policy[keys[0]]) : null;
	if (soleValues) return soleValues.map((v) => ({
		...base,
		name: v,
		attributes: { filterPolicy: policy }
	}));
	return [{
		...base,
		name: `${sub.name} filter`,
		attributes: { filterPolicy: policy }
	}];
}
//#endregion
export { deriveFromCfnRule, deriveFromSnsSubscription, deriveFromTfRule };
