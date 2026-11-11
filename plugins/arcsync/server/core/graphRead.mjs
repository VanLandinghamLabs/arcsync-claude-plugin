//#region ../core/dist/graphRead.js
/** Resolved to a CANON by its own id: the row is nested under `canonical`. */
function isCanonRead(r) {
	return "canonical" in r && typeof r.canonical === "object" && r.canonical !== null;
}
/**
* The CANON fields, whichever shape carries them: `canonical` on a CANON read,
* the top level on a seed-follow read. A JOB# row answers with its own fields,
* none of which is `lastParsedAt`, which every CANON has. Also takes a
* `GET /gallery/{id}` answer, a CANON spread like the seed-follow one.
*/
function canonicalFieldsOf(r) {
	return isCanonRead(r) ? r.canonical : r;
}
//#endregion
export { canonicalFieldsOf, isCanonRead };
