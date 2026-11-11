import { ResourceType } from "../graph/types.mjs";
import { lookupByType } from "../graph/typeLookup.mjs";
import { azapiArmType } from "../parsers/terraform/azapiType.mjs";
import { AWS_ICON_FILENAMES } from "./awsIconRegistry.mjs";
import { AZURE_ICON_FILENAMES } from "./azureIconRegistry.mjs";
import { GCP_ICON_FILENAMES } from "./gcpIconRegistry.mjs";
import { unknownIconSubpath } from "./unknownIconFallback.mjs";
//#region ../core/dist/icons/iconAssets.js
/**
* `resourceType` → `<vendor>/<file>.svg`, relative to wherever the icon assets
* happen to be rooted — `/icons/` over HTTP for the SPA, a directory on disk
* for the thumbnail renderer. The vendor prefix is the only thing the three
* registries don't already carry, and it is exactly what both renderers used
* to bolt on themselves.
*
* Lives in core because the SPA canvas and the server-side thumbnail draw the
* same node from the same registries and must not disagree about which file
* that is — the drift class described in `estimateNodeHeight.ts`'s header, and
* the reason `ICON_MAP` was moved off its hand-written GCP/Azure tables in
* #719. A type absent here has no icon on either surface.
*/
var ICON_SUBPATHS = {};
for (const [resourceType, filename] of Object.entries(AWS_ICON_FILENAMES)) ICON_SUBPATHS[resourceType] = `aws/${filename}`;
for (const [resourceType, filename] of Object.entries(GCP_ICON_FILENAMES)) ICON_SUBPATHS[resourceType] = `gcp/${filename}`;
for (const [resourceType, filename] of Object.entries(AZURE_ICON_FILENAMES)) ICON_SUBPATHS[resourceType] = `azure/${filename}`;
function iconSubpathFor(type) {
	return lookupByType(ICON_SUBPATHS, type);
}
/** The generic icon set for hand-authored, non-cloud nodes. An id is the file
* stem under `generic/`, written bare (`user`) or as `generic:user`. */
var GENERIC_ICON_IDS = [
	"user",
	"browser",
	"mobile",
	"database",
	"queue",
	"service",
	"external"
];
/** What an authored node draws when neither its icon nor its kind names one. */
var DEFAULT_AUTHORED_ICON = "generic/service.svg";
var GENERIC_IDS = new Set(GENERIC_ICON_IDS);
/** `aws:lambda` → `aws/lambda.svg`: every vendor asset the registries already
* ship, addressed by its file stem, so authored icons reuse the IaC set. */
var VENDOR_ICON_IDS = new Map(Object.values(ICON_SUBPATHS).map((subpath) => [subpath.replace("/", ":").replace(/\.svg$/, ""), subpath]));
function iconIdSubpath(id) {
	if (typeof id !== "string") return void 0;
	const key = id.trim().toLowerCase();
	const generic = key.startsWith("generic:") ? key.slice(8) : key;
	if (GENERIC_IDS.has(generic)) return `generic/${generic}.svg`;
	return VENDOR_ICON_IDS.get(key);
}
/** An authored node's icon: its `icon` id, else its `kind` when that names a
* generic icon, else the neutral default. Never undefined. */
function authoredIconSubpath(attributes) {
	return iconIdSubpath(attributes?.icon) ?? iconIdSubpath(attributes?.kind) ?? "generic/service.svg";
}
/** `iconSubpathFor` for a whole node: an authored node resolves its icon from
* its attributes, an unknown one from its raw `resourceType`'s namespace, and
* every other node from its type. */
function iconSubpathForNode(node) {
	if (node.type === ResourceType.AUTHORED) return authoredIconSubpath(node.attributes);
	if (node.type === ResourceType.UNKNOWN) return unknownIconSubpath(azapiArmType(node.resourceType, node.attributes) ?? node.resourceType);
	return iconSubpathFor(node.type);
}
//#endregion
export { DEFAULT_AUTHORED_ICON, GENERIC_ICON_IDS, ICON_SUBPATHS, authoredIconSubpath, iconSubpathFor, iconSubpathForNode };
