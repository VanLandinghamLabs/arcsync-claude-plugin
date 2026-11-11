import { analyzeAccessPatterns } from "./analyzeAccessPatterns.mjs";
import { groupByStack } from "./groupByStack.mjs";
import { collapseIntegrations } from "./collapseIntegrations.mjs";
import { dropSupersededReferences } from "./dropSupersededReferences.mjs";
import { extractEventFlows } from "./eventFlows.mjs";
import { foldEventLeftovers } from "./foldEventLeftovers.mjs";
import { foldInvokeConfigs } from "./foldInvokeConfigs.mjs";
import { groupByEngine } from "./groupByEngine.mjs";
//#region ../core/dist/graph/preparePipeline.js
/**
* The pre-pipeline every renderer runs before layout: the canvas, the thumbnail
* and renderMermaid all call this. Hand Mermaid the RAW graph, never this
* function's output — renderMermaid applies it itself, and groupByStack and
* extractEventFlows are both non-idempotent.
*/
function prepare(graph, options) {
	const base = foldInvokeConfigs(foldEventLeftovers(options?.eventFlows === false ? graph : extractEventFlows(graph)));
	return groupByEngine(groupByStack(collapseIntegrations(analyzeAccessPatterns(dropSupersededReferences(base)))));
}
//#endregion
export { prepare };
