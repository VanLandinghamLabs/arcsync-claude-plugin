import { ResourceType } from "./types.mjs";
//#region ../core/dist/graph/authored.js
/**
* Hand-authored nodes (`docs/superpowers/specs/2026-10-21-arcsync-diagram-syntax-and-interactive-embeds-design.md` §2):
* `type: "authored"`, with `attributes.icon` (a namespaced id such as `user` or
* `aws:lambda`), `attributes.kind` (free text such as `zone`), and any other
* properties. Nothing here applies to an IaC-parsed resource; the one authored
* node a parse adds is an external-system boundary node (`parsers/externalSystems`).
*/
function isAuthored(node) {
	return node.type === ResourceType.AUTHORED;
}
/** Attributes an authored node carries as contract rather than as properties
* to show: the card draws them as its icon, eyebrow and expander instead. */
var AUTHORED_CONTRACT_KEYS = [
	"icon",
	"kind",
	"authored",
	"Definition",
	"DefinitionString",
	"definition",
	"fill",
	"stroke",
	"description",
	"details"
];
function stringAttr(node, key) {
	const value = node.attributes?.[key];
	if (typeof value !== "string") return void 0;
	return value.trim() || void 0;
}
function authoredKindLabel(node) {
	const kind = stringAttr(node, "kind");
	return kind && kind.charAt(0).toUpperCase() + kind.slice(1);
}
/** A container header for an authored node: `name`, or `Kind: name`. Undefined
* for any other node, whose header keeps its type prefix. */
function authoredHeaderLabel(node, name) {
	if (!isAuthored(node)) return void 0;
	const kind = authoredKindLabel(node);
	return kind ? `${kind}: ${name}` : name;
}
//#endregion
export { AUTHORED_CONTRACT_KEYS, authoredHeaderLabel, authoredKindLabel, isAuthored, stringAttr };
