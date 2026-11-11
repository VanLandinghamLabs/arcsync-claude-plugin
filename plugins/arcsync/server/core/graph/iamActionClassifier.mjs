//#region ../core/dist/graph/iamActionClassifier.js
/**
* Data-plane actions only: management and metadata actions (`s3:CreateBucket`,
* `sqs:GetQueueAttributes`, `kinesis:ListShards`) are left out because CDK's
* write grants include them, and counting them as reads would turn every
* producer into a reader. `dynamodb:DescribeTable` is the exception, kept as a
* read so DynamoDB labels match the classifier this table replaced.
*/
var IAM_SERVICES = {
	dynamodb: {
		cfnNamespace: "DynamoDB",
		terraformPrefix: "aws_dynamodb_",
		read: [
			"GetItem",
			"BatchGetItem",
			"Query",
			"Scan",
			"GetRecords",
			"GetShardIterator",
			"ConditionCheckItem",
			"DescribeTable"
		],
		write: [
			"PutItem",
			"UpdateItem",
			"DeleteItem",
			"BatchWriteItem"
		]
	},
	s3: {
		cfnNamespace: "S3",
		terraformPrefix: "aws_s3_",
		read: [
			"GetObject",
			"GetObjectVersion",
			"GetObjectAttributes",
			"ListBucket"
		],
		write: [
			"PutObject",
			"PutObjectTagging",
			"PutObjectVersionTagging",
			"PutObjectLegalHold",
			"PutObjectRetention",
			"DeleteObject",
			"DeleteObjectVersion",
			"AbortMultipartUpload"
		]
	},
	sqs: {
		cfnNamespace: "SQS",
		terraformPrefix: "aws_sqs_",
		read: [
			"ReceiveMessage",
			"DeleteMessage",
			"DeleteMessageBatch",
			"ChangeMessageVisibility"
		],
		write: ["SendMessage", "SendMessageBatch"]
	},
	sns: {
		cfnNamespace: "SNS",
		terraformPrefix: "aws_sns_",
		read: [],
		write: ["Publish"]
	},
	kinesis: {
		cfnNamespace: "Kinesis",
		terraformPrefix: "aws_kinesis_",
		read: [
			"GetRecords",
			"GetShardIterator",
			"SubscribeToShard"
		],
		write: ["PutRecord", "PutRecords"]
	},
	firehose: {
		cfnNamespace: "KinesisFirehose",
		terraformPrefix: "aws_kinesis_firehose_",
		read: [],
		write: ["PutRecord", "PutRecordBatch"]
	},
	events: {
		cfnNamespace: "Events",
		terraformPrefix: "aws_cloudwatch_event_",
		read: [],
		write: ["PutEvents"]
	},
	secretsmanager: {
		cfnNamespace: "SecretsManager",
		terraformPrefix: "aws_secretsmanager_",
		read: ["GetSecretValue", "BatchGetSecretValue"],
		write: ["PutSecretValue", "UpdateSecret"]
	}
};
var ACTIONS = new Map(Object.entries(IAM_SERVICES).flatMap(([service, spec]) => [...spec.read.map((a) => [`${service}:${a}`.toLowerCase(), {
	service,
	access: "read"
}]), ...spec.write.map((a) => [`${service}:${a}`.toLowerCase(), {
	service,
	access: "write"
}])]));
new Map(Object.entries(IAM_SERVICES).map(([service, spec]) => [spec.cfnNamespace.toLowerCase(), service]));
Object.entries(IAM_SERVICES).map(([service, spec]) => [spec.terraformPrefix, service]).sort(([a], [b]) => b.length - a.length);
/** IAM's glob: `*` any run, `?` one character. Two-pointer backtracking rather
* than a RegExp, so a pattern from a user's template cannot backtrack
* polynomially. */
function globMatches(pattern, text) {
	let p = 0;
	let t = 0;
	let star = -1;
	let resume = 0;
	while (t < text.length) if (pattern[p] === "?" || pattern[p] === text[t]) {
		p++;
		t++;
	} else if (pattern[p] === "*") {
		star = p++;
		resume = t;
	} else if (star >= 0) {
		p = star + 1;
		t = ++resume;
	} else return false;
	while (pattern[p] === "*") p++;
	return p === pattern.length;
}
function mergeIamAccess(existing, incoming) {
	if (!existing || existing === incoming) return incoming;
	return "read_write";
}
/**
* The data access an IAM `Action` list grants, per service. Action names are
* case-insensitive and take `*`/`?` wildcards, so `s3:Get*` is an S3 read and
* `sqs:*` both reads and writes SQS. Services and actions outside the table
* grant nothing.
*/
function classifyIamAccess(actions) {
	const access = /* @__PURE__ */ new Map();
	const grant = (entry) => access.set(entry.service, mergeIamAccess(access.get(entry.service), entry.access));
	for (const action of actions) {
		const pattern = action.toLowerCase();
		if (!/[*?]/.test(pattern)) {
			const entry = ACTIONS.get(pattern);
			if (entry) grant(entry);
			continue;
		}
		for (const [name, entry] of ACTIONS) if (globMatches(pattern, name)) grant(entry);
	}
	return access;
}
/** The access across every service, or `null` when nothing is granted. */
function combinedIamAccess(access) {
	let combined = null;
	for (const value of access.values()) combined = mergeIamAccess(combined ?? void 0, value);
	return combined;
}
//#endregion
export { classifyIamAccess, combinedIamAccess, mergeIamAccess };
