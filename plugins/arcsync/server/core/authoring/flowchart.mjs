import { parseMeta } from "./meta.mjs";
//#region ../core/dist/authoring/flowchart.js
var DIRECTIONS = /* @__PURE__ */ new Map([
	["TB", ["TB"]],
	["TD", ["TB"]],
	["LR", ["LR"]],
	["RL", ["LR", "RL is drawn as LR"]],
	["BT", ["TB", "BT is drawn as TB"]]
]);
var MAX_FAN_OUT = 1e4;
var MAX_AUTHORED_EDGES = 2e4;
var edgeBudget = () => ({
	remaining: MAX_AUTHORED_EDGES,
	exhausted: false
});
var EDGE_KINDS = /* @__PURE__ */ new Set([
	"sync",
	"async",
	"data",
	"network",
	"iam"
]);
var DEFAULT_KIND = {
	normal: void 0,
	dotted: "async",
	thick: "sync"
};
var SHAPES = [
	[
		"(((",
		")))",
		"dbl-circ"
	],
	[
		"((",
		"))",
		"circle"
	],
	[
		"([",
		"])",
		"stadium"
	],
	[
		"[[",
		"]]",
		"subproc"
	],
	[
		"[(",
		")]",
		"cyl"
	],
	[
		"{{",
		"}}",
		"hex"
	],
	[
		"(",
		")",
		"rounded"
	],
	[
		"{",
		"}",
		"diam"
	],
	[
		">",
		"]",
		"odd"
	]
];
var SLANTED = {
	"/ /": "lean-r",
	"\\ \\": "lean-l",
	"/ \\": "trap-b",
	"\\ /": "trap-t"
};
var ACCESSIBILITY = /(accTitle|accDescr)\s*[:{]/y;
var ACC_BLOCK = /^\s*accDescr\s*\{/;
var KEYWORD = /(subgraph|end|direction|classDef|class|style|linkStyle|click)(?=\s|$)/y;
var HEADER = /(flowchart|graph)(?=\s|$)/y;
var DIRECTIVE = /^\s*%%/;
var HEADER_LINE = /^\s*(?:flowchart|graph)(?:\s|$)/;
var ID_CHAR = /[\p{L}\p{N}_]/u;
var HEADS = /* @__PURE__ */ new Set([
	">",
	"o",
	"x"
]);
var START_HEADS = /* @__PURE__ */ new Set([
	"<",
	"o",
	"x"
]);
var isSpace = (ch) => ch === " " || ch === "\n";
var defineAll = (target, source) => {
	for (const [k, v] of Object.entries(source)) Object.defineProperty(target, k, {
		value: v,
		enumerable: true,
		writable: true,
		configurable: true
	});
	return target;
};
var stripMarkdown = (label) => label.length >= 2 && label.startsWith("`") && label.endsWith("`") ? label.slice(1, -1) : label;
var unquote = (label) => {
	const t = label.trim();
	return t.length >= 2 && t.startsWith("\"") && t.endsWith("\"") ? stripMarkdown(t.slice(1, -1)) : t;
};
var splitStatements = (lines) => {
	const out = [];
	let cur;
	let metaDepth = 0;
	let joinable = false;
	let inAccBlock = false;
	const append = (text, line, column) => {
		if (!cur) cur = {
			text: "",
			segments: []
		};
		cur.segments.push({
			offset: cur.text.length,
			line,
			column
		});
		cur.text += text;
	};
	const finish = () => {
		const s = cur;
		cur = void 0;
		if (!s || s.text.trim() === "") return;
		const prev = out[out.length - 1];
		const head = s.text.trimStart()[0];
		if (prev && joinable && (head === "-" || head === "=" || head === "<")) {
			const base = prev.text.length + 1;
			prev.text += `\n${s.text}`;
			for (const seg of s.segments) prev.segments.push({
				...seg,
				offset: seg.offset + base
			});
		} else {
			out.push(s);
			joinable = !DIRECTIVE.test(s.text) && !HEADER_LINE.test(s.text);
		}
	};
	for (const { text, line } of lines) {
		if (cur) cur.text += "\n";
		if (inAccBlock || !cur && ACC_BLOCK.test(text)) {
			append(text, line, 1);
			inAccBlock = !text.includes("}");
			if (!inAccBlock) finish();
			continue;
		}
		let start = 0;
		let end = text.length;
		let quote = false;
		let metaQuote = "";
		let depth = 0;
		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			if (metaDepth > 0) {
				if (metaQuote) {
					if (ch === "\\") i++;
					else if (ch === metaQuote) metaQuote = "";
				} else if (ch === "\"" || ch === "'") metaQuote = ch;
				else if (ch === "{") metaDepth++;
				else if (ch === "}") metaDepth--;
			} else if (quote) {
				if (ch === "\"") quote = false;
			} else if (ch === "\"") quote = true;
			else if (ch === "@" && text[i + 1] === "{") {
				metaDepth = 1;
				i++;
			} else if (ch === "[" || ch === "(" || ch === "{") depth++;
			else if (ch === "]" || ch === ")" || ch === "}") depth = Math.max(0, depth - 1);
			else if (depth === 0 && ch === ";") {
				append(text.slice(start, i), line, start + 1);
				finish();
				start = i + 1;
			} else if (depth === 0 && ch === "%" && text[i + 1] === "%") {
				if (!cur && text.slice(start, i).trim() === "" && text[i + 2] === "{") {
					append(text.slice(i), line, i + 1);
					finish();
					start = text.length;
				}
				end = i;
				break;
			}
		}
		if (start < end || cur) append(text.slice(start, Math.max(start, end)), line, start + 1);
		if (metaDepth === 0) finish();
	}
	finish();
	return out;
};
var position = (s, offset) => {
	let lo = 0;
	let hi = s.segments.length - 1;
	while (lo < hi) {
		const mid = lo + hi + 1 >> 1;
		if (s.segments[mid].offset <= offset) lo = mid;
		else hi = mid - 1;
	}
	const seg = s.segments[lo];
	return {
		line: seg.line,
		column: seg.column + offset - seg.offset
	};
};
var ABORT = Symbol("abort");
var parseError = (message, offset) => Object.assign(new Error(message), { offset });
var parseFlowchart = (block, diags, budget = edgeBudget()) => {
	const blockName = block.id ?? `block-${block.index + 1}`;
	const nodes = /* @__PURE__ */ new Map();
	const edges = [];
	const classDefs = /* @__PURE__ */ new Map();
	const defined = /* @__PURE__ */ new Set();
	const edgeIds = /* @__PURE__ */ new Map();
	const stack = [];
	const pending = [];
	let direction = "TB";
	let generated = 0;
	const report = (level, message, line, column) => diags.add({
		level,
		block: blockName,
		line,
		column,
		message
	});
	const touch = (id, line) => {
		const top = stack[stack.length - 1]?.id;
		let node = nodes.get(id);
		if (!node) {
			node = {
				id,
				meta: {},
				isGroup: false,
				classes: [],
				line
			};
			if (top !== void 0) node.parent = top;
			nodes.set(id, node);
		} else if (!node.isGroup && node.parent === void 0 && top !== void 0) node.parent = top;
		return node;
	};
	const define = (node, line) => {
		if (defined.has(node.id)) return;
		defined.add(node.id);
		node.line = line;
	};
	const applyMeta = (node, meta) => {
		defineAll(node.meta, meta);
		if (typeof meta.shape === "string") node.shape = meta.shape;
		if (typeof meta.label === "string") node.label = meta.label;
	};
	const parseStyles = (text, line, column) => {
		const style = {};
		let ignored = false;
		const parts = [];
		let depth = 0;
		let from = 0;
		for (let i = 0; i <= text.length; i++) {
			const ch = text[i];
			if (ch === "(") depth++;
			else if (ch === ")") depth--;
			else if (i === text.length || ch === "," && depth <= 0) {
				parts.push(text.slice(from, i));
				from = i + 1;
			}
		}
		for (const part of parts) {
			const colon = part.indexOf(":");
			const key = part.slice(0, colon).trim();
			const value = part.slice(colon + 1).trim();
			if (colon > 0 && (key === "fill" || key === "stroke") && value) style[key] = value;
			else if (part.trim()) ignored = true;
		}
		if (ignored) report("warning", "only fill and stroke are drawn", line, column);
		return style;
	};
	const kindOf = (meta, style, pos) => {
		const raw = meta.kind;
		if (raw === void 0) return DEFAULT_KIND[style];
		if (typeof raw === "string" && EDGE_KINDS.has(raw)) return raw;
		report("warning", `unknown edge kind '${String(raw)}'`, pos.line, pos.column);
		return DEFAULT_KIND[style];
	};
	const setKind = (edge, kind) => {
		if (kind) edge.kind = kind;
		else delete edge.kind;
	};
	const parseStatement = (s) => {
		const t = s.text;
		let p = 0;
		const at = (offset) => position(s, offset);
		const fail = (message, offset = p) => {
			throw parseError(message, offset);
		};
		const isMetaAt = () => t[p] === "@" && t[p + 1] === "{";
		const skipSpace = () => {
			while (isSpace(t[p])) p++;
		};
		const atEnd = () => {
			skipSpace();
			return p >= t.length;
		};
		const readId = () => {
			const start = p;
			while (p < t.length) {
				const ch = t[p];
				if (ID_CHAR.test(ch)) p++;
				else if (ch === "-" && p > start && !"-.>".includes(t[p + 1] ?? ".")) p++;
				else if (ch === "." && p > start && ID_CHAR.test(t[p + 1] ?? "")) p++;
				else break;
			}
			return t.slice(start, p);
		};
		const readWords = () => {
			const words = [];
			while (!atEnd()) {
				const start = p;
				while (p < t.length && !isSpace(t[p])) p++;
				words.push({
					text: t.slice(start, p),
					offset: start
				});
			}
			return words;
		};
		const readQuoted = () => {
			const close = t.indexOf("\"", p + 1);
			if (close < 0) fail("unterminated string");
			const text = t.slice(p + 1, close);
			p = close + 1;
			return stripMarkdown(text);
		};
		const readMeta = () => {
			const start = p;
			let depth = 0;
			let quote = "";
			for (let i = p + 1; i < t.length; i++) {
				const ch = t[i];
				if (quote) {
					if (ch === "\\") i++;
					else if (ch === quote || ch === "\n") quote = "";
				} else if (ch === "\"" || ch === "'") quote = ch;
				else if (ch === "{") depth++;
				else if (ch === "}" && --depth === 0) {
					const pos = at(start + 1);
					const meta = parseMeta(t.slice(start + 1, i + 1), {
						block: blockName,
						...pos
					}, diags);
					if (!meta) throw ABORT;
					p = i + 1;
					return meta;
				}
			}
			return fail("metadata is never closed", start);
		};
		const readShape = () => {
			let close;
			let shape = "";
			let opener = "";
			if (t.startsWith("[/", p) || t.startsWith("[\\", p)) opener = t.slice(p, p + 2);
			else {
				const found = SHAPES.find(([open]) => t.startsWith(open, p));
				if (found) [opener, close, shape] = found;
				else if (t[p] === "[") [opener, close, shape] = [
					"[",
					"]",
					"rect"
				];
				else return void 0;
			}
			p += opener.length;
			const contentStart = p;
			const closeAt = () => {
				if (close !== void 0) return t.startsWith(close, p) ? p : -1;
				return t.startsWith("/]", p) || t.startsWith("\\]", p) ? p : -1;
			};
			let label;
			let end;
			if (t[p] === "\"") {
				label = readQuoted();
				end = closeAt();
			} else if (close !== void 0) {
				end = t.indexOf(close, p);
				label = t.slice(p, end).trim();
			} else {
				const a = t.indexOf("/]", p);
				const b = t.indexOf("\\]", p);
				end = a < 0 ? b : b < 0 ? a : Math.min(a, b);
				label = t.slice(p, end).trim();
			}
			if (end < 0) fail(`expected '${close ?? `${opener[1]}]`}'`, t[contentStart] === "\"" ? p : contentStart);
			if (close === void 0) {
				close = t.slice(end, end + 2);
				shape = SLANTED[`${opener[1]} ${close[0]}`];
			}
			p = end + close.length;
			return {
				label,
				shape
			};
		};
		const parseNodeRef = () => {
			const start = p;
			const id = readId();
			if (!id) fail("expected a node id");
			if (id === "end" || id === "subgraph") fail(`'${id}' cannot be a node id`, start);
			const { line } = at(start);
			if (isMetaAt() && edgeIds.has(id) && !nodes.has(id)) {
				const entry = edgeIds.get(id);
				const meta = readMeta();
				for (const edge of entry.edges) defineAll(edge.meta, meta);
				defineAll(entry.meta, meta);
				const kind = kindOf(entry.meta, entry.style, at(start));
				for (const edge of entry.edges) setKind(edge, kind);
				return;
			}
			const node = touch(id, line);
			const shape = readShape();
			if (shape) {
				node.label = shape.label;
				node.shape = shape.shape;
				define(node, line);
			}
			for (;;) if (t.startsWith(":::", p)) {
				p += 3;
				const cls = readId();
				if (!cls) fail("expected a class name");
				node.classes.push(cls);
			} else if (isMetaAt()) {
				applyMeta(node, readMeta());
				define(node, line);
			} else return id;
		};
		const parseGroup = () => {
			const ids = [];
			for (;;) {
				skipSpace();
				const id = parseNodeRef();
				if (id !== void 0) ids.push(id);
				const save = p;
				skipSpace();
				if (t[p] !== "&") {
					p = save;
					return ids;
				}
				p++;
			}
		};
		const findClose = (style, from) => {
			if (style === "dotted") {
				let idx = t.indexOf(".-", from);
				if (idx < 0) return void 0;
				let end = idx + 2;
				while (idx > from && t[idx - 1] === ".") idx--;
				if (HEADS.has(t[end])) end++;
				return {
					start: idx,
					end
				};
			}
			const ch = style === "thick" ? "=" : "-";
			let search = from;
			for (;;) {
				const idx = t.indexOf(ch + ch, search);
				if (idx < 0) return void 0;
				let end = idx;
				while (t[end] === ch) end++;
				if (HEADS.has(t[end])) return {
					start: idx,
					end: end + 1
				};
				if (end - idx >= 3) return {
					start: idx,
					end
				};
				search = end;
			}
		};
		const parseArrow = () => {
			const start = p;
			let edgeId;
			if (ID_CHAR.test(t[p])) {
				const id = readId();
				if (t[p] === "@" && t[p + 1] !== "{") {
					edgeId = id;
					p++;
					const pos = at(start);
					report("warning", "edge ids are ignored", pos.line, pos.column);
				} else p = start;
			}
			const arrowStart = p;
			let bidirectional = false;
			if (START_HEADS.has(t[p]) && (t[p + 1] === "-" || t[p + 1] === "=")) {
				bidirectional = true;
				p++;
			}
			const c = t[p];
			if (c === "~" && !bidirectional) {
				while (t[p] === "~") p++;
				if (p - arrowStart >= 3) return {
					arrowStart,
					style: "normal",
					bidirectional,
					label: void 0,
					meta: {},
					edgeId: void 0,
					invisible: true
				};
			}
			if (c !== "-" && c !== "=") fail("expected an arrow", arrowStart);
			let style;
			let open;
			const bodyStart = p;
			if (c === "-" && t[p + 1] === ".") {
				style = "dotted";
				p++;
				while (t[p] === ".") p++;
				if (t[p] === "-") {
					p++;
					open = false;
				} else open = p - bodyStart === 2;
				if (!open && t[p - 1] !== "-") fail("expected an arrow", arrowStart);
			} else {
				style = c === "=" ? "thick" : "normal";
				while (t[p] === c) p++;
				open = p - bodyStart === 2 && !HEADS.has(t[p]);
				if (p - bodyStart < 2) fail("expected an arrow", arrowStart);
			}
			if (!open && HEADS.has(t[p])) p++;
			else if (!open && bidirectional) fail("expected an arrow", arrowStart);
			let label;
			let meta = {};
			if (open) {
				skipSpace();
				if (t[p] === "\"") {
					label = readQuoted();
					if (isMetaAt()) meta = readMeta();
					skipSpace();
					const close = findClose(style, p);
					if (close?.start !== p) fail("expected an arrow after the label");
					p = close.end;
				} else {
					const close = findClose(style, p);
					if (!close) fail("edge label is never closed", arrowStart);
					const { start: cs, end: ce } = close;
					const inLabel = t.slice(p, cs).indexOf("@{");
					const metaAt = inLabel < 0 ? -1 : p + inLabel;
					if (metaAt >= 0) {
						label = t.slice(p, metaAt).trim();
						p = metaAt;
						meta = readMeta();
						skipSpace();
						const after = findClose(style, p);
						if (after?.start !== p) fail("expected an arrow after the label");
						p = after.end;
					} else {
						label = t.slice(p, cs).trim();
						p = ce;
					}
				}
			} else {
				const save = p;
				skipSpace();
				if (t[p] === "|") {
					const close = t.indexOf("|", p + 1);
					if (close < 0) fail("edge label is never closed", p);
					label = unquote(t.slice(p + 1, close));
					p = close + 1;
					if (isMetaAt()) meta = readMeta();
				} else p = save;
			}
			return {
				arrowStart,
				style,
				bidirectional,
				label: label || void 0,
				meta,
				edgeId,
				invisible: false
			};
		};
		const parseChain = () => {
			let left = parseGroup();
			while (!atEnd()) {
				const arrow = parseArrow();
				if (atEnd()) fail("edge has no target", arrow.arrowStart);
				const right = parseGroup();
				if (left.length * right.length > MAX_FAN_OUT) fail(`one arrow cannot make more than ${MAX_FAN_OUT} edges`, arrow.arrowStart);
				const pos = at(arrow.arrowStart);
				if (arrow.invisible) {
					report("warning", "invisible links are not drawn", pos.line, pos.column);
					left = right;
					continue;
				}
				if (!budget.exhausted && left.length * right.length > budget.remaining) {
					budget.exhausted = true;
					report("error", "too many edges in this diagram (over 20,000)", pos.line, pos.column);
				}
				if (budget.exhausted) {
					left = right;
					continue;
				}
				const made = [];
				for (const source of left) for (const target of right) {
					const edge = {
						source,
						target,
						meta: defineAll({}, arrow.meta),
						bidirectional: arrow.bidirectional,
						line: pos.line
					};
					if (arrow.label !== void 0) edge.label = arrow.label;
					edges.push(edge);
					made.push(edge);
				}
				budget.remaining -= made.length;
				const kind = kindOf(arrow.meta, arrow.style, pos);
				for (const edge of made) setKind(edge, kind);
				if (arrow.edgeId) edgeIds.set(arrow.edgeId, {
					edges: made,
					style: arrow.style,
					meta: defineAll({}, arrow.meta)
				});
				left = right;
			}
		};
		const setDirection = (word, offset) => {
			const pos = at(offset);
			const entry = DIRECTIONS.get(word);
			if (!entry) fail(`unknown direction '${word}'`, offset);
			const [dir, note] = entry;
			direction = dir;
			if (note) report("info", note, pos.line, pos.column);
		};
		const parseSubgraph = (keywordAt) => {
			let id;
			let label;
			let meta;
			try {
				if (atEnd()) fail("subgraph needs an id or a title", keywordAt);
				if (t[p] === "\"") label = readQuoted();
				else {
					const idAt = p;
					id = readId();
					if (!id) fail("subgraph needs an id or a title", keywordAt);
					skipSpace();
					const shape = readShape();
					if (shape) label = shape.label;
					else if (!isMetaAt() && !atEnd()) {
						label = t.slice(idAt).trim();
						id = void 0;
						p = t.length;
					}
					skipSpace();
				}
				if (isMetaAt()) meta = readMeta();
				if (!atEnd()) fail(`unexpected text '${t.slice(p).trim()}'`);
			} finally {
				if (id === void 0) do
					id = `subGraph${generated++}`;
				while (nodes.has(id));
				const pos = at(keywordAt);
				const node = touch(id, pos.line);
				node.isGroup = true;
				if (label !== void 0) node.label = label;
				if (meta) applyMeta(node, meta);
				define(node, pos.line);
				stack.push({
					id,
					...pos
				});
			}
		};
		skipSpace();
		const stmtStart = p;
		ACCESSIBILITY.lastIndex = p;
		const accessibility = ACCESSIBILITY.exec(t)?.[1];
		if (accessibility) {
			const pos = at(stmtStart);
			report("warning", `${accessibility} is ignored`, pos.line, pos.column);
			return;
		}
		KEYWORD.lastIndex = p;
		const keyword = KEYWORD.exec(t)?.[1];
		if (!keyword) {
			parseChain();
			return;
		}
		p += keyword.length;
		const pos = at(stmtStart);
		if (keyword === "subgraph") {
			parseSubgraph(stmtStart);
			return;
		}
		if (keyword === "end") {
			if (!stack.pop()) report("error", "'end' has no matching subgraph", pos.line, pos.column);
			if (!atEnd()) fail(`unexpected text '${t.slice(p).trim()}'`);
			return;
		}
		const words = readWords();
		const [first, second] = words;
		if (keyword === "direction") {
			if (stack.length > 0) report("info", "direction inside a subgraph is ignored", pos.line, pos.column);
			else {
				if (!first) fail("direction needs a value", stmtStart);
				const { text, offset } = first;
				setDirection(text, offset);
			}
		} else if (keyword === "linkStyle") report("warning", "linkStyle is ignored", pos.line, pos.column);
		else if (keyword === "classDef") {
			if (!first || !second) fail("classDef needs a name and styles", stmtStart);
			const style = parseStyles(t.slice(second.offset), pos.line, pos.column);
			for (const name of first.text.split(",").filter(Boolean)) classDefs.set(name, style);
		} else if (keyword === "class") {
			if (!first || !second) fail("class needs node ids and a class name", stmtStart);
			for (const id of first.text.split(",").filter(Boolean)) pending.push({
				op: "class",
				id,
				value: second.text,
				...pos
			});
		} else if (keyword === "style") {
			if (!first || !second) fail("style needs a node id and styles", stmtStart);
			const value = parseStyles(t.slice(second.offset), pos.line, pos.column);
			pending.push({
				op: "style",
				id: first.text,
				value,
				...pos
			});
		} else {
			const target = second?.text === "href" ? words[2] : second;
			if (!first || !target) fail("click needs a node id and a quoted URL", stmtStart);
			const { offset } = target;
			if (t[offset] === "\"") {
				p = offset;
				pending.push({
					op: "link",
					id: first.text,
					value: readQuoted(),
					...pos
				});
			} else report("warning", "click callbacks are ignored", pos.line, pos.column);
		}
	};
	const parseHeader = (s) => {
		const t = s.text;
		const lead = t.length - t.trimStart().length;
		HEADER.lastIndex = lead;
		const match = HEADER.exec(t);
		const first = s.segments[0];
		if (!match) {
			report("error", "a flowchart must start with flowchart or graph", first.line, first.column + lead);
			return false;
		}
		const rest = t.slice(lead + match[0].length);
		const word = rest.trim();
		if (word === "") return true;
		const entry = DIRECTIONS.get(word);
		const column = first.column + lead + match[0].length + rest.indexOf(word);
		if (!entry) report("error", `unknown direction '${word}'`, first.line, column);
		else {
			direction = entry[0];
			if (entry[1]) report("info", entry[1], first.line, column);
		}
		return true;
	};
	let sawHeader = false;
	for (const s of splitStatements(block.lines)) {
		const first = s.segments[0];
		const lead = s.text.length - s.text.trimStart().length;
		if (s.text.trimStart().startsWith("%%{")) {
			report("warning", "%%{init}%% is ignored", first.line, first.column + lead);
			continue;
		}
		if (!sawHeader) {
			sawHeader = true;
			if (parseHeader(s)) continue;
		}
		try {
			parseStatement(s);
		} catch (e) {
			if (e === ABORT) continue;
			if (!(e instanceof Error) || !("offset" in e)) throw e;
			const pos = position(s, e.offset);
			report("error", e.message, pos.line, pos.column);
		}
	}
	for (const open of stack) report("error", `subgraph '${open.id}' has no matching end`, open.line, open.column);
	for (const op of pending) {
		const node = nodes.get(op.id);
		if (!node) {
			report("warning", `unknown node '${op.id}'`, op.line, op.column);
			continue;
		}
		if (op.op === "class") node.classes.push(op.value);
		else if (op.op === "link") node.link = op.value;
		else node.style = {
			...node.style,
			...op.value
		};
	}
	return {
		direction,
		nodes,
		edges,
		classDefs
	};
};
//#endregion
export { MAX_AUTHORED_EDGES, edgeBudget, parseFlowchart };
