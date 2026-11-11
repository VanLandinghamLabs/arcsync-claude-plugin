import { ResourceType } from "./types.mjs";
import "./analyzeAccessPatterns.mjs";
ResourceType.IAM_ROLE, ResourceType.IAM_POLICY, ResourceType.EC2_SECURITY_GROUP, ResourceType.GCP_IAM_BINDING, ResourceType.GCP_IAM_MEMBER, ResourceType.GCP_SERVICE_ACCOUNT, ResourceType.GCP_COMPUTE_FIREWALL, ResourceType.AZURE_ROLE_ASSIGNMENT, ResourceType.AZURE_USER_IDENTITY, ResourceType.AZURE_NSG;
/**
* The verb a `foldNetworkGlue`-minted edge carries, by the join it replaced.
*
* Lives here rather than in the fold pass because this is the file that owns
* the grammar, and because the dependency has to point this way: `edgeSemantics`
* is imported by both renderers on the draw path, so importing the fold pass
* back would pull it into every bundle that only wants to classify an edge.
*
* A route composes its destination onto `routes` at mint time (`routes
* 0.0.0.0/0`) and carries the result on `ResourceEdge.label`; the bare word
* here is what a route with no spelled-out destination falls back to.
*/
var FOLD_VERBS = {
	routeTableAssociation: "routes via",
	route: "routes",
	gatewayAttachment: "attaches",
	securityGroupRule: "connects",
	listener: "forwards",
	networkAclAssociation: "filtered by"
};
ResourceType.ROUTE53_RECORD, ResourceType.ROUTE53_ZONE, ResourceType.CLOUDFRONT_DISTRIBUTION, ResourceType.ELB_LOAD_BALANCER;
ResourceType.LAMBDA_FUNCTION, ResourceType.ECS_SERVICE, ResourceType.EC2_INSTANCE, ResourceType.APPSYNC_API, ResourceType.SFN_STATE_MACHINE, ResourceType.GCP_CLOUD_FUNCTION, ResourceType.GCP_CLOUD_RUN_SERVICE, ResourceType.GCP_COMPUTE_INSTANCE, ResourceType.GCP_APP_ENGINE, ResourceType.AZURE_FUNCTION_APP, ResourceType.AZURE_APP_SERVICE, ResourceType.AZURE_CONTAINER_GROUP, ResourceType.AZURE_VIRTUAL_MACHINE, ResourceType.AZURE_LINUX_VM, ResourceType.AZURE_WINDOWS_VM;
ResourceType.RDS_INSTANCE, ResourceType.RDS_CLUSTER, ResourceType.REDSHIFT_CLUSTER, ResourceType.OPENSEARCH_DOMAIN;
//#endregion
export { FOLD_VERBS };
