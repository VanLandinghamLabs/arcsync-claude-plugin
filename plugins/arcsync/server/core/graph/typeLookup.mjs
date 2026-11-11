//#region ../core/dist/graph/typeLookup.js
/**
* Reads a discriminator-keyed table without walking the prototype chain.
*
* `ResourceNode.type` is TYPED as `ResourceType` and is not one at runtime: a
* graph rehydrated from storage is cast, never validated, and the raw string
* originates in parsed provider output. A stored node typed `constructor`,
* `toString` or `valueOf` therefore reads a FUNCTION back out of any plain
* object indexed with it — and `?? fallback` does not catch that, because a
* function is neither `null` nor `undefined`.
*
* The key is not only `ResourceType`. `node.engine` and an API's
* `attributes.ProtocolType` are cast-not-validated the same way and index
* tables of their own, so this is generic over the discriminator rather than
* tied to one enum.
*
* #1125 found eight, and they are not a closed set — this is a shape, not an
* inventory. In the Mermaid renderer: two `DISPLAY_NAMES` reads and the
* `CATEGORY_BY_TYPE` read behind `getStyleSuffix`. Plus the icon-filename reads,
* `categoryForType` (whose result the canvas stores per node),
* `containerDisplayName` in `canvas-view.ts`, `protocolLabelFor`'s
* `PROTOCOL_LABELS`, and `groupByEngine`'s `ENGINE_LABEL`.
*
* Two were worse than a garbled label. `getStyleSuffix` interpolates its value
* into a Mermaid class suffix, so a function there emitted
* `:::function Object() { [native code] }` and broke the whole diagram. And
* `ENGINE_LABEL` feeds a synthetic container's `name`, which
* `escapeMermaidLabel` then calls `.replace` on — so a graph carrying one
* unknown `engine` made `renderMermaid` THROW and return nothing at all.
*
* Note `__proto__` behaves differently from the rest and is the reason a
* "reject functions" guard is not enough: a bare index returns
* `Object.prototype`, an OBJECT, which renders as `[object Object]`.
*
* This exists as a function rather than as inline `Object.hasOwn` calls because
* the inline form is exactly how the gap got there: every table guarded
* inline has had to remember to. Route a new discriminator-keyed table through
* here and it inherits the guard.
*/
function lookupByType(table, key) {
	return Object.hasOwn(table, key) ? table[key] : void 0;
}
//#endregion
export { lookupByType };
