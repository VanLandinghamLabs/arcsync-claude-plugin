var START = /^erDiagram\b/;
var NAME = String.raw`[A-Za-z_][\w-]*`;
var ALIAS = String.raw`(?:\[\s*"?([^"\]]*)"?\s*\])?`;
var RELATIONSHIP = new RegExp(String.raw`^(${NAME})${ALIAS}\s*(\|o|\|\||\}o|\}\|)(--|\.\.|\.-|-\.)(o\||\|\||o\{|\|\{)\s*(${NAME})${ALIAS}\s*(?::\s*(.*))?$`);
var WORD_CARDINALITY = String.raw`zero or one|one or zero|only one|zero or more|zero or many|one or more|one or many|many\(0\)|many\(1\)|0\+|1\+|1`;
var WORD_RELATIONSHIP = new RegExp(String.raw`^(${NAME})${ALIAS}\s+(${WORD_CARDINALITY})\s+(to|optionally to)\s+(${WORD_CARDINALITY})\s+(${NAME})${ALIAS}\s*(?::\s*(.*))?$`, "i");
var ENTITY_OPEN = new RegExp(String.raw`^(${NAME})${ALIAS}\s*\{\s*(\})?\s*$`);
var DIRECTIVE = /^(?:direction|accTitle|accDescr|style|classDef|class)(?=\s|:|$)|^title:/;
var ENTITY_BARE = new RegExp(String.raw`^(${NAME})${ALIAS}$`);
var FIELD = /^([\w()[\],.-]+)\s+([\w*-]+)((?:\s+(?:PK|FK|UK)(?:\s*,\s*(?:PK|FK|UK))*)?)\s*(?:"([^"]*)")?$/;
var LEFT = {
	"|o": "zero-or-one",
	"||": "one",
	"}o": "many",
	"}|": "one-or-many"
};
var RIGHT = {
	"o|": "zero-or-one",
	"||": "one",
	"o{": "many",
	"|{": "one-or-many"
};
var WORDS = {
	"zero or one": "zero-or-one",
	"one or zero": "zero-or-one",
	"only one": "one",
	"1": "one",
	"zero or more": "many",
	"zero or many": "many",
	"many(0)": "many",
	"0+": "many",
	"one or more": "one-or-many",
	"one or many": "one-or-many",
	"many(1)": "one-or-many",
	"1+": "one-or-many"
};
var unquote = (s) => s.trim().replace(/^"(.*)"$/, "$1");
/**
* A Mermaid `erDiagram` block as a `DataModel`. Unrecognised lines are reported
* and skipped rather than failing the block, matching the other block parsers.
*/
function parseErDiagram(block, diags) {
	const blockId = block.id ?? `block-${block.index + 1}`;
	const entities = /* @__PURE__ */ new Map();
	const relationships = [];
	const aliases = /* @__PURE__ */ new Map();
	const capped = /* @__PURE__ */ new Set();
	const warn = (line, message) => diags.add({
		level: "warning",
		block: blockId,
		line,
		column: 1,
		message
	});
	const entity = (name, alias, line) => {
		let e = entities.get(name);
		if (!e) {
			if (entities.size >= 60) {
				warn(line, `more than 60 entities; the rest are dropped`);
				return;
			}
			e = {
				name,
				kind: "ENTITY",
				fields: []
			};
			entities.set(name, e);
		}
		if (alias?.trim()) aliases.set(name, alias.trim());
		return e;
	};
	let open;
	let seenHeader = false;
	for (const { text, line } of block.lines) {
		const t = text.trim();
		if (t === "" || t.startsWith("%%")) continue;
		if (!seenHeader) {
			if (START.test(t)) seenHeader = true;
			continue;
		}
		if (open) {
			if (t === "}") {
				open = void 0;
				continue;
			}
			const m = FIELD.exec(t);
			if (!m) {
				warn(line, `can't read field '${t}'; expected 'type name [PK|FK|UK] ["comment"]'`);
				continue;
			}
			if (open.fields.length >= 80) {
				if (!capped.has(open)) warn(line, `more than 80 fields on '${open.name}'; the rest are dropped`);
				capped.add(open);
				continue;
			}
			const keys = (m[3] ?? "").split(/[\s,]+/).filter((k) => k === "PK" || k === "FK" || k === "UK");
			const field = {
				name: m[2],
				type: m[1],
				keys,
				...m[4] ? { comment: m[4] } : {}
			};
			open.fields.push(field);
			continue;
		}
		if (DIRECTIVE.test(t)) continue;
		const symbols = RELATIONSHIP.exec(t);
		const words = symbols ? void 0 : WORD_RELATIONSHIP.exec(t);
		const rel = symbols ?? words;
		if (rel) {
			const [, a, aAlias, left, link, right, b, bAlias, label] = rel;
			const from = entity(a, aAlias, line);
			const to = entity(b, bAlias, line);
			const word = (w) => WORDS[w.toLowerCase().replace(/\s+/g, " ")];
			if (from && to) relationships.push({
				from: from.name,
				to: to.name,
				fromCardinality: words ? word(left) : LEFT[left],
				toCardinality: words ? word(right) : RIGHT[right],
				identifying: words ? link.toLowerCase() === "to" : link === "--",
				...label && unquote(label) ? { label: unquote(label) } : {}
			});
			continue;
		}
		const opened = ENTITY_OPEN.exec(t);
		if (opened) {
			const found = entity(opened[1], opened[2], line);
			if (!opened[3]) open = found ?? {
				name: opened[1],
				kind: "ENTITY",
				fields: []
			};
			continue;
		}
		const bare = ENTITY_BARE.exec(t);
		if (bare) {
			entity(bare[1], bare[2], line);
			continue;
		}
		warn(line, `can't read '${t}'`);
	}
	if (open) warn(block.lines.at(-1)?.line ?? 1, `entity '${open.name}' is missing its closing }`);
	return {
		entities: [...entities.values()].map((e) => {
			const label = aliases.get(e.name);
			return label && label !== e.name ? {
				...e,
				label
			} : e;
		}),
		relationships
	};
}
//#endregion
export { parseErDiagram };
