import { GENERIC_ICON_IDS, ICON_SUBPATHS } from "../icons/iconAssets.mjs";
//#region ../core/dist/authoring/icons.js
/** Friendly id → canonical file-stem id, for names authors reach for that the
* icon files spell differently. Every target must be a real vendor stem. */
var ICON_ALIASES = Object.freeze({
	"aws:alb": "aws:elb",
	"aws:apigateway": "aws:api-gateway",
	"aws:aurora": "aws:rds",
	"aws:firehose": "aws:kinesis-firehose",
	"aws:http-api": "aws:api-gateway",
	"aws:nlb": "aws:elb",
	"aws:rest-api": "aws:api-gateway",
	"aws:sfn": "aws:step-functions",
	"aws:subnet": "aws:vpc",
	"azure:aks": "azure:kubernetes",
	"azure:app-service": "azure:app-services",
	"azure:event-hubs": "azure:event-hub",
	"azure:functions": "azure:function-apps",
	"azure:redis": "azure:redis-cache",
	"azure:service-bus-queue": "azure:service-bus",
	"azure:sql": "azure:sql-database",
	"azure:subnet": "azure:virtual-network",
	"azure:vm": "azure:virtual-machine",
	"azure:vnet": "azure:virtual-network",
	"gcp:functions": "gcp:cloud-functions",
	"gcp:gcs": "gcp:cloud-storage",
	"gcp:load-balancer": "gcp:cloud-load-balancing",
	"gcp:spanner": "gcp:cloud-spanner"
});
var VENDOR_TYPES = /* @__PURE__ */ new Map();
for (const [type, subpath] of Object.entries(ICON_SUBPATHS)) {
	const id = subpath.replace("/", ":").replace(/\.svg$/, "");
	if (!VENDOR_TYPES.has(id)) VENDOR_TYPES.set(id, type);
}
var GENERIC = new Set(GENERIC_ICON_IDS);
var ALIASES = new Map(Object.entries(ICON_ALIASES));
var resolveIcon = (id) => {
	const key = id.trim().toLowerCase();
	const canonical = ALIASES.get(key) ?? key;
	const generic = canonical.startsWith("generic:") ? canonical.slice(8) : canonical;
	if (GENERIC.has(generic)) return {
		type: "authored",
		icon: generic
	};
	const type = VENDOR_TYPES.get(canonical);
	return type === void 0 ? void 0 : {
		type,
		icon: canonical
	};
};
var vendorOf = (id) => {
	const prefix = id.slice(0, id.indexOf(":"));
	return prefix === "aws" || prefix === "gcp" || prefix === "azure" ? prefix : "generic";
};
var ALL_IDS = [.../* @__PURE__ */ new Set([
	...GENERIC_ICON_IDS,
	...VENDOR_TYPES.keys(),
	...ALIASES.keys()
])].sort();
var MAX_SUGGEST_LENGTH = 64;
var distance = (a, b) => {
	let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		const cur = [i];
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
		}
		prev = cur;
	}
	return prev[b.length];
};
var suggestIcon = (id) => {
	const key = id.trim().toLowerCase();
	if (key.length > MAX_SUGGEST_LENGTH) return void 0;
	let best;
	let bestDistance = 4;
	for (const candidate of ALL_IDS) {
		if (Math.abs(candidate.length - key.length) >= bestDistance) continue;
		const d = distance(key, candidate);
		if (d < bestDistance) {
			best = candidate;
			bestDistance = d;
		}
	}
	return best;
};
var listIcons = (query) => {
	const q = query?.trim().toLowerCase() ?? "";
	return ALL_IDS.filter((id) => id.includes(q)).map((id) => ({
		id,
		vendor: vendorOf(id)
	}));
};
//#endregion
export { ICON_ALIASES, listIcons, resolveIcon, suggestIcon };
