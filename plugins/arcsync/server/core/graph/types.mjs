//#region ../core/dist/graph/types.js
var ResourceType;
(function(ResourceType) {
	ResourceType["EC2_INSTANCE"] = "aws_instance";
	ResourceType["LAMBDA_FUNCTION"] = "aws_lambda_function";
	ResourceType["ECS_SERVICE"] = "aws_ecs_service";
	ResourceType["S3_BUCKET"] = "aws_s3_bucket";
	ResourceType["DYNAMODB_TABLE"] = "aws_dynamodb_table";
	ResourceType["RDS_INSTANCE"] = "aws_db_instance";
	ResourceType["EC2_VPC"] = "aws_vpc";
	ResourceType["EC2_SUBNET"] = "aws_subnet";
	ResourceType["EC2_SECURITY_GROUP"] = "aws_security_group";
	ResourceType["ELB_LOAD_BALANCER"] = "aws_lb";
	ResourceType["IAM_ROLE"] = "aws_iam_role";
	ResourceType["IAM_POLICY"] = "aws_iam_policy";
	/** The join between an EC2 instance and its role. Folded onto the instance
	* as a `PROFILE` rail by `foldNetworkGlue`. */
	ResourceType["IAM_INSTANCE_PROFILE"] = "aws_iam_instance_profile";
	ResourceType["APIGW_REST_API"] = "aws_api_gateway_rest_api";
	ResourceType["APIGW_V2_API"] = "aws_apigatewayv2_api";
	ResourceType["SQS_QUEUE"] = "aws_sqs_queue";
	ResourceType["CLOUDFRONT_DISTRIBUTION"] = "aws_cloudfront_distribution";
	ResourceType["CLOUDFRONT_FUNCTION"] = "aws_cloudfront_function";
	ResourceType["ROUTE53_ZONE"] = "aws_route53_zone";
	ResourceType["ROUTE53_RECORD"] = "aws_route53_record";
	ResourceType["ACM_CERTIFICATE"] = "aws_acm_certificate";
	ResourceType["EVENTBRIDGE_RULE"] = "aws_cloudwatch_event_rule";
	ResourceType["SNS_TOPIC"] = "aws_sns_topic";
	ResourceType["APIGW_V2_ROUTE"] = "aws_apigatewayv2_route";
	ResourceType["APIGW_V2_INTEGRATION"] = "aws_apigatewayv2_integration";
	ResourceType["APIGW_REST_RESOURCE"] = "aws_api_gateway_resource";
	ResourceType["APIGW_REST_METHOD"] = "aws_api_gateway_method";
	ResourceType["APIGW_REST_INTEGRATION"] = "aws_api_gateway_integration";
	ResourceType["EC2_NAT_GATEWAY"] = "aws_nat_gateway";
	ResourceType["EC2_INTERNET_GATEWAY"] = "aws_internet_gateway";
	ResourceType["EC2_VPC_ENDPOINT"] = "aws_vpc_endpoint";
	ResourceType["EC2_TRANSIT_GATEWAY"] = "aws_ec2_transit_gateway";
	ResourceType["EC2_EIP"] = "aws_eip";
	ResourceType["EC2_ROUTE_TABLE"] = "aws_route_table";
	/** Its entries fold onto it as `INGRESS`/`EGRESS` rails and its subnet
	* associations into `Subnet -> NACL` edges (`foldNetworkGlue`). */
	ResourceType["EC2_NETWORK_ACL"] = "aws_network_acl";
	ResourceType["EC2_ROUTE_TABLE_ASSOCIATION"] = "aws_route_table_association";
	ResourceType["EC2_ROUTE"] = "aws_route";
	ResourceType["EC2_INTERNET_GATEWAY_ATTACHMENT"] = "aws_internet_gateway_attachment";
	ResourceType["ECS_CLUSTER"] = "aws_ecs_cluster";
	ResourceType["ECS_TASK_DEFINITION"] = "aws_ecs_task_definition";
	ResourceType["EKS_CLUSTER"] = "aws_eks_cluster";
	ResourceType["SFN_STATE_MACHINE"] = "aws_sfn_state_machine";
	/** A single ASL state inside a state machine. Synthesised by
	* `expandStateMachines` at display time — never parsed, never persisted. */
	ResourceType["SFN_STATE"] = "aws_sfn_state";
	/** One entity of a data store's model (an ER diagram card). Synthesised by
	* `expandStateMachines` at display time — never parsed, never persisted. */
	ResourceType["DATA_ENTITY"] = "data_entity";
	ResourceType["AUTOSCALING_GROUP"] = "aws_autoscaling_group";
	ResourceType["RDS_CLUSTER"] = "aws_rds_cluster";
	ResourceType["ELASTICACHE_CLUSTER"] = "aws_elasticache_cluster";
	ResourceType["OPENSEARCH_DOMAIN"] = "aws_opensearch_domain";
	ResourceType["EFS_FILE_SYSTEM"] = "aws_efs_file_system";
	ResourceType["REDSHIFT_CLUSTER"] = "aws_redshift_cluster";
	ResourceType["COGNITO_USER_POOL"] = "aws_cognito_user_pool";
	ResourceType["WAF_WEB_ACL"] = "aws_wafv2_web_acl";
	ResourceType["KMS_KEY"] = "aws_kms_key";
	ResourceType["SECRETSMANAGER_SECRET"] = "aws_secretsmanager_secret";
	ResourceType["EVENTBRIDGE_BUS"] = "aws_cloudwatch_event_bus";
	ResourceType["KINESIS_STREAM"] = "aws_kinesis_stream";
	ResourceType["KINESIS_FIREHOSE"] = "aws_kinesis_firehose_delivery_stream";
	ResourceType["MSK_CLUSTER"] = "aws_msk_cluster";
	ResourceType["ECR_REPOSITORY"] = "aws_ecr_repository";
	ResourceType["CODEPIPELINE_PIPELINE"] = "aws_codepipeline";
	ResourceType["CODEBUILD_PROJECT"] = "aws_codebuild_project";
	ResourceType["APPSYNC_API"] = "aws_appsync_graphql_api";
	ResourceType["CLOUDFORMATION_STACK"] = "aws_cloudformation_stack";
	ResourceType["SSM_PARAMETER"] = "aws_ssm_parameter";
	ResourceType["SSM_DOCUMENT"] = "aws_ssm_document";
	ResourceType["CLOUDWATCH_ALARM"] = "aws_cloudwatch_metric_alarm";
	ResourceType["CLOUDWATCH_DASHBOARD"] = "aws_cloudwatch_dashboard";
	ResourceType["CLOUDWATCH_LOG_METRIC_FILTER"] = "aws_cloudwatch_log_metric_filter";
	ResourceType["CLOUDTRAIL_TRAIL"] = "aws_cloudtrail";
	ResourceType["GUARDDUTY_DETECTOR"] = "aws_guardduty_detector";
	ResourceType["BUDGETS_BUDGET"] = "aws_budgets_budget";
	ResourceType["GLUE_DATABASE"] = "aws_glue_catalog_database";
	ResourceType["GLUE_TABLE"] = "aws_glue_catalog_table";
	ResourceType["GLUE_JOB"] = "aws_glue_job";
	ResourceType["GLUE_CRAWLER"] = "aws_glue_crawler";
	ResourceType["ATHENA_WORKGROUP"] = "aws_athena_workgroup";
	ResourceType["OPENSEARCH_SERVERLESS_COLLECTION"] = "aws_opensearchserverless_collection";
	ResourceType["BEDROCK_AGENT"] = "aws_bedrockagent_agent";
	ResourceType["BEDROCK_KNOWLEDGE_BASE"] = "aws_bedrockagent_knowledge_base";
	ResourceType["BEDROCK_DATA_SOURCE"] = "aws_bedrockagent_data_source";
	ResourceType["SCHEDULER_SCHEDULE"] = "aws_scheduler_schedule";
	ResourceType["BATCH_COMPUTE_ENVIRONMENT"] = "aws_batch_compute_environment";
	ResourceType["BATCH_JOB_QUEUE"] = "aws_batch_job_queue";
	ResourceType["BATCH_JOB_DEFINITION"] = "aws_batch_job_definition";
	ResourceType["BACKUP_PLAN"] = "aws_backup_plan";
	ResourceType["BACKUP_VAULT"] = "aws_backup_vault";
	ResourceType["GCP_COMPUTE_INSTANCE"] = "google_compute_instance";
	ResourceType["GCP_CONTAINER_CLUSTER"] = "google_container_cluster";
	ResourceType["GCP_CLOUD_RUN_SERVICE"] = "google_cloud_run_service";
	ResourceType["GCP_CLOUD_FUNCTION"] = "google_cloudfunctions_function";
	ResourceType["GCP_APP_ENGINE"] = "google_app_engine_application";
	ResourceType["GCP_CLOUD_RUN_JOB"] = "google_cloud_run_v2_job";
	ResourceType["GCP_WORKFLOW"] = "google_workflows_workflow";
	ResourceType["GCP_STORAGE_BUCKET"] = "google_storage_bucket";
	ResourceType["GCP_BIGQUERY_DATASET"] = "google_bigquery_dataset";
	ResourceType["GCP_SQL_INSTANCE"] = "google_sql_database_instance";
	ResourceType["GCP_SPANNER_INSTANCE"] = "google_spanner_instance";
	ResourceType["GCP_FIRESTORE_DATABASE"] = "google_firestore_database";
	ResourceType["GCP_REDIS_INSTANCE"] = "google_redis_instance";
	ResourceType["GCP_BIGTABLE_INSTANCE"] = "google_bigtable_instance";
	ResourceType["GCP_BIGQUERY_TABLE"] = "google_bigquery_table";
	ResourceType["GCP_COMPUTE_NETWORK"] = "google_compute_network";
	ResourceType["GCP_COMPUTE_SUBNETWORK"] = "google_compute_subnetwork";
	ResourceType["GCP_FORWARDING_RULE"] = "google_compute_forwarding_rule";
	ResourceType["GCP_DNS_ZONE"] = "google_dns_managed_zone";
	ResourceType["GCP_SECURITY_POLICY"] = "google_compute_security_policy";
	ResourceType["GCP_COMPUTE_ROUTER"] = "google_compute_router";
	ResourceType["GCP_COMPUTE_FIREWALL"] = "google_compute_firewall";
	ResourceType["GCP_COMPUTE_ADDRESS"] = "google_compute_address";
	ResourceType["GCP_DNS_RECORD_SET"] = "google_dns_record_set";
	ResourceType["GCP_ROUTER_NAT"] = "google_compute_router_nat";
	ResourceType["GCP_VPC_ACCESS_CONNECTOR"] = "google_vpc_access_connector";
	ResourceType["GCP_BACKEND_SERVICE"] = "google_compute_backend_service";
	ResourceType["GCP_PUBSUB_TOPIC"] = "google_pubsub_topic";
	ResourceType["GCP_PUBSUB_SUBSCRIPTION"] = "google_pubsub_subscription";
	ResourceType["GCP_EVENTARC_TRIGGER"] = "google_eventarc_trigger";
	ResourceType["GCP_CLOUD_SCHEDULER_JOB"] = "google_cloud_scheduler_job";
	ResourceType["GCP_CLOUD_TASKS_QUEUE"] = "google_cloud_tasks_queue";
	ResourceType["GCP_IAM_BINDING"] = "google_project_iam_binding";
	ResourceType["GCP_IAM_MEMBER"] = "google_project_iam_member";
	ResourceType["GCP_SERVICE_ACCOUNT"] = "google_service_account";
	ResourceType["GCP_KMS_KEY"] = "google_kms_crypto_key";
	ResourceType["GCP_SECRET_MANAGER_SECRET"] = "google_secret_manager_secret";
	ResourceType["GCP_API_GATEWAY"] = "google_api_gateway_api";
	ResourceType["GCP_ENDPOINTS_SERVICE"] = "google_endpoints_service";
	ResourceType["GCP_ARTIFACT_REGISTRY_REPOSITORY"] = "google_artifact_registry_repository";
	ResourceType["GCP_CLOUD_BUILD_TRIGGER"] = "google_cloudbuild_trigger";
	ResourceType["GCP_LOGGING_SINK"] = "google_logging_project_sink";
	ResourceType["AZURE_VIRTUAL_MACHINE"] = "azurerm_virtual_machine";
	ResourceType["AZURE_LINUX_VM"] = "azurerm_linux_virtual_machine";
	ResourceType["AZURE_WINDOWS_VM"] = "azurerm_windows_virtual_machine";
	ResourceType["AZURE_FUNCTION_APP"] = "azurerm_function_app";
	ResourceType["AZURE_KUBERNETES_CLUSTER"] = "azurerm_kubernetes_cluster";
	ResourceType["AZURE_CONTAINER_GROUP"] = "azurerm_container_group";
	ResourceType["AZURE_APP_SERVICE"] = "azurerm_app_service";
	ResourceType["AZURE_APP_SERVICE_PLAN"] = "azurerm_service_plan";
	ResourceType["AZURE_AVAILABILITY_SET"] = "azurerm_availability_set";
	ResourceType["AZURE_CONTAINER_REGISTRY"] = "azurerm_container_registry";
	ResourceType["AZURE_STORAGE_ACCOUNT"] = "azurerm_storage_account";
	ResourceType["AZURE_COSMOSDB_ACCOUNT"] = "azurerm_cosmosdb_account";
	ResourceType["AZURE_SQL_DATABASE"] = "azurerm_mssql_database";
	ResourceType["AZURE_SQL_SERVER"] = "azurerm_mssql_server";
	ResourceType["AZURE_REDIS_CACHE"] = "azurerm_redis_cache";
	ResourceType["AZURE_STORAGE_CONTAINER"] = "azurerm_storage_container";
	ResourceType["AZURE_POSTGRESQL_FLEXIBLE_SERVER"] = "azurerm_postgresql_flexible_server";
	ResourceType["AZURE_VIRTUAL_NETWORK"] = "azurerm_virtual_network";
	ResourceType["AZURE_SUBNET"] = "azurerm_subnet";
	ResourceType["AZURE_LOAD_BALANCER"] = "azurerm_lb";
	ResourceType["AZURE_APP_GATEWAY"] = "azurerm_application_gateway";
	ResourceType["AZURE_DNS_ZONE"] = "azurerm_dns_zone";
	ResourceType["AZURE_FRONTDOOR"] = "azurerm_frontdoor";
	ResourceType["AZURE_NSG"] = "azurerm_network_security_group";
	ResourceType["AZURE_PUBLIC_IP"] = "azurerm_public_ip";
	ResourceType["AZURE_NETWORK_INTERFACE"] = "azurerm_network_interface";
	ResourceType["AZURE_PRIVATE_ENDPOINT"] = "azurerm_private_endpoint";
	ResourceType["AZURE_PRIVATE_DNS_ZONE"] = "azurerm_private_dns_zone";
	ResourceType["AZURE_ROUTE_TABLE"] = "azurerm_route_table";
	ResourceType["AZURE_NAT_GATEWAY"] = "azurerm_nat_gateway";
	ResourceType["AZURE_BASTION_HOST"] = "azurerm_bastion_host";
	ResourceType["AZURE_VNET_GATEWAY"] = "azurerm_virtual_network_gateway";
	ResourceType["AZURE_KEY_VAULT"] = "azurerm_key_vault";
	ResourceType["AZURE_ROLE_ASSIGNMENT"] = "azurerm_role_assignment";
	ResourceType["AZURE_USER_IDENTITY"] = "azurerm_user_assigned_identity";
	ResourceType["AZURE_SERVICEBUS_NAMESPACE"] = "azurerm_servicebus_namespace";
	ResourceType["AZURE_SERVICEBUS_QUEUE"] = "azurerm_servicebus_queue";
	ResourceType["AZURE_SERVICEBUS_TOPIC"] = "azurerm_servicebus_topic";
	ResourceType["AZURE_EVENTGRID_TOPIC"] = "azurerm_eventgrid_topic";
	ResourceType["AZURE_EVENTHUB_NAMESPACE"] = "azurerm_eventhub_namespace";
	ResourceType["AZURE_EVENTGRID_SYSTEM_TOPIC"] = "azurerm_eventgrid_system_topic";
	ResourceType["AZURE_LOG_ANALYTICS_WORKSPACE"] = "azurerm_log_analytics_workspace";
	ResourceType["AZURE_APPLICATION_INSIGHTS"] = "azurerm_application_insights";
	ResourceType["AZURE_MONITOR_ACTION_GROUP"] = "azurerm_monitor_action_group";
	ResourceType["AZURE_MONITOR_ALERT"] = "azurerm_monitor_metric_alert";
	ResourceType["AZURE_API_MANAGEMENT"] = "azurerm_api_management";
	ResourceType["AZURE_RESOURCE_GROUP"] = "azurerm_resource_group";
	ResourceType["AZURE_DEPLOYMENT"] = "azurerm_resource_group_template_deployment";
	ResourceType["EVENT_TYPE"] = "arcsync_event_type";
	ResourceType["AUTHORED"] = "authored";
	ResourceType["UNKNOWN"] = "unknown";
})(ResourceType || (ResourceType = {}));
var EdgeType;
(function(EdgeType) {
	EdgeType["REFERENCE"] = "reference";
	EdgeType["DEPENDENCY"] = "dependency";
	EdgeType["NETWORK"] = "network";
	EdgeType["IAM"] = "iam";
	EdgeType["CONTAINS"] = "contains";
	EdgeType["EVENT_FLOW"] = "event-flow";
})(EdgeType || (EdgeType = {}));
/**
* The engines ArcSync executes server-side, in a per-language sandbox builder.
*
* These are the two expensive ones — a 10 GB Docker Lambda running a package
* manager and a synth for 25-160s — and the only two `checkAndConsumeSynth`
* meters against `serverSynthsPerMonth`. Everything else parses statically on
* the cheap lane at roughly $0.00008.
*
* Spelled once, as an array, because two places have to agree on it and used
* to do so by repeating a literal: the sandbox router decides here whether to
* charge a synth, and the Action's Lane A exists precisely to move this set
* into the caller's own CI. An engine metered here with no Action path leaves
* those users nothing to do but stop at the quota or pay (#1083).
*/
var SERVER_SYNTH_ENGINES = ["cdk", "pulumi"];
[...SERVER_SYNTH_ENGINES];
new Set(SERVER_SYNTH_ENGINES);
/**
* Whether a graph carries both arrays a pass walks. The passes that run on
* stored or client-supplied graphs return anything else untouched rather than
* throwing on a payload that predates a field.
*/
function hasGraphArrays(graph) {
	return Array.isArray(graph?.nodes) && Array.isArray(graph?.edges);
}
//#endregion
export { EdgeType, ResourceType, SERVER_SYNTH_ENGINES, hasGraphArrays };
