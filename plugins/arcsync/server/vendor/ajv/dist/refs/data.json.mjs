import { __esmMin, __exportAll } from "../../../../_virtual/_rolldown/runtime.mjs";
//#region ../../node_modules/.pnpm/ajv@8.20.0/node_modules/ajv/dist/refs/data.json
var data_exports = /* @__PURE__ */ __exportAll({
	$id: () => $id,
	additionalProperties: () => false,
	default: () => data_default,
	description: () => description,
	properties: () => properties,
	required: () => required,
	type: () => type
}), $id, description, type, required, properties, data_default;
var init_data = __esmMin((() => {
	$id = "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#";
	description = "Meta-schema for $data reference (JSON AnySchema extension proposal)";
	type = "object";
	required = ["$data"];
	properties = { "$data": {
		"type": "string",
		"anyOf": [{ "format": "relative-json-pointer" }, { "format": "json-pointer" }]
	} };
	data_default = {
		$id,
		description,
		type,
		required,
		properties,
		additionalProperties: false
	};
}));
//#endregion
init_data();
export { $id, data_exports, data_default as default, description, init_data, properties, required, type };
