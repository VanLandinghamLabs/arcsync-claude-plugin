//#region ../core/dist/graph/syntheticStateId.js
/** Separator between a state machine's id and its synthetic state index.
* Ids are index-based, never name-derived: ASL state names are arbitrary user
* strings, so a name-derived id could collide with a real node id. */
var SYNTHETIC_STATE_SEPARATOR = "#state:";
new RegExp(`${SYNTHETIC_STATE_SEPARATOR}\\d+(?:/\\d+:\\d+)*$`);
//#endregion
export { SYNTHETIC_STATE_SEPARATOR };
