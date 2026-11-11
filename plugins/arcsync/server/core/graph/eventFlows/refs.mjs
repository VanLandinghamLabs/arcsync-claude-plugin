//#region ../core/dist/graph/eventFlows/refs.js
/**
* Resolving an IaC reference to a node id, and reading the two shapes an event
* pattern arrives in. Provider-agnostic: CFN intrinsics and Terraform
* interpolations both show up in AWS, GCP and Azure graphs.
*/
/**
* The logical id a `Fn::GetAtt` value names: `["Role", "Arn"]`, or the long-form
* scalar `Fn::GetAtt: Role.Arn`, which only the `!GetAtt` tag splits for us.
*/
function getAttLogicalId(getAtt) {
	const target = typeof getAtt === "string" ? getAtt.split(".")[0] : Array.isArray(getAtt) ? getAtt[0] : void 0;
	return typeof target === "string" ? target : void 0;
}
/** Resolve a CFN intrinsic ({Ref: X} / {Fn::GetAtt: [X, ...] or "X.Attr"}) to a logical id. */
function resolveCfnRef(value) {
	if (value == null || typeof value !== "object") return null;
	const obj = value;
	if (typeof obj.Ref === "string") return obj.Ref;
	return getAttLogicalId(obj["Fn::GetAtt"]) ?? null;
}
/**
* Match a bare ref (id or interpolation text) against node ids, retrying
* under the owning node's stack prefix for multi-stack CFN parses.
*/
function scopedIdMatch(ref, ownerId, nodeIds) {
	if (nodeIds.has(ref)) return ref;
	const slashIdx = ownerId.lastIndexOf("/");
	if (slashIdx !== -1) {
		const scoped = `${ownerId.slice(0, slashIdx + 1)}${ref}`;
		if (nodeIds.has(scoped)) return scoped;
	}
	return null;
}
/**
* Resolve a CFN ref to an existing node id. CDK synth keeps bare logical ids
* inside Ref/Fn::GetAtt while multi-stack parses prefix node ids with
* "{Stack}/" — retry the bare ref under the owning node's stack prefix.
*/
function scopedCfnRef(value, ownerId, nodeIds) {
	const ref = resolveCfnRef(value);
	if (!ref) return null;
	return scopedIdMatch(ref, ownerId, nodeIds);
}
/** Extract "type.name" from a TF interpolation like "${aws_x.y.attr}". */
function resolveTfRef(value) {
	if (typeof value !== "string") return null;
	const m = value.match(/\$\{([a-z0-9_]+\.[A-Za-z0-9_-]+)\./);
	return m ? m[1] : null;
}
/** Parse an event pattern that may be a CFN object or a Terraform JSON string. */
function parsePattern(raw) {
	if (raw != null && typeof raw === "object" && !Array.isArray(raw)) return raw;
	if (typeof raw === "string") try {
		const parsed = JSON.parse(raw);
		if (parsed != null && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
	} catch {
		return null;
	}
	return null;
}
function stringValues(value) {
	if (!Array.isArray(value) || value.length === 0) return null;
	return value.every((v) => typeof v === "string") ? value : null;
}
//#endregion
export { getAttLogicalId, parsePattern, resolveCfnRef, resolveTfRef, scopedCfnRef, scopedIdMatch, stringValues };
