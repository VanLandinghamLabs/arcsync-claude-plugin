//#region ../core/dist/authoring/meta.js
var MAX_DEPTH = 32;
var IDENT_START = /[A-Za-z_$]/;
var IDENT_PART = /[A-Za-z0-9_$-]/;
var WORD = /[A-Za-z_][A-Za-z0-9_-]*/y;
var LITERALS = /* @__PURE__ */ new Map([
	["true", true],
	["false", false],
	["null", null]
]);
var NUMBER = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
var ESCAPES = {
	n: "\n",
	t: "	",
	r: "\r"
};
var metaError = (message, offset) => Object.assign(new Error(message), { offset });
var parseMeta = (text, at, diags) => {
	let pos = 0;
	const fail = (message, offset = pos) => {
		throw metaError(message, offset);
	};
	const skipSpace = () => {
		while (pos < text.length && /\s/.test(text[pos])) pos++;
	};
	const parseString = () => {
		const start = pos;
		const quote = text[pos++];
		let out = "";
		while (pos < text.length) {
			const ch = text[pos++];
			if (ch === quote) return out;
			if (ch === "\n") break;
			if (ch === "\\" && pos < text.length) {
				const next = text[pos++];
				out += ESCAPES[next] ?? next;
			} else out += ch;
		}
		return fail("unterminated string", start);
	};
	const parseKey = () => {
		const ch = text[pos];
		if (ch === "\"" || ch === "'") return parseString();
		if (ch === void 0 || !IDENT_START.test(ch)) return fail("expected a key");
		const start = pos;
		while (pos < text.length && IDENT_PART.test(text[pos])) pos++;
		return text.slice(start, pos);
	};
	const parseValue = (depth) => {
		if (depth > MAX_DEPTH) fail("metadata is nested too deeply");
		const ch = text[pos];
		if (ch === "{") return parseObject(depth);
		if (ch === "[") return parseArray(depth);
		if (ch === "\"" || ch === "'") return parseString();
		NUMBER.lastIndex = pos;
		const num = NUMBER.exec(text);
		if (num) {
			pos += num[0].length;
			return Number(num[0]);
		}
		WORD.lastIndex = pos;
		const word = WORD.exec(text)?.[0];
		if (word === void 0) return fail("expected a value");
		pos += word.length;
		return LITERALS.has(word) ? LITERALS.get(word) : word;
	};
	const parseObject = (depth) => {
		pos++;
		const out = {};
		for (;;) {
			skipSpace();
			if (text[pos] === "}") {
				pos++;
				return out;
			}
			const key = parseKey();
			skipSpace();
			if (text[pos] !== ":") fail("expected ':'");
			pos++;
			skipSpace();
			Object.defineProperty(out, key, {
				value: parseValue(depth + 1),
				enumerable: true,
				writable: true,
				configurable: true
			});
			skipSpace();
			if (text[pos] === ",") pos++;
			else if (text[pos] !== "}") fail("expected ',' or '}'");
		}
	};
	const parseArray = (depth) => {
		pos++;
		const out = [];
		for (;;) {
			skipSpace();
			if (text[pos] === "]") {
				pos++;
				return out;
			}
			out.push(parseValue(depth + 1));
			skipSpace();
			if (text[pos] === ",") pos++;
			else if (text[pos] !== "]") fail("expected ',' or ']'");
		}
	};
	try {
		skipSpace();
		if (text[pos] !== "{") fail("expected '{'");
		const value = parseObject(0);
		skipSpace();
		if (pos < text.length) fail("unexpected text after '}'");
		return value;
	} catch (e) {
		if (!(e instanceof Error) || !("offset" in e)) throw e;
		const offset = e.offset;
		const before = text.slice(0, offset).split("\n");
		const lastLine = before[before.length - 1];
		diags.add({
			level: "error",
			block: at.block,
			line: at.line + before.length - 1,
			column: before.length === 1 ? at.column + lastLine.length : lastLine.length + 1,
			message: e.message
		});
		return;
	}
};
//#endregion
export { parseMeta };
