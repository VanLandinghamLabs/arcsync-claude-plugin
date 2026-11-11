//#region ../core/dist/authoring/stateDiagram.js
var MAX_AUTHORED_STATES = 2e3;
var MAX_AUTHORED_TRANSITIONS = 2e4;
var stateBudget = () => ({
	states: MAX_AUTHORED_STATES,
	transitions: MAX_AUTHORED_TRANSITIONS,
	statesCapped: false,
	transitionsCapped: false
});
var MAX_DEPTH = 32;
var KINDS = /* @__PURE__ */ new Set([
	"choice",
	"fork",
	"join"
]);
var HEADER = /stateDiagram(?:-v2)?(?=\s|$)/y;
var KEYWORD = /(state|style|note|direction|classDef|class)(?=\s|$)/y;
var END_NOTE = /end +note *$/y;
var NOTE_SIDE = /(?:left|right) +of(?=\s)/y;
var AS = /as(?=\s)/y;
var ACCESSIBILITY = /(accTitle|accDescr) *([:{])/y;
var ID_CHAR = /[\p{L}\p{N}_]/u;
var newRegion = () => ({
	states: /* @__PURE__ */ new Map(),
	transitions: []
});
var stripComment = (text) => {
	let quote = false;
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === "\"") quote = !quote;
		else if (!quote && ch === "%" && text[i + 1] === "%") return text.slice(0, i);
	}
	return text;
};
var stripMarkdown = (label) => label.length >= 2 && label.startsWith("`") && label.endsWith("`") ? label.slice(1, -1) : label;
var parseError = (message, offset) => Object.assign(new Error(message), { offset });
var parseStateDiagram = (block, diags, budget = stateBudget()) => {
	const blockName = block.id ?? `block-${block.index + 1}`;
	const root = newRegion();
	const all = /* @__PURE__ */ new Map();
	const stack = [];
	let skipDepth = 0;
	let accBlock = false;
	let note;
	const report = (level, message, line, column) => diags.add({
		level,
		block: blockName,
		line,
		column,
		message
	});
	const current = () => stack[stack.length - 1]?.region ?? root;
	const ensure = (id, line, column) => {
		const existing = all.get(id);
		if (existing) return existing;
		if (budget.states <= 0) {
			if (!budget.statesCapped) report("error", "too many states in this diagram (over 2,000)", line, column);
			budget.statesCapped = true;
			return;
		}
		budget.states--;
		const def = {
			id,
			description: [],
			kind: "state",
			line
		};
		current().states.set(id, def);
		all.set(id, def);
		return def;
	};
	const parseLine = (t, line, lead) => {
		let p = lead;
		const column = lead + 1;
		const fail = (message, offset = p) => {
			throw parseError(message, offset);
		};
		const skipSpace = () => {
			while (t[p] === " ") p++;
		};
		const atEnd = () => {
			skipSpace();
			return p >= t.length;
		};
		const rest = () => t.slice(p).trim();
		const sticky = (re) => {
			re.lastIndex = p;
			const m = re.exec(t);
			if (m) p = re.lastIndex;
			return m;
		};
		const readId = () => {
			const start = p;
			while (p < t.length) {
				const ch = t[p];
				if (ID_CHAR.test(ch)) p++;
				else if (ch === "-" && p > start && !t.startsWith("->", p + 1)) p++;
				else if (ch === "." && p > start) p++;
				else break;
			}
			return t.slice(start, p);
		};
		const readRef = () => {
			const offset = p;
			if (t.startsWith("[*]", p)) {
				p += 3;
				return {
					kind: "start",
					id: "[*]",
					offset
				};
			}
			for (const h of ["[H]", "[H*]"]) if (t.startsWith(h, p)) {
				p += h.length;
				return {
					kind: "history",
					id: h,
					offset
				};
			}
			const id = readId();
			if (!id) fail("expected a state id");
			if (t.startsWith(":::", p)) {
				report("warning", "::: is ignored on state diagrams", line, p + 1);
				p += 3;
				readId();
			}
			return {
				kind: "id",
				id,
				offset
			};
		};
		const warnHistory = (ref) => {
			if (ref.kind !== "history") return false;
			report("warning", "history states are not drawn", line, ref.offset + 1);
			return true;
		};
		const describe = (def) => {
			p++;
			const text = rest();
			if (def && text) def.description.push(text);
		};
		const trimmed = t.trim();
		if (trimmed === "}") {
			if (!stack.pop()) fail("'}' has no matching state");
			return;
		}
		if (trimmed === "--") {
			const top = stack[stack.length - 1];
			if (!top) {
				report("warning", "concurrency outside a composite state is ignored", line, column);
				return;
			}
			top.region = newRegion();
			top.def.children.push(top.region);
			return;
		}
		if (sticky(END_NOTE)) fail("'end note' has no matching note", lead);
		const acc = sticky(ACCESSIBILITY);
		if (acc) {
			report("warning", `${acc[1]} is ignored`, line, column);
			accBlock = acc[2] === "{" && !t.includes("}", p);
			return;
		}
		const keyword = sticky(KEYWORD)?.[1];
		if (keyword === "direction") {
			report("info", "direction is ignored", line, column);
			return;
		}
		if (keyword === "classDef" || keyword === "class" || keyword === "style") {
			report("warning", `${keyword} is ignored on state diagrams`, line, column);
			return;
		}
		if (keyword === "note") {
			skipSpace();
			if (t[p] === "\"") {
				report("warning", "floating notes are not drawn", line, column);
				return;
			}
			if (!sticky(NOTE_SIDE)) fail("expected 'note left of' or 'note right of'");
			skipSpace();
			const idAt = p;
			const id = readId();
			if (!id) fail("expected a state id");
			skipSpace();
			if (t[p] === ":") describe(ensure(id, line, idAt + 1));
			else if (atEnd()) note = {
				def: ensure(id, line, idAt + 1),
				lines: [],
				line,
				column
			};
			else fail(`unexpected text '${rest()}'`);
			return;
		}
		if (keyword === "state") {
			skipSpace();
			let label;
			if (t[p] === "\"") {
				const close = t.indexOf("\"", p + 1);
				if (close < 0) fail("unterminated string");
				label = stripMarkdown(t.slice(p + 1, close));
				p = close + 1;
				skipSpace();
				if (!sticky(AS)) fail("expected 'as'");
				skipSpace();
			}
			const idAt = p;
			const id = readId();
			if (!id) fail("expected a state id");
			skipSpace();
			let kind;
			if (t.startsWith("<<", p)) {
				const close = t.indexOf(">>", p + 2);
				if (close < 0) fail("expected '>>'");
				const name = t.slice(p + 2, close);
				if (!KINDS.has(name)) fail(`unknown state type '<<${name}>>'`);
				kind = name;
				p = close + 2;
				skipSpace();
			}
			const opens = t[p] === "{";
			if (opens) {
				if (kind) fail(`a ${kind} state cannot have children`);
				p++;
			}
			if (t[p] !== ":" && !atEnd()) fail(`unexpected text '${rest()}'`);
			if (opens && stack.length >= MAX_DEPTH) {
				report("error", `states nested deeper than ${MAX_DEPTH}`, line, column);
				skipDepth = 1;
				return;
			}
			const def = ensure(id, line, idAt + 1);
			if (!def) return;
			if (label !== void 0) def.label = label;
			if (kind) def.kind = kind;
			if (t[p] === ":") describe(def);
			if (opens) {
				def.children ??= [newRegion()];
				stack.push({
					def,
					region: def.children[def.children.length - 1],
					line,
					column
				});
			}
			return;
		}
		const from = readRef();
		skipSpace();
		if (t.startsWith("-->", p)) {
			p += 3;
			skipSpace();
			const to = readRef();
			skipSpace();
			let label;
			if (t[p] === ":") {
				p++;
				label = rest() || void 0;
			} else if (!atEnd()) fail(`unexpected text '${rest()}'`);
			const history = warnHistory(from);
			if (warnHistory(to) || history) return;
			if (![from, to].every((r) => r.kind === "start" || ensure(r.id, line, r.offset + 1))) return;
			if (budget.transitions <= 0) {
				if (!budget.transitionsCapped) report("error", "too many transitions in this diagram (over 20,000)", line, column);
				budget.transitionsCapped = true;
				return;
			}
			budget.transitions--;
			const transition = {
				from: from.id,
				to: to.id,
				line
			};
			if (label !== void 0) transition.label = label;
			current().transitions.push(transition);
			return;
		}
		if (from.kind === "start") fail("[*] can only be used in a transition", from.offset);
		if (warnHistory(from)) return;
		if (t[p] === ":") describe(ensure(from.id, line, from.offset + 1));
		else if (atEnd()) ensure(from.id, line, from.offset + 1);
		else fail(`unexpected text '${rest()}'`);
	};
	let sawHeader = false;
	let frontMatter = "none";
	for (const { text, line } of block.lines) {
		const trimmed = text.trim();
		const lead = text.length - text.trimStart().length;
		if (note) {
			END_NOTE.lastIndex = lead;
			if (END_NOTE.test(text)) {
				if (note.def && note.lines.length > 0) note.def.description.push(note.lines.join("\n"));
				note = void 0;
			} else if (trimmed) note.lines.push(trimmed);
			continue;
		}
		if (accBlock) {
			accBlock = !text.includes("}");
			continue;
		}
		if (!sawHeader && frontMatter !== "done" && trimmed === "---") {
			frontMatter = frontMatter === "none" ? "in" : "done";
			continue;
		}
		if (frontMatter === "in") continue;
		if (trimmed === "") continue;
		if (trimmed.startsWith("%%")) {
			if (trimmed.startsWith("%%{")) report("warning", "%%{init}%% is ignored", line, lead + 1);
			continue;
		}
		const code = stripComment(text);
		const body = code.trim();
		if (!sawHeader) {
			sawHeader = true;
			HEADER.lastIndex = lead;
			if (!HEADER.exec(code)) {
				report("error", "a state diagram must start with stateDiagram-v2", line, lead + 1);
				return { root };
			}
			const after = code.slice(HEADER.lastIndex);
			const word = after.trim();
			if (word) {
				const at = HEADER.lastIndex + after.indexOf(word) + 1;
				report("error", `unexpected text '${word}'`, line, at);
			}
			continue;
		}
		if (skipDepth > 0) {
			if (body === "}") skipDepth--;
			else if (body.endsWith("{")) skipDepth++;
			continue;
		}
		try {
			parseLine(code, line, lead);
		} catch (e) {
			if (!(e instanceof Error) || !("offset" in e)) throw e;
			report("error", e.message, line, e.offset + 1);
		}
	}
	if (note) report("error", "note is never closed (expected end note)", note.line, note.column);
	for (const open of stack) report("error", `state '${open.def.id}' has no matching }`, open.line, open.column);
	return { root };
};
//#endregion
export { MAX_AUTHORED_STATES, MAX_AUTHORED_TRANSITIONS, parseStateDiagram, stateBudget };
