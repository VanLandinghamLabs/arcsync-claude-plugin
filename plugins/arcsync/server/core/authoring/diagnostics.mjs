//#region ../core/dist/authoring/diagnostics.js
var createDiagnostics = () => {
	const items = [];
	return {
		add: (d) => {
			items.push(d);
		},
		list: () => [...items],
		hasErrors: () => items.some((d) => d.level === "error")
	};
};
var LEVEL_ORDER = {
	error: 0,
	warning: 1,
	info: 2
};
/**
* Diagram text is untrusted and unbounded, so every report of its diagnostics
* goes through one cap: identical (level, message) pairs fold into the first,
* errors sort first, and long author text is clipped.
*/
var capDiagnostics = (list, { max = 200, messageChars = 300 } = {}) => {
	const byKey = /* @__PURE__ */ new Map();
	for (const d of list) {
		const key = `${d.level}\u0000${d.message}`;
		const seen = byKey.get(key);
		if (seen) seen.count = (seen.count ?? 1) + 1;
		else byKey.set(key, { ...d });
	}
	const clip = (text) => text.length > messageChars ? `${text.slice(0, messageChars)}…` : text;
	return [...byKey.values()].sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]).slice(0, max).map((d) => ({
		...d,
		block: clip(d.block),
		message: clip(d.message),
		...d.suggestion !== void 0 && { suggestion: clip(d.suggestion) }
	}));
};
//#endregion
export { capDiagnostics, createDiagnostics };
