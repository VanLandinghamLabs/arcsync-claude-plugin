import { EdgeType, ResourceType } from "./types.mjs";
import { lookupByType } from "./typeLookup.mjs";
import { FOLD_VERBS } from "./edgeSemantics.mjs";
import { fallbackRailFor, namesNode, railLabelFor, readAttribute, readAttributeEntry, readString, referenceToken } from "./fallbackRail.mjs";
//#region ../core/dist/graph/foldNetworkGlue.js
/**
* Folds a networking "join" resource into the node that owns it.
*
* A VPC template built by hand or by CDK emits roughly nine of these per
* NAT-instance VPC — `SubnetRouteTableAssociation`, `Route`,
* `VPCGatewayAttachment`, `InstanceProfile`. None of them is a thing anyone
* deploys FOR itself: each exists to state a relationship between two resources
* that are already on the diagram. Drawn as nodes they cost a card plus two
* edges to say what one labelled edge says, and they push the resources that
* matter apart to make room.
*
* So the pass removes the join and draws the relationship it encoded:
*
* - a subnet's route-table association becomes a `Subnet -> RouteTable` edge
*   verbed `routes via`;
* - a route becomes a `ROUTE` rail on its table plus a `RouteTable -> target`
*   edge verbed `routes 0.0.0.0/0`;
* - a gateway attachment becomes a `VPC -> gateway` edge verbed `attaches`;
* - an instance profile becomes a `PROFILE` rail on its instance.
*
* Display-time only, exactly like `foldFallbackNodes` and `collapseRouteTables`:
* it never writes the canonical stored graph, and the marker it leaves on an
* edge (`viaFold`) is unpersisted.
*
* WHAT IT KEYS ON, and why that is not `attributes`. `foldFallbackNodes` reads
* the parent's attribute bag because a dead-letter queue is named INSIDE a
* `redrive_policy` blob that no parser turns into an edge. A join resource is
* the opposite shape: its whole content is references (`RouteTableId`,
* `SubnetId`, `VpcId`, `GatewayId`), and every parser already turns each of
* those into a real reference EDGE. Reading the edges therefore covers strictly
* more graphs than reading attributes would — the two plan formats that resolve
* a reference to an ARN before `attributes` is built, and any graph whose
* attribute bags were stripped (every `__layout_qa__` fixture, an anonymised
* export) included. `attributes` is still read, for the CIDR and the lines a
* rail expands to, but never to decide the fold.
*
* Which end of the join is the PARENT is decided by resource type — an
* association is adjacent to exactly one route table and one subnet — so the
* pass never has to guess from attribute key order.
*/
/** Route target properties, in the precedence order a route resolves them.
* Normalized, so the CloudFormation (`GatewayId`), Terraform (`gateway_id`) and
* Pulumi (`gatewayId`) spellings all collapse onto one entry. */
var ROUTE_TARGET_KEYS = [
	"gatewayid",
	"instanceid",
	"natgatewayid",
	"transitgatewayid",
	"vpcpeeringconnectionid",
	"networkinterfaceid"
];
/** Destination properties a route's verb and rail name are built from. IPv6 is
* listed second so a dual-stack route reads as its IPv4 destination, which is
* the one an operator recognises. */
var ROUTE_DESTINATION_KEYS = [
	"destinationcidrblock",
	"destinationipv6cidrblock",
	"destinationprefixlistid"
];
/** Attribute keys an expanded `PROFILE` rail reports, in drawn order. */
var PROFILE_POLICY_KEYS = ["roles", "path"];
var GLUE_KIND_BY_TYPE = {
	[ResourceType.EC2_ROUTE_TABLE_ASSOCIATION]: "routeTableAssociation",
	[ResourceType.EC2_ROUTE]: "route",
	[ResourceType.EC2_INTERNET_GATEWAY_ATTACHMENT]: "gatewayAttachment",
	[ResourceType.IAM_INSTANCE_PROFILE]: "instanceProfile"
};
/**
* The same four joins, keyed off the RAW provider type string.
*
* Every one of these mapped to `ResourceType.UNKNOWN` until this change, and
* `type` is what a stored graph persists — so on the tens of thousands of
* graphs already in the table, and on every `__layout_qa__` fixture, the enum
* above matches nothing. Reading the raw string as well is what makes the fold
* fire on those retroactively instead of waiting for a re-parse, which is the
* same trade `foldFallbackNodes` makes when it prefers an attribute walk over
* its own parse-time `viaProperty` tag, and the same reason `displayFilter`
* keys plumbing off `resourceType` rather than off the enum.
*
* Consulted only when `type` is `UNKNOWN`: a re-parsed graph is classified, and
* a node the classifier gave a real type to must be trusted over a string match.
*/
var GLUE_KIND_BY_RESOURCE_TYPE = {
	"AWS::EC2::SubnetRouteTableAssociation": "routeTableAssociation",
	aws_route_table_association: "routeTableAssociation",
	"aws:ec2/routeTableAssociation:RouteTableAssociation": "routeTableAssociation",
	"AWS::EC2::Route": "route",
	aws_route: "route",
	"aws:ec2/route:Route": "route",
	"AWS::EC2::VPCGatewayAttachment": "gatewayAttachment",
	aws_internet_gateway_attachment: "gatewayAttachment",
	"aws:ec2/internetGatewayAttachment:InternetGatewayAttachment": "gatewayAttachment",
	"AWS::IAM::InstanceProfile": "instanceProfile",
	aws_iam_instance_profile: "instanceProfile",
	"aws:iam/instanceProfile:InstanceProfile": "instanceProfile",
	"AWS::EC2::SecurityGroupIngress": "securityGroupRule",
	"AWS::EC2::SecurityGroupEgress": "securityGroupRule",
	aws_security_group_rule: "securityGroupRule",
	aws_vpc_security_group_ingress_rule: "securityGroupRule",
	aws_vpc_security_group_egress_rule: "securityGroupRule",
	"aws:ec2/securityGroupRule:SecurityGroupRule": "securityGroupRule",
	"aws:vpc/securityGroupIngressRule:SecurityGroupIngressRule": "securityGroupRule",
	"aws:vpc/securityGroupEgressRule:SecurityGroupEgressRule": "securityGroupRule",
	"AWS::ElasticLoadBalancingV2::Listener": "listener",
	aws_lb_listener: "listener",
	aws_alb_listener: "listener",
	"aws:lb/listener:Listener": "listener",
	"aws:alb/listener:Listener": "listener",
	"AWS::EC2::NetworkAclEntry": "networkAclEntry",
	aws_network_acl_rule: "networkAclEntry",
	"aws:ec2/networkAclRule:NetworkAclRule": "networkAclEntry",
	"aws-native:ec2:NetworkAclEntry": "networkAclEntry",
	"AWS::EC2::SubnetNetworkAclAssociation": "networkAclAssociation",
	aws_network_acl_association: "networkAclAssociation",
	"aws:ec2/networkAclAssociation:NetworkAclAssociation": "networkAclAssociation",
	"aws-native:ec2:SubnetNetworkAclAssociation": "networkAclAssociation"
};
/** A NACL as a graph stored before `EC2_NETWORK_ACL` existed spells it. */
var NETWORK_ACL_RESOURCE_TYPES = /* @__PURE__ */ new Set([
	"AWS::EC2::NetworkAcl",
	"aws_network_acl",
	"aws_default_network_acl",
	"aws:ec2/networkAcl:NetworkAcl",
	"aws:ec2/defaultNetworkAcl:DefaultNetworkAcl",
	"aws-native:ec2:NetworkAcl"
]);
function isNetworkAcl(node) {
	return node.type === ResourceType.EC2_NETWORK_ACL || node.type === ResourceType.UNKNOWN && NETWORK_ACL_RESOURCE_TYPES.has(node.resourceType);
}
/**
* Which join `node` is, or `undefined` when it is not one.
*
* BOTH lookups are own-property guarded, including the one keyed on the enum.
* `type` is a plain string on a rehydrated graph — it is cast, never validated
* — so a stored node typed `constructor` or `toString` reads a prototype member
* back, which is truthy and would be treated as a join whose parent type is
* `undefined`, matching any type-less neighbour. Same class as the
* prototype-pollution write closed in #1111, and why both go through
* `lookupByType`.
*/
function glueKindOf(node) {
	const byType = lookupByType(GLUE_KIND_BY_TYPE, node.type);
	if (byType) return byType;
	if (node.type !== ResourceType.UNKNOWN) return void 0;
	return lookupByType(GLUE_KIND_BY_RESOURCE_TYPE, node.resourceType);
}
/** The type of node each kind folds INTO. A join adjacent to no node of its
* parent type is left alone — classified, but unfolded. */
var PARENT_TYPE_BY_KIND = {
	routeTableAssociation: ResourceType.EC2_ROUTE_TABLE,
	route: ResourceType.EC2_ROUTE_TABLE,
	gatewayAttachment: ResourceType.EC2_VPC,
	instanceProfile: ResourceType.EC2_INSTANCE,
	securityGroupRule: ResourceType.EC2_SECURITY_GROUP,
	listener: ResourceType.ELB_LOAD_BALANCER,
	networkAclEntry: ResourceType.EC2_NETWORK_ACL,
	networkAclAssociation: ResourceType.EC2_NETWORK_ACL
};
function isParentOf(kind, node) {
	const type = PARENT_TYPE_BY_KIND[kind];
	return type === ResourceType.EC2_NETWORK_ACL ? isNetworkAcl(node) : node.type === type;
}
/** Whether an edge participates in the "would folding strand anything?" test.
* Containment is excluded for `foldFallbackNodes`' reason: a join's CONTAINS
* edge from its stack goes with it, and counting it would block every fold in a
* multi-stack graph. */
function isStructural(edge) {
	return edge.type !== EdgeType.CONTAINS;
}
/** First attribute value under any of `wanted`, with the key AS THE PARSER
* SPELLED IT — a rail line reads `DestinationCidrBlock 0.0.0.0/0` on a
* CloudFormation graph and `destination_cidr_block 0.0.0.0/0` on a Terraform
* one, which is what an operator greps their own source for. */
function attributeUnder(attributes, wanted) {
	for (const want of wanted) {
		const found = readAttributeEntry(attributes, want);
		if (found) return found;
	}
}
/**
* An attribute value rendered for a rail line.
*
* A reference arrives as `{ Ref: "PublicRouteTable" }` (CloudFormation),
* `${aws_internet_gateway.igw.id}` (Terraform) or an unknown-output sentinel (a
* plan). Printing the raw JSON of any of those is worse than printing nothing,
* so a non-scalar is reported through `fallbackName` — the resolved node's own
* name, which the edge already established — and dropped when there is none.
*/
function railValue(value, fallbackName) {
	if (typeof value === "string") return value.startsWith("${") ? fallbackName : value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (Array.isArray(value)) {
		const parts = value.map((item) => railValue(item, fallbackName)).filter(Boolean);
		return parts.length > 0 ? parts.join(", ") : fallbackName;
	}
	return fallbackName;
}
/** Key for one ORDERED endpoint pair.
*
* Node ids come from IaC logical ids and resource addresses, which can contain
* almost anything, so the separator is a character that cannot appear in one.
* Built with `String.fromCharCode` rather than typed as a literal for the
* reason `foldFallbackNodes`' `PATH_SEP` is: a raw NUL byte in a source file
* survives every editor and review tool that renders it as nothing, and this
* module shipped three of them before a test that split on the separator
* noticed. */
var PAIR_SEP = String.fromCharCode(0);
function orderedPairKey(source, target) {
	return `${source}${PAIR_SEP}${target}`;
}
/**
* Destinations a merged label spells out before it starts counting.
*
* A dual-stack table is the common case at 2, and 3 covers one sending a couple
* of named prefixes through a single NAT. Past that the label stops being a
* label: a transit-gateway table with twenty CIDRs to one attachment would
* compose a caption longer than the diagram is wide, and an unreadable caption
* on the edge this pass exists to make readable is worse than the parallel
* lines it replaced.
*
* The overflow reads `+N more`, the idiom the card footer already uses for its
* property overflow, and every destination is still spelled out in full on the
* table's own `ROUTE` rails.
*/
var MERGED_DETAIL_LIMIT = 3;
/** One merged pair's drawn caption. */
function mergedLabel(pair) {
	if (pair.details.length === 0) return pair.verb;
	if (pair.details.length <= MERGED_DETAIL_LIMIT) return `${pair.verb} ${pair.details.join(", ")}`;
	const shown = pair.details.slice(0, MERGED_DETAIL_LIMIT).join(", ");
	return `${pair.verb} ${shown} +${pair.details.length - MERGED_DETAIL_LIMIT} more`;
}
function foldNetworkGlue(graph, options) {
	const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
	const neighbours = /* @__PURE__ */ new Map();
	const containerIds = /* @__PURE__ */ new Set();
	const naclSubnetEdgeIds = /* @__PURE__ */ new Set();
	for (const edge of graph.edges) {
		if (edge.type === EdgeType.CONTAINS) {
			containerIds.add(edge.source);
			continue;
		}
		const source = nodeById.get(edge.source);
		const target = nodeById.get(edge.target);
		if (!source || !target) continue;
		if (isNetworkAcl(source) && target.type === ResourceType.EC2_SUBNET && isSubnetListEdge(source, target)) naclSubnetEdgeIds.add(edge.id);
		const from = neighbours.get(edge.source);
		if (from) from.push({
			edge,
			node: target
		});
		else neighbours.set(edge.source, [{
			edge,
			node: target
		}]);
		const to = neighbours.get(edge.target);
		if (to) to.push({
			edge,
			node: source
		});
		else neighbours.set(edge.target, [{
			edge,
			node: source
		}]);
	}
	const folds = [];
	const foldedIds = /* @__PURE__ */ new Set();
	/** Eligible joins per parent, counted BEFORE `unfoldedParents` is consulted
	* — see `ResourceNode.networkGlue`. */
	const glueCounts = /* @__PURE__ */ new Map();
	for (const node of graph.nodes) {
		const kind = glueKindOf(node);
		if (!kind) continue;
		if (containerIds.has(node.id)) continue;
		const structural = (neighbours.get(node.id) ?? []).filter((n) => isStructural(n.edge));
		const parent = kind === "securityGroupRule" ? securityGroupRuleOwner(node, structural) : structural.find((n) => isParentOf(kind, n.node))?.node;
		if (!parent) continue;
		if (parent.routeTable) continue;
		if (options?.skipParents?.has(parent.id)) continue;
		const others = structural.filter((n) => n.node.id !== parent.id);
		if (others.length > 1) continue;
		const other = others[0]?.node;
		if (other && options?.skipParents?.has(other.id)) continue;
		const fold = resolveFold(node, kind, parent, other);
		if (!fold) continue;
		glueCounts.set(parent.id, (glueCounts.get(parent.id) ?? 0) + 1);
		if (options?.unfoldedParents?.has(parent.id)) continue;
		folds.push(fold);
		foldedIds.add(node.id);
	}
	for (const node of graph.nodes) {
		if (!isNetworkAcl(node) || options?.skipParents?.has(node.id)) continue;
		for (const key of ["ingress", "egress"]) {
			const blocks = readAttribute(node.attributes, key);
			if (!Array.isArray(blocks)) continue;
			blocks.forEach((block, i) => {
				if (!block || typeof block !== "object") return;
				const id = `${node.id}/${key}[${i}]`;
				const cidr = attributeUnder(block, NACL_CIDR_KEYS)?.value;
				const peer = cidr === void 0 ? void 0 : graph.nodes.find((n) => referenceNames(cidr, n));
				const entry = naclEntryRail({
					id,
					name: id
				}, block, key === "egress", peer?.name);
				folds.push({
					glue: node,
					kind: "networkAclEntry",
					parent: node,
					...entry
				});
			});
		}
	}
	if (folds.length === 0 && glueCounts.size === 0 && naclSubnetEdgeIds.size === 0) return graph;
	const railsByParent = /* @__PURE__ */ new Map();
	for (const kind of [
		"route",
		"instanceProfile",
		"securityGroupRule",
		"listener",
		"networkAclEntry"
	]) {
		const ofKind = folds.filter((fold) => fold.kind === kind && fold.rail);
		if (kind === "networkAclEntry") ofKind.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		for (const fold of ofKind) {
			const rails = railsByParent.get(fold.parent.id);
			if (rails) rails.push(fold.rail);
			else railsByParent.set(fold.parent.id, [fold.rail]);
		}
	}
	const survivingEdges = graph.edges.filter((e) => !foldedIds.has(e.source) && !foldedIds.has(e.target)).map((e) => naclSubnetEdgeIds.has(e.id) ? {
		...e,
		source: e.target,
		target: e.source,
		label: FOLD_VERBS.networkAclAssociation,
		viaFold: "networkAclAssociation"
	} : e);
	const existingByPair = /* @__PURE__ */ new Map();
	for (const edge of survivingEdges) {
		if (edge.type === EdgeType.CONTAINS) continue;
		existingByPair.set(orderedPairKey(edge.source, edge.target), edge);
	}
	const merged = /* @__PURE__ */ new Map();
	for (const fold of folds) {
		if (!fold.mint) continue;
		const { source, target, verb, detail, via } = fold.mint;
		const key = orderedPairKey(source, target);
		if (!existingByPair.has(key) && existingByPair.has(orderedPairKey(target, source))) continue;
		const held = merged.get(key);
		if (!held) {
			const details = detail ? [detail] : [];
			merged.set(key, {
				source,
				target,
				verb,
				details,
				via,
				glueId: fold.glue.id
			});
			continue;
		}
		if (detail && !held.details.includes(detail)) held.details.push(detail);
	}
	const relabelled = /* @__PURE__ */ new Map();
	const minted = [];
	for (const [key, pair] of merged) {
		const label = mergedLabel(pair);
		const held = existingByPair.get(key);
		if (held) {
			relabelled.set(held.id, {
				verb: label,
				via: pair.via
			});
			continue;
		}
		minted.push({
			id: `fold-${pair.glueId}`,
			source: pair.source,
			target: pair.target,
			type: EdgeType.REFERENCE,
			label,
			viaFold: pair.via
		});
	}
	return {
		...graph,
		nodes: graph.nodes.filter((n) => !foldedIds.has(n.id)).map((n) => {
			const count = glueCounts.get(n.id);
			const rails = railsByParent.get(n.id);
			if (!count && !rails) return n;
			return {
				...n,
				...count ? { networkGlue: count } : {},
				...rails ? { fallbackRails: [...n.fallbackRails ?? [], ...rails] } : {}
			};
		}),
		edges: [...survivingEdges.map((e) => {
			const label = relabelled.get(e.id);
			return label ? {
				...e,
				label: label.verb,
				viaFold: label.via
			} : e;
		}), ...minted]
	};
}
/** Build the rail and the minted edge for one resolved join, or `undefined`
* when the join carries nothing worth drawing. */
function resolveFold(glue, kind, parent, other) {
	if (kind === "routeTableAssociation" || kind === "networkAclAssociation") {
		if (other?.type !== ResourceType.EC2_SUBNET) return void 0;
		return {
			glue,
			kind,
			parent,
			mint: {
				source: other.id,
				target: parent.id,
				verb: FOLD_VERBS[kind],
				via: kind
			}
		};
	}
	if (kind === "networkAclEntry") {
		const cidr = attributeUnder(glue.attributes, NACL_CIDR_KEYS)?.value;
		if (other && !referenceNames(cidr, other)) return void 0;
		const egress = readAttribute(glue.attributes, "egress");
		return {
			glue,
			kind,
			parent,
			...naclEntryRail(glue, glue.attributes, egress === true || egress === "true", other?.name)
		};
	}
	if (kind === "gatewayAttachment") {
		if (!other) return void 0;
		return {
			glue,
			kind,
			parent,
			mint: {
				source: parent.id,
				target: other.id,
				verb: FOLD_VERBS.gatewayAttachment,
				via: "gatewayAttachment"
			}
		};
	}
	if (kind === "instanceProfile") {
		if (other && other.type !== ResourceType.IAM_ROLE) return void 0;
		return {
			glue,
			kind,
			parent,
			rail: profileRail(glue, other)
		};
	}
	if (kind === "securityGroupRule") return securityGroupRuleFold(glue, parent, other);
	if (kind === "listener") return listenerFold(glue, parent, other);
	const destination = attributeUnder(glue.attributes, ROUTE_DESTINATION_KEYS);
	const cidr = destination ? railValue(destination.value) : void 0;
	return {
		glue,
		kind,
		parent,
		rail: routeRail(glue, destination, cidr, other),
		mint: other ? {
			source: parent.id,
			target: other.id,
			verb: FOLD_VERBS.route,
			detail: cidr,
			via: "route"
		} : void 0
	};
}
/** `ROUTE` rail: `0.0.0.0/0 -> IGW`, expanding to the destination and target
* properties as the template spelled them. */
function routeRail(glue, destination, cidr, target) {
	const policy = [];
	if (destination && cidr) policy.push(`${destination.key} ${cidr}`);
	const targetAttribute = attributeUnder(glue.attributes, ROUTE_TARGET_KEYS);
	if (targetAttribute) {
		const value = railValue(targetAttribute.value, target?.name);
		if (value) policy.push(`${targetAttribute.key} ${value}`);
	}
	const name = [cidr, target?.name].filter(Boolean).join(" → ");
	return fallbackRailFor(glue, railLabelFor("route"), policy, name || glue.name);
}
/** `PROFILE` rail: the profile's name, expanding to the role it carries. */
function profileRail(glue, role) {
	const policy = [];
	for (const key of PROFILE_POLICY_KEYS) {
		const found = attributeUnder(glue.attributes, [key]);
		if (!found) continue;
		const value = railValue(found.value, role?.name);
		if (value) policy.push(`${found.key} ${value}`);
	}
	return fallbackRailFor(glue, railLabelFor("instanceprofile"), policy);
}
/** The rule's own group, and the group on its other side. A rule between two
* groups references both, so type alone cannot say which one owns it. */
var SG_OWNER_KEYS = ["groupid", "securitygroupid"];
var SG_PEER_KEYS = [
	"sourcesecuritygroupid",
	"destinationsecuritygroupid",
	"referencedsecuritygroupid"
];
var SG_CIDR_KEYS = [
	"cidrip",
	"cidripv6",
	"cidrblocks",
	"ipv6cidrblocks",
	"cidripv4",
	"sourceprefixlistid",
	"destinationprefixlistid",
	"prefixlistids",
	"prefixlistid"
];
function securityGroupRuleOwner(rule, structural) {
	const groups = [...new Set(structural.filter((n) => n.node.type === ResourceType.EC2_SECURITY_GROUP).map((n) => n.node))];
	if (groups.length === 0) return void 0;
	const ownerToken = referenceToken(attributeUnder(rule.attributes, SG_OWNER_KEYS)?.value);
	const named = ownerToken ? groups.find((g) => namesNode(ownerToken, g)) : void 0;
	if (named) return named;
	if (groups.length !== 1) return void 0;
	const peerToken = referenceToken(attributeUnder(rule.attributes, SG_PEER_KEYS)?.value);
	return ownerToken && peerToken && namesNode(peerToken, groups[0]) ? void 0 : groups[0];
}
/** Whether a rule lets traffic out rather than in. One Terraform type covers
* both and says which in its `type` attribute. */
function isEgressRule(rule) {
	const raw = rule.resourceType ?? "";
	if (/egress/i.test(raw)) return true;
	if (/ingress/i.test(raw)) return false;
	return attributeUnder(rule.attributes, ["type"])?.value === "egress";
}
/** `tcp 5432`, `all`, `tcp 8000-8080`. */
function trafficOf(rule) {
	const protocol = railValue(attributeUnder(rule.attributes, ["ipprotocol", "protocol"])?.value);
	const from = railValue(attributeUnder(rule.attributes, ["fromport"])?.value);
	const to = railValue(attributeUnder(rule.attributes, ["toport"])?.value);
	const allTraffic = protocol === "-1" || protocol?.toLowerCase() === "all";
	const ports = allTraffic || !from ? void 0 : !to || to === from ? from : `${from}-${to}`;
	return [allTraffic ? "all" : protocol?.toLowerCase(), ports].filter(Boolean).join(" ");
}
function securityGroupRuleFold(glue, parent, other) {
	if (other && other.type !== ResourceType.EC2_SECURITY_GROUP) return void 0;
	const egress = isEgressRule(glue);
	const traffic = trafficOf(glue);
	const cidr = attributeUnder(glue.attributes, SG_CIDR_KEYS);
	const cidrValue = cidr ? railValue(cidr.value) : void 0;
	const peerToken = referenceToken(attributeUnder(glue.attributes, SG_PEER_KEYS)?.value);
	const self = !other && peerToken !== void 0 && namesNode(peerToken, parent);
	const peer = other?.name ?? (self ? parent.name : cidrValue);
	const name = [traffic, peer ? `${egress ? "→" : "←"} ${peer}` : void 0].filter(Boolean).join(" ");
	const policy = [];
	const description = attributeUnder(glue.attributes, ["description"]);
	const descriptionValue = description ? railValue(description.value) : void 0;
	if (description && descriptionValue) policy.push(`${description.key} ${descriptionValue}`);
	if (traffic) policy.push(traffic);
	if (cidr && cidrValue) policy.push(`${cidr.key} ${cidrValue}`);
	const rail = fallbackRailFor(glue, railLabelFor(egress ? "egress" : "ingress"), policy, name || void 0);
	if (!other) return {
		glue,
		kind: "securityGroupRule",
		parent,
		rail
	};
	return {
		glue,
		kind: "securityGroupRule",
		parent,
		rail,
		mint: {
			source: egress ? parent.id : other.id,
			target: egress ? other.id : parent.id,
			verb: FOLD_VERBS.securityGroupRule,
			detail: traffic || void 0,
			via: "securityGroupRule"
		}
	};
}
/** Target groups have no `ResourceType` of their own, so a listener's one
* permitted neighbour besides its load balancer is matched by raw type. */
var TARGET_GROUP_TYPES = /* @__PURE__ */ new Set([
	"AWS::ElasticLoadBalancingV2::TargetGroup",
	"aws_lb_target_group",
	"aws_alb_target_group",
	"aws:lb/targetGroup:TargetGroup",
	"aws:alb/targetGroup:TargetGroup"
]);
/** `LISTENER` rail reading `HTTPS 443`, plus a `LB -> target group` edge for
* the default forward. A listener reaching anything else (a certificate, an
* alarm, a rule) keeps its card: this pass has no verb for those. */
function listenerFold(glue, parent, other) {
	if (other && !TARGET_GROUP_TYPES.has(other.resourceType ?? "")) return void 0;
	const protocol = attributeUnder(glue.attributes, ["protocol"]);
	const port = attributeUnder(glue.attributes, ["port"]);
	const protocolValue = protocol ? railValue(protocol.value) : void 0;
	const portValue = port ? railValue(port.value) : void 0;
	const policy = [];
	if (protocol && protocolValue) policy.push(`${protocol.key} ${protocolValue}`);
	if (port && portValue) policy.push(`${port.key} ${portValue}`);
	const detail = [protocolValue, portValue].filter(Boolean).join(" ");
	const rail = fallbackRailFor(glue, railLabelFor("listener"), policy, detail || void 0);
	if (!other) return {
		glue,
		kind: "listener",
		parent,
		rail
	};
	return {
		glue,
		kind: "listener",
		parent,
		rail,
		mint: {
			source: parent.id,
			target: other.id,
			verb: FOLD_VERBS.listener,
			detail: detail || void 0,
			via: "listener"
		}
	};
}
var NACL_CIDR_KEYS = ["cidrblock", "ipv6cidrblock"];
/** Whether a reference names `node`, read loosely enough to accept the
* attribute forms a CIDR or subnet list uses: `${aws_vpc.main.cidr_block}`,
* `{ "Fn::GetAtt": ["Vpc", "CidrBlock"] }`, `${aws_subnet.a.id}`. */
function referenceNames(value, node) {
	const token = referenceToken(value);
	if (!token) return false;
	if (namesNode(token, node)) return true;
	return typeof value === "string" && namesNode(token.replace(/\.[^.]+$/, ""), node);
}
/** What a Pulumi plan writes for an input it cannot resolve yet. */
var PULUMI_UNKNOWN = "04da6b54-80e4-46f7-96ec-b56ff0331ba9";
/** Whether a Terraform expression (`${aws_subnet.a[*].id}`, `${concat(...)}`,
* `${[for s in aws_subnet.a : s.id]}`) mentions `address` as a whole address. */
function mentionsAddress(value, address) {
	if (typeof value !== "string" || !value.startsWith("${")) return false;
	const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(^|[^\\w.])${escaped}(\\W|$)`).test(value);
}
/** Whether an `ACL -> Subnet` reference edge is the ACL's own `subnet_ids`.
* A rule CIDR or a `depends_on` can reference a subnet too, and must not read
* as an association. An item names the subnet by reference, by address inside
* an expression, or by the resolved id a Terraform plan carries. An item a
* Pulumi plan could not resolve yet may be any subnet whose id is unknown. */
function isSubnetListEdge(acl, subnet) {
	const raw = readAttribute(acl.attributes, "subnetids");
	const items = Array.isArray(raw) ? raw : raw === void 0 ? [] : [raw];
	const address = subnet.id.slice(subnet.id.lastIndexOf("/") + 1).replace(/#\d+$/, "");
	const resolvedId = readString(subnet.attributes, "id");
	return items.some((item) => referenceNames(item, subnet) || mentionsAddress(item, address) || resolvedId !== void 0 && item === resolvedId) || resolvedId === void 0 && items.includes("04da6b54-80e4-46f7-96ec-b56ff0331ba9");
}
/** IANA numbers a NACL entry spells its protocol with (`-1` is every protocol). */
var NACL_PROTOCOLS = {
	"-1": "all",
	"1": "icmp",
	"6": "tcp",
	"17": "udp",
	"58": "icmpv6"
};
/**
* One NACL entry as a rail reading `#105 allow tcp 443 → 0.0.0.0/0`: the SG
* rule's `traffic arrow peer` row, led by the rule number and action that make
* a NACL ordered and stateless. `order` sorts ingress before egress and each by
* rule number; an unnumbered entry goes last, where AWS keeps its `*` rule.
* Reads a CloudFormation/aws-native entry, a Terraform or Pulumi rule resource,
* and an inline `ingress`/`egress` block alike.
*/
function naclEntryRail(entry, attributes, egress, peerName) {
	const value = (keys, fallbackName) => {
		const found = attributeUnder(attributes, keys);
		const shown = found ? railValue(found.value, fallbackName) : void 0;
		return found && shown ? {
			key: found.key,
			shown
		} : void 0;
	};
	const number = value(["rulenumber", "ruleno"]);
	const action = value(["ruleaction", "action"]);
	const cidr = value(NACL_CIDR_KEYS, peerName);
	const raw = value(["protocol"])?.shown.toLowerCase();
	const protocol = raw ? lookupByType(NACL_PROTOCOLS, raw) ?? raw : void 0;
	const range = readAttribute(attributes, "portrange");
	const from = railValue(readAttribute(range ?? attributes, range ? "from" : "fromport"));
	const to = railValue(readAttribute(range ?? attributes, range ? "to" : "toport"));
	const traffic = [protocol, (protocol === "tcp" || protocol === "udp") && from ? !to || to === from ? from : `${from}-${to}` : void 0].filter(Boolean).join(" ");
	const name = [
		number && `#${number.shown}`,
		action?.shown,
		traffic,
		cidr && `${egress ? "→" : "←"} ${cidr.shown}`
	].filter(Boolean).join(" ");
	const policy = [
		number && `${number.key} ${number.shown}`,
		action && `${action.key} ${action.shown}`,
		traffic,
		cidr && `${cidr.key} ${cidr.shown}`
	].filter((line) => !!line);
	const rank = Number(number?.shown);
	return {
		rail: fallbackRailFor(entry, railLabelFor(egress ? "egress" : "ingress"), policy, name || void 0),
		order: (egress ? 1e5 : 0) + (Number.isInteger(rank) ? rank : 65536)
	};
}
//#endregion
export { PULUMI_UNKNOWN, foldNetworkGlue };
