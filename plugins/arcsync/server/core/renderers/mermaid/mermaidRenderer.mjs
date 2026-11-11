import { EdgeType, ResourceType } from "../../graph/types.mjs";
import { lookupByType } from "../../graph/typeLookup.mjs";
import { iconSubpathForNode } from "../../icons/iconAssets.mjs";
import { containerChildSets } from "../../graph/containment.mjs";
import { apiGatewayTypeLabel } from "../../graph/stageTypes.mjs";
import { AUTHORED_CONTRACT_KEYS, authoredHeaderLabel, isAuthored, stringAttr } from "../../graph/authored.mjs";
import { foldNetworkGlue } from "../../graph/foldNetworkGlue.mjs";
import { prepare } from "../../graph/preparePipeline.mjs";
import { CATEGORY_BY_TYPE } from "../../graph/resourceCategory.mjs";
import { CATEGORY_COLORS } from "../../graph/resourceColors.mjs";
//#region ../core/dist/renderers/mermaid/mermaidRenderer.js
/** Exported for the infra-delta summary; the renderer's own use is unchanged. */
var RESOURCE_DISPLAY_NAMES = {
	[ResourceType.EC2_INSTANCE]: "EC2 Instance",
	[ResourceType.LAMBDA_FUNCTION]: "Lambda",
	[ResourceType.ECS_SERVICE]: "ECS Service",
	[ResourceType.S3_BUCKET]: "S3 Bucket",
	[ResourceType.DYNAMODB_TABLE]: "DynamoDB",
	[ResourceType.RDS_INSTANCE]: "RDS",
	[ResourceType.EC2_VPC]: "VPC",
	[ResourceType.EC2_SUBNET]: "Subnet",
	[ResourceType.EC2_SECURITY_GROUP]: "Security Group",
	[ResourceType.ELB_LOAD_BALANCER]: "Load Balancer",
	[ResourceType.IAM_ROLE]: "IAM Role",
	[ResourceType.IAM_POLICY]: "IAM Policy",
	[ResourceType.IAM_INSTANCE_PROFILE]: "Instance Profile",
	[ResourceType.APIGW_REST_API]: "API Gateway",
	[ResourceType.APIGW_V2_API]: "API Gateway",
	[ResourceType.SQS_QUEUE]: "SQS Queue",
	[ResourceType.CLOUDFRONT_DISTRIBUTION]: "CloudFront",
	[ResourceType.CLOUDFRONT_FUNCTION]: "CloudFront Function",
	[ResourceType.ROUTE53_ZONE]: "Route53 Zone",
	[ResourceType.ROUTE53_RECORD]: "Route53 Record",
	[ResourceType.ACM_CERTIFICATE]: "ACM Certificate",
	[ResourceType.EVENTBRIDGE_RULE]: "EventBridge Rule",
	[ResourceType.SNS_TOPIC]: "SNS Topic",
	[ResourceType.APIGW_V2_ROUTE]: "Route",
	[ResourceType.APIGW_V2_INTEGRATION]: "Integration",
	[ResourceType.APIGW_REST_RESOURCE]: "API Resource",
	[ResourceType.APIGW_REST_METHOD]: "API Method",
	[ResourceType.APIGW_REST_INTEGRATION]: "Integration",
	[ResourceType.EC2_NAT_GATEWAY]: "NAT Gateway",
	[ResourceType.EC2_INTERNET_GATEWAY]: "Internet Gateway",
	[ResourceType.EC2_VPC_ENDPOINT]: "VPC Endpoint",
	[ResourceType.EC2_TRANSIT_GATEWAY]: "Transit Gateway",
	[ResourceType.EC2_EIP]: "Elastic IP",
	[ResourceType.EC2_ROUTE_TABLE]: "Route Table",
	[ResourceType.EC2_NETWORK_ACL]: "Network ACL",
	[ResourceType.EC2_ROUTE_TABLE_ASSOCIATION]: "Route Table Association",
	[ResourceType.EC2_ROUTE]: "Route",
	[ResourceType.EC2_INTERNET_GATEWAY_ATTACHMENT]: "Gateway Attachment",
	[ResourceType.ECS_CLUSTER]: "ECS Cluster",
	[ResourceType.ECS_TASK_DEFINITION]: "ECS Task Definition",
	[ResourceType.EKS_CLUSTER]: "EKS Cluster",
	[ResourceType.SFN_STATE_MACHINE]: "Step Functions",
	[ResourceType.SFN_STATE]: "State",
	[ResourceType.DATA_ENTITY]: "Entity",
	[ResourceType.AUTOSCALING_GROUP]: "Auto Scaling Group",
	[ResourceType.RDS_CLUSTER]: "Aurora Cluster",
	[ResourceType.ELASTICACHE_CLUSTER]: "ElastiCache",
	[ResourceType.OPENSEARCH_DOMAIN]: "OpenSearch",
	[ResourceType.EFS_FILE_SYSTEM]: "EFS",
	[ResourceType.REDSHIFT_CLUSTER]: "Redshift",
	[ResourceType.COGNITO_USER_POOL]: "Cognito",
	[ResourceType.WAF_WEB_ACL]: "WAF",
	[ResourceType.KMS_KEY]: "KMS Key",
	[ResourceType.SECRETSMANAGER_SECRET]: "Secrets Manager",
	[ResourceType.EVENTBRIDGE_BUS]: "EventBridge Bus",
	[ResourceType.KINESIS_STREAM]: "Kinesis Stream",
	[ResourceType.KINESIS_FIREHOSE]: "Kinesis Firehose",
	[ResourceType.MSK_CLUSTER]: "MSK (Kafka)",
	[ResourceType.ECR_REPOSITORY]: "ECR Repository",
	[ResourceType.CODEPIPELINE_PIPELINE]: "CodePipeline",
	[ResourceType.CODEBUILD_PROJECT]: "CodeBuild",
	[ResourceType.APPSYNC_API]: "AppSync",
	[ResourceType.CLOUDFORMATION_STACK]: "Stack",
	[ResourceType.SSM_PARAMETER]: "SSM Parameter",
	[ResourceType.SSM_DOCUMENT]: "SSM Document",
	[ResourceType.CLOUDWATCH_ALARM]: "CloudWatch Alarm",
	[ResourceType.CLOUDWATCH_DASHBOARD]: "CloudWatch Dashboard",
	[ResourceType.CLOUDWATCH_LOG_METRIC_FILTER]: "Metric Filter",
	[ResourceType.CLOUDTRAIL_TRAIL]: "CloudTrail",
	[ResourceType.GUARDDUTY_DETECTOR]: "GuardDuty",
	[ResourceType.BUDGETS_BUDGET]: "Budget",
	[ResourceType.GLUE_DATABASE]: "Glue Database",
	[ResourceType.GLUE_TABLE]: "Glue Table",
	[ResourceType.GLUE_JOB]: "Glue Job",
	[ResourceType.GLUE_CRAWLER]: "Glue Crawler",
	[ResourceType.ATHENA_WORKGROUP]: "Athena Workgroup",
	[ResourceType.OPENSEARCH_SERVERLESS_COLLECTION]: "OpenSearch Serverless",
	[ResourceType.BEDROCK_AGENT]: "Bedrock Agent",
	[ResourceType.BEDROCK_KNOWLEDGE_BASE]: "Knowledge Base",
	[ResourceType.BEDROCK_DATA_SOURCE]: "Bedrock Data Source",
	[ResourceType.SCHEDULER_SCHEDULE]: "Schedule",
	[ResourceType.BATCH_COMPUTE_ENVIRONMENT]: "Batch Compute Env",
	[ResourceType.BATCH_JOB_QUEUE]: "Batch Job Queue",
	[ResourceType.BATCH_JOB_DEFINITION]: "Batch Job Definition",
	[ResourceType.BACKUP_PLAN]: "Backup Plan",
	[ResourceType.BACKUP_VAULT]: "Backup Vault",
	[ResourceType.GCP_COMPUTE_INSTANCE]: "GCE Instance",
	[ResourceType.GCP_CONTAINER_CLUSTER]: "GKE Cluster",
	[ResourceType.GCP_CLOUD_RUN_SERVICE]: "Cloud Run",
	[ResourceType.GCP_CLOUD_FUNCTION]: "Cloud Function",
	[ResourceType.GCP_APP_ENGINE]: "App Engine",
	[ResourceType.GCP_CLOUD_RUN_JOB]: "Cloud Run Job",
	[ResourceType.GCP_WORKFLOW]: "Workflow",
	[ResourceType.GCP_STORAGE_BUCKET]: "GCS Bucket",
	[ResourceType.GCP_BIGQUERY_DATASET]: "BigQuery",
	[ResourceType.GCP_SQL_INSTANCE]: "Cloud SQL",
	[ResourceType.GCP_SPANNER_INSTANCE]: "Spanner",
	[ResourceType.GCP_FIRESTORE_DATABASE]: "Firestore",
	[ResourceType.GCP_REDIS_INSTANCE]: "Memorystore",
	[ResourceType.GCP_BIGTABLE_INSTANCE]: "Bigtable",
	[ResourceType.GCP_BIGQUERY_TABLE]: "BigQuery Table",
	[ResourceType.GCP_COMPUTE_NETWORK]: "VPC Network",
	[ResourceType.GCP_COMPUTE_SUBNETWORK]: "Subnet",
	[ResourceType.GCP_FORWARDING_RULE]: "Forwarding Rule",
	[ResourceType.GCP_DNS_ZONE]: "Cloud DNS",
	[ResourceType.GCP_SECURITY_POLICY]: "Cloud Armor",
	[ResourceType.GCP_COMPUTE_ROUTER]: "Cloud Router",
	[ResourceType.GCP_COMPUTE_FIREWALL]: "Firewall Rule",
	[ResourceType.GCP_COMPUTE_ADDRESS]: "IP Address",
	[ResourceType.GCP_DNS_RECORD_SET]: "DNS Record",
	[ResourceType.GCP_ROUTER_NAT]: "Cloud NAT",
	[ResourceType.GCP_VPC_ACCESS_CONNECTOR]: "VPC Connector",
	[ResourceType.GCP_BACKEND_SERVICE]: "Backend Service",
	[ResourceType.GCP_PUBSUB_TOPIC]: "Pub/Sub Topic",
	[ResourceType.GCP_PUBSUB_SUBSCRIPTION]: "Pub/Sub Sub",
	[ResourceType.GCP_EVENTARC_TRIGGER]: "Eventarc Trigger",
	[ResourceType.GCP_CLOUD_SCHEDULER_JOB]: "Scheduler Job",
	[ResourceType.GCP_CLOUD_TASKS_QUEUE]: "Tasks Queue",
	[ResourceType.GCP_IAM_BINDING]: "IAM Binding",
	[ResourceType.GCP_IAM_MEMBER]: "IAM Member",
	[ResourceType.GCP_SERVICE_ACCOUNT]: "Service Account",
	[ResourceType.GCP_KMS_KEY]: "KMS Key",
	[ResourceType.GCP_SECRET_MANAGER_SECRET]: "Secret",
	[ResourceType.GCP_API_GATEWAY]: "API Gateway",
	[ResourceType.GCP_ENDPOINTS_SERVICE]: "Endpoints",
	[ResourceType.GCP_ARTIFACT_REGISTRY_REPOSITORY]: "Artifact Registry",
	[ResourceType.GCP_CLOUD_BUILD_TRIGGER]: "Cloud Build Trigger",
	[ResourceType.GCP_LOGGING_SINK]: "Log Sink",
	[ResourceType.AZURE_VIRTUAL_MACHINE]: "Azure VM",
	[ResourceType.AZURE_LINUX_VM]: "Linux VM",
	[ResourceType.AZURE_WINDOWS_VM]: "Windows VM",
	[ResourceType.AZURE_FUNCTION_APP]: "Azure Function",
	[ResourceType.AZURE_KUBERNETES_CLUSTER]: "AKS",
	[ResourceType.AZURE_CONTAINER_GROUP]: "Container Group",
	[ResourceType.AZURE_APP_SERVICE]: "App Service",
	[ResourceType.AZURE_APP_SERVICE_PLAN]: "App Service Plan",
	[ResourceType.AZURE_AVAILABILITY_SET]: "Availability Set",
	[ResourceType.AZURE_CONTAINER_REGISTRY]: "Container Registry",
	[ResourceType.AZURE_STORAGE_ACCOUNT]: "Storage Account",
	[ResourceType.AZURE_COSMOSDB_ACCOUNT]: "Cosmos DB",
	[ResourceType.AZURE_SQL_DATABASE]: "SQL Database",
	[ResourceType.AZURE_SQL_SERVER]: "SQL Server",
	[ResourceType.AZURE_REDIS_CACHE]: "Redis Cache",
	[ResourceType.AZURE_STORAGE_CONTAINER]: "Blob Container",
	[ResourceType.AZURE_POSTGRESQL_FLEXIBLE_SERVER]: "PostgreSQL",
	[ResourceType.AZURE_VIRTUAL_NETWORK]: "VNet",
	[ResourceType.AZURE_SUBNET]: "Subnet",
	[ResourceType.AZURE_LOAD_BALANCER]: "Load Balancer",
	[ResourceType.AZURE_APP_GATEWAY]: "App Gateway",
	[ResourceType.AZURE_DNS_ZONE]: "DNS Zone",
	[ResourceType.AZURE_FRONTDOOR]: "Front Door",
	[ResourceType.AZURE_NSG]: "NSG",
	[ResourceType.AZURE_PUBLIC_IP]: "Public IP",
	[ResourceType.AZURE_NETWORK_INTERFACE]: "NIC",
	[ResourceType.AZURE_PRIVATE_ENDPOINT]: "Private Endpoint",
	[ResourceType.AZURE_PRIVATE_DNS_ZONE]: "Private DNS Zone",
	[ResourceType.AZURE_ROUTE_TABLE]: "Route Table",
	[ResourceType.AZURE_NAT_GATEWAY]: "NAT Gateway",
	[ResourceType.AZURE_BASTION_HOST]: "Bastion",
	[ResourceType.AZURE_VNET_GATEWAY]: "VNet Gateway",
	[ResourceType.AZURE_KEY_VAULT]: "Key Vault",
	[ResourceType.AZURE_ROLE_ASSIGNMENT]: "Role Assignment",
	[ResourceType.AZURE_USER_IDENTITY]: "Managed Identity",
	[ResourceType.AZURE_SERVICEBUS_NAMESPACE]: "Service Bus",
	[ResourceType.AZURE_SERVICEBUS_QUEUE]: "Service Bus Queue",
	[ResourceType.AZURE_SERVICEBUS_TOPIC]: "Service Bus Topic",
	[ResourceType.AZURE_EVENTGRID_TOPIC]: "Event Grid",
	[ResourceType.AZURE_EVENTHUB_NAMESPACE]: "Event Hub",
	[ResourceType.AZURE_EVENTGRID_SYSTEM_TOPIC]: "System Topic",
	[ResourceType.AZURE_LOG_ANALYTICS_WORKSPACE]: "Log Analytics",
	[ResourceType.AZURE_APPLICATION_INSIGHTS]: "App Insights",
	[ResourceType.AZURE_MONITOR_ACTION_GROUP]: "Action Group",
	[ResourceType.AZURE_MONITOR_ALERT]: "Alert Rule",
	[ResourceType.AZURE_API_MANAGEMENT]: "API Management",
	[ResourceType.AZURE_RESOURCE_GROUP]: "Resource Group",
	[ResourceType.AZURE_DEPLOYMENT]: "Deployment",
	[ResourceType.EVENT_TYPE]: "Event",
	[ResourceType.AUTHORED]: "Node",
	[ResourceType.UNKNOWN]: "Resource"
};
var displayNameOf = (type) => lookupByType(RESOURCE_DISPLAY_NAMES, type) ?? "Resource";
/** Every lowercase word mermaid@11.17's flowchart lexer rejects as a node or
* subgraph id — probed against the real parser, which is case-sensitive here
* (`End` and `Default` parse fine). A Serverless function key or a CFN logical
* id can be any of them, and one bare keyword fails the whole diagram. */
var MERMAID_RESERVED_IDS = /* @__PURE__ */ new Set([
	"end",
	"style",
	"default",
	"graph",
	"flowchart",
	"subgraph",
	"class",
	"classDef",
	"click",
	"linkStyle",
	"interpolate",
	"href",
	"call",
	"_self",
	"_blank",
	"_parent",
	"_top"
]);
/** ArcSync's parser also reads a bare `direction` as its keyword. */
var ARCSYNC_RESERVED_IDS = /* @__PURE__ */ new Set([...MERMAID_RESERVED_IDS, "direction"]);
/**
* Raw node id → Mermaid id, injective over `ids`. Replacing every character
* outside `[A-Za-z0-9_]` with `_` is lossy (`a-b`, `a.b` and `a_b` all land on
* `a_b`). Ids that are already valid keep their exact name; the rest take a
* `_2`, `_3`… suffix on collision, assigned in sorted raw-id order so the
* answer depends on the id set and not on parser order. Never emits `-`,
* which the layout harnesses rely on to split Mermaid's `flowchart-<id>-<n>`
* element ids.
*/
function mermaidNodeIds(ids, reserved = MERMAID_RESERVED_IDS) {
	const result = /* @__PURE__ */ new Map();
	const taken = /* @__PURE__ */ new Set();
	const rewritten = [];
	for (const raw of [...new Set(ids)].sort()) if (/^[a-zA-Z0-9_]+$/.test(raw) && !reserved.has(raw)) {
		taken.add(raw);
		result.set(raw, raw);
	} else rewritten.push(raw);
	for (const raw of rewritten) {
		const sanitized = raw.replace(/[^a-zA-Z0-9_]/g, "_");
		const base = reserved.has(sanitized) || !sanitized ? `${sanitized}_` : sanitized;
		let id = base;
		for (let n = 2; taken.has(id); n += 1) id = `${base}_${n}`;
		taken.add(id);
		result.set(raw, id);
	}
	return result;
}
var CATEGORY_TEXT = {
	networking: "#9a3412",
	compute: "#1e40af",
	storage: "#166534",
	security: "#6b21a8",
	messaging: "#92400e",
	events: "#9d174d",
	infra: "#334155"
};
var CLASS_DEF_LINES = Object.entries(CATEGORY_COLORS).map(([cat, c]) => `classDef ${cat} fill:${c.bg},stroke:${c.border},color:${CATEGORY_TEXT[cat]}`);
var DELTA_CLASS_DEF_LINES = ["classDef arcAdded stroke:#16a34a,stroke-width:3px", "classDef arcChanged stroke:#d97706,stroke-width:3px,stroke-dasharray:6 3"];
/** `class a,b cls` statements for the delta ids the rendered graph carries.
* A separate statement rather than the `:::` suffix, which takes one class
* and is already spent on the resource category. */
function deltaClassLines(delta, ids) {
	if (!delta) return [];
	const lines = [];
	for (const [cls, nodes] of [["arcAdded", delta.added], ["arcChanged", delta.changed]]) {
		const classed = nodes.flatMap((n) => ids.get(n.id) ?? []);
		if (classed.length > 0) lines.push(`  class ${classed.join(",")} ${cls}`);
	}
	return lines;
}
function getStyleSuffix(type) {
	const cls = lookupByType(CATEGORY_BY_TYPE, type);
	return cls ? `:::${cls}` : "";
}
/**
* Neutralise text destined for a quoted Mermaid label (node `["..."]`,
* subgraph, or edge `|"..."|`). Names come from arbitrary user IaC (event
* detail-types, SNS filter values, resource/stack/integration names) and the
* frontend renders Mermaid with HTML labels, so an unescaped `"` breaks out of
* the label quotes and `<`/`>` are an HTML-injection vector (e.g.
* `<img onerror=...>`). Mermaid accepts entities inside quoted labels, so this
* is safe to apply unconditionally.
*
* Mermaid strips directives from the whole source before it lexes anything, so
* quotes do not protect a `%%{`: unclosed it eats the rest of the diagram, and
* closed it is a config directive. A lone `%` stays as written, keeping ordinary
* labels readable in the source.
*
* No `#` may reach Mermaid, so these entities stay named. Its `#\w+;` handling
* reads `#12;` as an entity and turns `&#96;` into a stray `&`, and its
* `style.*:\S*#.*;` rewrite, which the icon tag's `style` attribute triggers,
* drops the last `;` of any line with a `#` in it, breaking the entity it ends.
*/
function escapeMermaidLabel(text) {
	return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/#/g, "&num;").replace(/`/g, "&grave;").replace(/%(?=%)/g, "&percnt;");
}
var META_KEY = /^[A-Za-z_$][A-Za-z0-9_$-]*$/;
var MAX_ARCSYNC_PROP_CHARS = 200;
var NON_PROP_KEYS = /* @__PURE__ */ new Set([...AUTHORED_CONTRACT_KEYS, "link"]);
var metaString = (value) => JSON.stringify(value.replace(/\p{Cc}/gu, " "));
var metaKey = (key) => META_KEY.test(key) ? key : metaString(key);
function arcsyncIcon(node) {
	if (isAuthored(node)) return stringAttr(node, "icon");
	if (node.type === ResourceType.CLOUDFORMATION_STACK || node.type === ResourceType.UNKNOWN) return void 0;
	return iconSubpathForNode(node)?.replace("/", ":").replace(/\.svg$/, "");
}
function arcsyncKind(node) {
	if (isAuthored(node)) return stringAttr(node, "kind");
	const known = lookupByType(RESOURCE_DISPLAY_NAMES, node.type);
	return known && node.type !== ResourceType.UNKNOWN ? known : node.resourceType || known;
}
function arcsyncProps(node) {
	const props = [];
	for (const [key, value] of Object.entries(node.attributes ?? {})) {
		if (NON_PROP_KEYS.has(key)) continue;
		if (typeof value === "number" && Number.isFinite(value) || typeof value === "boolean") props.push(`${metaKey(key)}: ${value}`);
		else if (typeof value === "string" && value.length <= MAX_ARCSYNC_PROP_CHARS) props.push(`${metaKey(key)}: ${metaString(value)}`);
	}
	return props;
}
/** `["name"]@{ … }`. The bracket label is read up to the next `"` and never
* entity-decoded, so a name it cannot carry verbatim also goes in the
* metadata `label`, which the parser takes over the bracket. */
function arcsyncShape(node) {
	const name = node.name.replace(/\p{Cc}/gu, " ");
	const bracket = name.replace(/"/g, "'");
	return `["${bracket}"]${arcsyncMeta(node, bracket === name && !(name.length >= 2 && /^`.*`$/s.test(name)) ? void 0 : name)}`;
}
/** An edge label sits between `|` delimiters the parser closes at the first
* `|`, quoted or not, and has no metadata fallback, so what it would misread
* (a `|`, a `"`, wrapping backticks it strips as Markdown) is swapped. */
var arcsyncEdgeLabel = (label) => label.replace(/\p{Cc}/gu, " ").replace(/"/g, "'").replace(/\|/g, "¦").replace(/^`(.*)`$/s, "'$1'");
function arcsyncMeta(node, label) {
	const entries = [];
	if (label !== void 0) entries.push(`label: ${metaString(label)}`);
	const icon = arcsyncIcon(node);
	if (icon) entries.push(`icon: ${metaString(icon)}`);
	const kind = arcsyncKind(node);
	if (kind) entries.push(`kind: ${metaString(kind)}`);
	for (const key of [
		"description",
		"details",
		"link"
	]) {
		const text = stringAttr(node, key);
		if (text) entries.push(`${key}: ${metaString(text)}`);
	}
	const props = arcsyncProps(node);
	if (props.length > 0) entries.push(`props: { ${props.join(", ")} }`);
	return entries.length > 0 ? `@{ ${entries.join(", ")} }` : "";
}
/**
* The rail tags this renderer draws.
*
* ONLY the ones `foldNetworkGlue` and `foldEventLeftovers` produce, the folds
* this renderer runs, so a folded join or subscription still shows. A node reaching `renderMermaid` on the shipping path has
* already been through `filterGraphForDisplay`, which stamps a `LOGS` rail on
* every owner of a hidden log group — so rendering rails unconditionally put
* `↳ LOGS Logs` on every Lambda in every PR comment and every `arcsync
* generate` diagram. That is a change to diagrams this feature has nothing to
* do with, and the name it prints is the log group's LOGICAL ID, which reads as
* noise inline where it reads fine beside the card it hangs off on the canvas.
*/
var MERMAID_RAIL_LABELS = /* @__PURE__ */ new Set([
	"ROUTE",
	"PROFILE",
	"INGRESS",
	"EGRESS",
	"LISTENER",
	"SUB",
	"TARGET",
	"NOTIFY"
]);
/**
* The folded rails a card draws as strips, as extra lines under the node's
* name — the closest thing this renderer has to the canvas's strip, and the
* only way a folded route survives into an exported Markdown diagram at all.
*
* `<br/>` is emitted RAW, outside `escapeMermaidLabel`, exactly as the icon
* `<img>` below already is: the escape exists to neutralise a resource NAME,
* not the markup this function composes around it. Mermaid treats `<br/>` in
* node text as a line break in every label mode.
*/
function railLines(node) {
	return (node.fallbackRails ?? []).filter((rail) => MERMAID_RAIL_LABELS.has(rail.label)).map((rail) => `<br/>${escapeMermaidLabel(`↳ ${rail.label} ${rail.name}`)}`).join("");
}
function formatNodeLabel(node, options) {
	const text = escapeMermaidLabel(authoredHeaderLabel(node, node.name) ?? `${displayNameOf(node.type)}: ${node.name}`) + railLines(node);
	if (!options?.iconBaseUrl) return text;
	const iconFile = iconSubpathForNode(node);
	if (!iconFile) return text;
	return `<img src='${`${options.iconBaseUrl}/${iconFile}`}' width='24' height='24' alt='' style='vertical-align:middle;margin-right:6px'/>${text}`;
}
function getSubgraphLabel(node) {
	if (node.type === ResourceType.CLOUDFORMATION_STACK) return escapeMermaidLabel(node.name);
	const authored = authoredHeaderLabel(node, node.name);
	if (authored !== void 0) return escapeMermaidLabel(authored);
	const displayName = displayNameOf(node.type);
	const typeLabel = apiGatewayTypeLabel(node);
	return escapeMermaidLabel(typeLabel ? `${displayName} (${typeLabel}): ${node.name}` : `${displayName}: ${node.name}`);
}
function nodeLine(node, indent, ctx) {
	if (ctx.options?.syntax === "arcsync") return `${indent}${ctx.ids.get(node.id)}${arcsyncShape(node)}`;
	return `${indent}${ctx.ids.get(node.id)}["${formatNodeLabel(node, ctx.options)}"]${getStyleSuffix(node.type)}`;
}
function renderContainer(parentId, childIds, indent, ctx) {
	const parent = ctx.nodeMap.get(parentId);
	if (!parent) return;
	ctx.lines.push(ctx.options?.syntax === "arcsync" ? `${indent}subgraph ${ctx.ids.get(parentId)}${arcsyncShape(parent)}` : `${indent}subgraph ${ctx.ids.get(parentId)}["${getSubgraphLabel(parent)}"]`);
	for (const childId of childIds) {
		const grandchildren = ctx.containers.get(childId);
		if (grandchildren) {
			renderContainer(childId, grandchildren, `${indent}  `, ctx);
			continue;
		}
		const child = ctx.nodeMap.get(childId);
		if (child) ctx.lines.push(nodeLine(child, `${indent}  `, ctx));
	}
	ctx.lines.push(`${indent}end`);
}
function edgeLine(edge, ids, arcsync) {
	const source = ids.get(edge.source);
	const target = ids.get(edge.target);
	const text = edge.label && (arcsync ? arcsyncEdgeLabel : escapeMermaidLabel)(edge.label);
	const label = text ? `|"${text}"|` : "";
	const shaft = edge.type === EdgeType.EVENT_FLOW || edge.inferredCrossEngine ? "-.-" : "--";
	if (edge.direction === "reverse") return `  ${target} ${shaft}>${label} ${source}`;
	return `  ${source} ${edge.direction === "bidirectional" ? "<" : ""}${shaft}>${label} ${target}`;
}
function renderMermaid(graph, options) {
	const transformed = foldNetworkGlue(prepare(graph, { eventFlows: options?.eventFlows }));
	const arcsync = options?.syntax === "arcsync";
	const delta = arcsync ? void 0 : options?.delta;
	const lines = [
		graph.metadata?.rankdir === "LR" ? "graph LR" : "graph TD",
		...arcsync ? [] : CLASS_DEF_LINES.map((l) => `  ${l}`),
		...delta ? DELTA_CLASS_DEF_LINES.map((l) => `  ${l}`) : []
	];
	const containers = containerChildSets(transformed);
	const containedNodes = /* @__PURE__ */ new Set();
	for (const children of containers.values()) for (const childId of children) containedNodes.add(childId);
	const nodeMap = new Map(transformed.nodes.map((n) => [n.id, n]));
	const ids = mermaidNodeIds(nodeMap.keys(), arcsync ? ARCSYNC_RESERVED_IDS : void 0);
	const ctx = {
		containers,
		nodeMap,
		ids,
		lines,
		options
	};
	for (const [parentId, childSet] of containers) {
		if (containedNodes.has(parentId)) continue;
		renderContainer(parentId, childSet, "  ", ctx);
	}
	for (const node of transformed.nodes) {
		if (containers.has(node.id) || containedNodes.has(node.id)) continue;
		lines.push(nodeLine(node, "  ", ctx));
	}
	lines.push(...deltaClassLines(delta, ids));
	for (const edge of transformed.edges) {
		if (edge.type === EdgeType.CONTAINS) continue;
		if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
		lines.push(edgeLine(edge, ids, arcsync));
	}
	return `${lines.join("\n")}\n`;
}
//#endregion
export { RESOURCE_DISPLAY_NAMES, mermaidNodeIds, renderMermaid };
