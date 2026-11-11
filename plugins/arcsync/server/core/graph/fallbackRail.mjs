//#region ../core/dist/graph/fallbackRail.js
/**
* Attribute keys that name a CloudWatch log group rather than a queue or a
* function. A log group is hidden as a node and leaves its name on its owner's
* rail, so the tag has to say `LOGS` and not `DLQ`.
*/
var FALLBACK_LOG_KEYS = /* @__PURE__ */ new Set([
	"loggroup",
	"loggroupname",
	"loggingconfig",
	"logconfiguration"
]);
/** Attribute keys are compared case- and separator-insensitively, so one entry
* covers the CloudFormation, Terraform and Pulumi spellings of a property. */
function normalizeKey(key) {
	return key.toLowerCase().replace(/[_-]/g, "");
}
/**
* Keys whose subtree declares a fallback target — matched against attribute
* keys by `foldFallbackNodes`' walk, and against `ResourceEdge.viaProperty` by
* its `declaredByEdge`. Normalized (lowercase,
* `_`/`-` stripped) so CloudFormation's `RedrivePolicy`, Terraform's
* `redrive_policy` and Pulumi's `redrivePolicy` all collapse to one entry.
* Kept here rather than in `foldFallbackNodes` so `isFallbackProperty`'s
* readers do not pull that whole pass into their chunk.
*
* `redriveallowpolicy` is deliberately absent: it names the queues allowed to
* redrive INTO this one — the reverse direction — so folding on it would swallow
* a real source queue.
*/
var FALLBACK_KEYS = /* @__PURE__ */ new Set([
	"redrivepolicy",
	"deadletterconfig",
	"deadletterqueue",
	"deadlettertarget",
	"deadlettertargetarn",
	"deadletterarn",
	"onfailure",
	"forwarddeadletteredmessagesto",
	"deadletterdestination",
	...FALLBACK_LOG_KEYS
]);
/**
* Whether a parser should record `property` as an edge's `viaProperty`.
*
* The Terraform plan and ARM parsers tag ONLY fallback-keyed properties, never
* every reference. The Pulumi plan parser is the exception (#2936): its inputs
* keep no reference at all, so it tags every edge, preferring a fallback key
* when several properties name one target, and every reader that treats a tag
* as meaning something tests it with this function. Why the others tag only
* fallback keys:
*
* - It makes the choice order-independent. Both callers keep the first property
*   that names a given target, and a DLQ referenced from some other property
*   too (a `policy`, a `tags` blob) would otherwise win or lose on JSON key
*   order and silently stop folding.
* - `viaProperty` is PERSISTED. Tagging every edge grows the canonical graph by
*   ~37 bytes per edge, and `writeHistorySnapshot` stores `graphData` inline in
*   a DynamoDB item against a hard 400 KB cap with no S3 fallback.
* - The field reaches anonymous gallery viewers through the public read, which
*   filters nodes and edges by predicate but never picks fields. Recording only
*   what the fold needs keeps that surface to a handful of known key names.
*/
function isFallbackProperty(property) {
	return FALLBACK_KEYS.has(normalizeKey(property));
}
/** One property by normalized key, so a CloudFormation `MinCapacity` and a
* Terraform `min_capacity` reach the same reader. The folds' one shared
* reader: a fix here reaches every fold. */
function readAttribute(bag, wanted) {
	return readAttributeEntry(bag, wanted)?.value;
}
/** `readAttribute`, plus the key as the parser spelled it. */
function readAttributeEntry(bag, wanted) {
	if (!bag) return void 0;
	for (const [key, value] of Object.entries(bag)) if (normalizeKey(key) === wanted) return {
		key,
		value
	};
}
function readString(bag, wanted) {
	const value = readAttribute(bag, wanted);
	return typeof value === "string" && value.length > 0 ? value : void 0;
}
/**
* The rail's short type tag.
*
* Keyed off the normalized attribute key that declared a fallback fold, or —
* for `foldNetworkGlue`, which keys on reference edges rather than on a bag —
* off the join RESOURCE's own name. One switch rather than a table per pass:
* the tag drives `fallbackRailNameLeft`, so two tables is how one renderer
* would start reserving a width the other does not.
*/
function railLabelFor(key) {
	if (FALLBACK_LOG_KEYS.has(key)) return "LOGS";
	if (key === "onfailure") return "ON FAIL";
	if (key === "route") return "ROUTE";
	if (key === "instanceprofile") return "PROFILE";
	if (key === "subscription") return "SUB";
	if (key === "target") return "TARGET";
	if (key === "ingress") return "INGRESS";
	if (key === "egress") return "EGRESS";
	if (key === "listener") return "LISTENER";
	if (key === "invokeconfig") return "ASYNC";
	return "DLQ";
}
/**
* One rail, from the node it folds.
*
* Exported so every producer builds the shape through exactly this function
* rather than assembling it by hand — `displayFilter`'s log-group
* compensation, `foldFallbackNodes`' own fold, and `foldNetworkGlue`'s two
* networking rails all write the same four fields, and a hand-built one is how
* their contents would quietly start disagreeing.
*
* `policy` is the caller's, not derived here: a dead-letter rail expands to a
* redrive policy, a route's to its destination and target, and there is no
* shared reading of a folded node that produces both.
*/
function fallbackRailFor(folded, label, policy, name) {
	return {
		nodeId: folded.id,
		name: name ?? folded.name,
		label,
		policy
	};
}
/** The logical id a reference names: `{ Ref: X }`, `{ "Fn::GetAtt": [X, ...] }`,
* `${aws_sqs_queue.x.arn}`, or a literal id. */
function referenceToken(value) {
	if (typeof value === "string") {
		if (!value.startsWith("${")) return value || void 0;
		return value.slice(2, -1).replace(/\[[^\]]*\]/g, "").replace(/\.(id|arn)$/, "");
	}
	if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
	const ref = value.Ref;
	if (typeof ref === "string") return ref;
	const getAtt = value["Fn::GetAtt"];
	if (Array.isArray(getAtt) && typeof getAtt[0] === "string") return getAtt[0];
	if (typeof getAtt === "string") return getAtt.split(".")[0];
}
function namesNode(token, node) {
	return node.id === token || node.id.endsWith(`/${token}`) || node.id.endsWith(`.${token}`) || node.name === token;
}
//#endregion
export { FALLBACK_KEYS, FALLBACK_LOG_KEYS, fallbackRailFor, isFallbackProperty, namesNode, normalizeKey, railLabelFor, readAttribute, readAttributeEntry, readString, referenceToken };
