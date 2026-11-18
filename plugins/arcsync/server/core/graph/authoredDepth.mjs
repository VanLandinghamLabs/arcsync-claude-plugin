import { isAuthoredOrMarked } from "./authored.mjs";
import "./fallbackRail.mjs";
import "./types.mjs";
// ../core/dist/graph/authoredDepth.js
var HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
/** The author's fill and stroke, each only when it is `#rgb` or `#rrggbb`. The
* parser stores them unvalidated, so every renderer reads colours through here. */
function authoredColors(node) {
	if (!isAuthoredOrMarked(node)) return {};
	const colors = {};
	for (const key of ["fill", "stroke"]) {
		const value = node.attributes?.[key];
		if (typeof value === "string" && HEX_COLOR.test(value)) colors[key] = value;
	}
	return colors;
}
export { authoredColors };
