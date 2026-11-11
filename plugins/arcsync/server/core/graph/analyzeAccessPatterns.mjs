import { EdgeType, ResourceType } from "./types.mjs";
import { createEdgeIdMinter } from "./edgeIds.mjs";
import { classifyIamAccess, combinedIamAccess } from "./iamActionClassifier.mjs";
//#region ../core/dist/graph/analyzeAccessPatterns.js
var DATA_STORE_TYPES = /* @__PURE__ */ new Set([
	ResourceType.DYNAMODB_TABLE,
	ResourceType.RDS_INSTANCE,
	ResourceType.RDS_CLUSTER,
	ResourceType.S3_BUCKET,
	ResourceType.ELASTICACHE_CLUSTER,
	ResourceType.OPENSEARCH_DOMAIN,
	ResourceType.EFS_FILE_SYSTEM,
	ResourceType.REDSHIFT_CLUSTER
]);
var MESSAGING_TYPES = /* @__PURE__ */ new Set([
	ResourceType.SQS_QUEUE,
	ResourceType.SNS_TOPIC,
	ResourceType.EVENTBRIDGE_RULE,
	ResourceType.EVENTBRIDGE_BUS,
	ResourceType.KINESIS_STREAM,
	ResourceType.KINESIS_FIREHOSE,
	ResourceType.MSK_CLUSTER
]);
function classifyLabel(label) {
	const normalized = label.trim().toLowerCase();
	if (normalized === "reads/writes" || normalized === "read/write" || normalized === "read_write") return "read_write";
	if (normalized === "reads" || normalized === "read") return "read";
	if (normalized === "writes" || normalized === "write") return "write";
	return null;
}
function classifyIamActions(actions) {
	if (actions.some((action) => action === "*" || action.endsWith(":*"))) return "read_write";
	return combinedIamAccess(classifyIamAccess(actions));
}
var READ_COMMANDS = /* @__PURE__ */ new Set([
	"GetItemCommand",
	"QueryCommand",
	"ScanCommand",
	"BatchGetItemCommand",
	"GetCommand",
	"GetObjectCommand",
	"HeadObjectCommand",
	"ListObjectsV2Command",
	"ReceiveMessageCommand",
	"GetRecordsCommand"
]);
var WRITE_COMMANDS = /* @__PURE__ */ new Set([
	"PutItemCommand",
	"UpdateItemCommand",
	"DeleteItemCommand",
	"BatchWriteItemCommand",
	"PutCommand",
	"UpdateCommand",
	"DeleteCommand",
	"PutObjectCommand",
	"DeleteObjectCommand",
	"SendMessageCommand",
	"SendMessageBatchCommand",
	"PublishCommand",
	"PutRecordCommand",
	"PutRecordsCommand",
	"PutRecordBatchCommand",
	"PutEventsCommand"
]);
var READ_COMMAND_PATTERN = new RegExp(`\\b(?:${[...READ_COMMANDS].join("|")})\\b`);
var WRITE_COMMAND_PATTERN = new RegExp(`\\b(?:${[...WRITE_COMMANDS].join("|")})\\b`);
function classifyLambdaSource(source) {
	if (!source) return null;
	const hasRead = READ_COMMAND_PATTERN.test(source);
	const hasWrite = WRITE_COMMAND_PATTERN.test(source);
	if (hasRead && hasWrite) return "read_write";
	if (hasRead) return "read";
	if (hasWrite) return "write";
	return null;
}
function classificationToDirection(classification, isDataStore) {
	if (isDataStore) {
		if (classification === "read") return "reverse";
		if (classification === "write") return "forward";
		return "bidirectional";
	}
	if (classification === "write") return "forward";
	if (classification === "read") return "reverse";
	return "bidirectional";
}
/**
* Detect GCP and Azure containment/reference relationships by scanning node attributes.
* Returns additional edges to be merged into the graph.
*/
function detectCloudRelationships(graph) {
	const existingEdgeKeys = new Set(graph.edges.map((e) => `${e.source}->${e.target}`));
	const newEdges = [...graph.edges];
	const nextEdgeId = createEdgeIdMinter(graph.edges);
	function addEdgeIfNew(source, target, type, label) {
		const key = `${source}->${target}`;
		if (!existingEdgeKeys.has(key)) {
			newEdges.push({
				id: nextEdgeId(),
				source,
				target,
				type,
				label
			});
			existingEdgeKeys.add(key);
		}
	}
	const gcpNetworks = /* @__PURE__ */ new Map();
	const azureVnets = /* @__PURE__ */ new Map();
	const azureSqlServers = /* @__PURE__ */ new Map();
	const azureResourceGroups = /* @__PURE__ */ new Map();
	const gcpPubsubTopics = /* @__PURE__ */ new Map();
	for (const node of graph.nodes) if (node.type === ResourceType.GCP_COMPUTE_NETWORK) gcpNetworks.set(node.name, node.id);
	else if (node.type === ResourceType.AZURE_VIRTUAL_NETWORK) azureVnets.set(node.name, node.id);
	else if (node.type === ResourceType.AZURE_SQL_SERVER) azureSqlServers.set(node.name, node.id);
	else if (node.type === ResourceType.AZURE_RESOURCE_GROUP) azureResourceGroups.set(node.name, node.id);
	else if (node.type === ResourceType.GCP_PUBSUB_TOPIC) {
		gcpPubsubTopics.set(node.name, node.id);
		gcpPubsubTopics.set(node.id, node.id);
	}
	for (const node of graph.nodes) {
		if (node.type === ResourceType.GCP_COMPUTE_SUBNETWORK) {
			const network = node.attributes.network;
			if (network) {
				const networkId = gcpNetworks.get(network);
				if (networkId) addEdgeIfNew(networkId, node.id, EdgeType.CONTAINS);
			}
		}
		if (node.type === ResourceType.GCP_PUBSUB_SUBSCRIPTION) {
			const topic = node.attributes.topic;
			if (topic) {
				const topicId = gcpPubsubTopics.get(topic);
				if (topicId) addEdgeIfNew(node.id, topicId, EdgeType.REFERENCE);
			}
		}
		if (node.type === ResourceType.AZURE_SUBNET) {
			const vnetName = node.attributes.virtual_network_name;
			if (vnetName) {
				const vnetId = azureVnets.get(vnetName);
				if (vnetId) addEdgeIfNew(vnetId, node.id, EdgeType.CONTAINS);
			}
		}
		if (node.type === ResourceType.AZURE_SQL_DATABASE) {
			const serverId = node.attributes.server_id;
			if (serverId) {
				const serverNodeId = azureSqlServers.get(serverId) ?? [...azureSqlServers.values()].find((id) => serverId.includes(id)) ?? [...azureSqlServers.entries()].find(([name]) => serverId.includes(name))?.[1];
				if (serverNodeId) addEdgeIfNew(serverNodeId, node.id, EdgeType.CONTAINS);
			}
		}
		if (node.type !== ResourceType.AZURE_RESOURCE_GROUP) {
			const rgName = node.attributes.resource_group_name;
			if (rgName) {
				const rgId = azureResourceGroups.get(rgName);
				if (rgId) addEdgeIfNew(rgId, node.id, EdgeType.CONTAINS);
			}
		}
	}
	return {
		...graph,
		edges: newEdges
	};
}
function analyzeAccessPatterns(graph) {
	const enriched = detectCloudRelationships(graph);
	const nodeMap = new Map(enriched.nodes.map((n) => [n.id, n]));
	const edges = enriched.edges.map((edge) => {
		if (edge.type === EdgeType.CONTAINS) return edge;
		if (edge.direction) return edge;
		const targetNode = nodeMap.get(edge.target);
		if (!targetNode) return edge;
		const isDataStore = DATA_STORE_TYPES.has(targetNode.type);
		const isMessaging = MESSAGING_TYPES.has(targetNode.type);
		if (!isDataStore && !isMessaging) return edge;
		const lambdaSource = nodeMap.get(edge.source)?.attributes.sourceCode;
		if (lambdaSource) {
			const codeClassification = classifyLambdaSource(lambdaSource);
			if (codeClassification) return {
				...edge,
				direction: classificationToDirection(codeClassification, isDataStore)
			};
		}
		if (edge.label) {
			const labelClassification = classifyLabel(edge.label);
			if (labelClassification) return {
				...edge,
				direction: classificationToDirection(labelClassification, isDataStore)
			};
			const iamClassification = classifyIamActions(edge.label.split(",").map((a) => a.trim()));
			if (iamClassification) return {
				...edge,
				direction: classificationToDirection(iamClassification, isDataStore)
			};
		}
		const defaultDirection = isDataStore ? "bidirectional" : "forward";
		return {
			...edge,
			direction: defaultDirection
		};
	});
	return {
		...enriched,
		edges
	};
}
//#endregion
export { DATA_STORE_TYPES, MESSAGING_TYPES, analyzeAccessPatterns, classifyIamActions, classifyLabel, classifyLambdaSource };
