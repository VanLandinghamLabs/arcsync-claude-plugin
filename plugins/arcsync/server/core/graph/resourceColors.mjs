import "./types.mjs";
import "./resourceCategory.mjs";
//#region ../core/dist/graph/resourceColors.js
/** One palette per `ResourceCategory`; `generic` draws `DEFAULT_COLOR`. */
var CATEGORY_COLORS = {
	networking: {
		bg: "#fed7aa",
		border: "#ea580c",
		darkBg: "#7c2d12",
		darkBorder: "#fb923c"
	},
	compute: {
		bg: "#dbeafe",
		border: "#2563eb",
		darkBg: "#1e3a5f",
		darkBorder: "#60a5fa"
	},
	storage: {
		bg: "#dcfce7",
		border: "#16a34a",
		darkBg: "#14532d",
		darkBorder: "#4ade80"
	},
	security: {
		bg: "#f3e8ff",
		border: "#9333ea",
		darkBg: "#3b0764",
		darkBorder: "#c084fc"
	},
	messaging: {
		bg: "#fef3c7",
		border: "#d97706",
		darkBg: "#78350f",
		darkBorder: "#fbbf24"
	},
	events: {
		bg: "#fce7f3",
		border: "#db2777",
		darkBg: "#831843",
		darkBorder: "#f472b6"
	},
	infra: {
		bg: "#f8fafc",
		border: "#94a3b8",
		darkBg: "#1e293b",
		darkBorder: "#64748b"
	}
};
CATEGORY_COLORS.networking, CATEGORY_COLORS.security;
//#endregion
export { CATEGORY_COLORS };
