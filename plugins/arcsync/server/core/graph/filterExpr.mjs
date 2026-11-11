//#region ../core/dist/graph/filterExpr.js
var ParseFail = class extends Error {};
function tokenizeCel(src) {
	const tokens = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if (c === "(") {
			tokens.push({ t: "lparen" });
			i++;
		} else if (c === ")") {
			tokens.push({ t: "rparen" });
			i++;
		} else if (c === ",") {
			tokens.push({ t: "comma" });
			i++;
		} else if (c === "=") {
			if (src[i + 1] === "=") throw new ParseFail();
			tokens.push({ t: "eq" });
			i++;
		} else if (c === "!" && src[i + 1] === "=") {
			tokens.push({ t: "neq" });
			i += 2;
		} else if (c === "!") {
			tokens.push({ t: "not" });
			i++;
		} else if (c === "&" && src[i + 1] === "&") {
			tokens.push({ t: "and" });
			i += 2;
		} else if (c === "|" && src[i + 1] === "|") {
			tokens.push({ t: "or" });
			i += 2;
		} else if (c === "\"") {
			const end = src.indexOf("\"", i + 1);
			if (end === -1) throw new ParseFail();
			tokens.push({
				t: "str",
				v: src.slice(i + 1, end)
			});
			i = end + 1;
		} else if (/[A-Za-z_]/.test(c)) {
			let j = i;
			while (j < src.length && /[A-Za-z0-9_.:-]/.test(src[j])) j++;
			const word = src.slice(i, j);
			const lower = word.toLowerCase();
			if (lower === "and") tokens.push({ t: "and" });
			else if (lower === "or") tokens.push({ t: "or" });
			else if (lower === "not") tokens.push({ t: "not" });
			else tokens.push({
				t: "ident",
				v: word
			});
			i = j;
		} else throw new ParseFail();
	}
	return tokens;
}
/** attributes.key -> key; attributes:key handled at parse level. */
function celKey(ident) {
	if (!ident.startsWith("attributes.")) throw new ParseFail();
	const key = ident.slice(11);
	if (!key) throw new ParseFail();
	return key;
}
/** Shared precedence climb (or > and > unary-not) for both CEL and SQL grammars. */
function parseBool(tokens, parsePrimary) {
	let pos = 0;
	const peek = () => tokens[pos];
	const next = () => {
		const tok = tokens[pos++];
		if (!tok) throw new ParseFail();
		return tok;
	};
	function parseOr() {
		const children = [parseAnd()];
		while (peek()?.t === "or") {
			pos++;
			children.push(parseAnd());
		}
		return children.length === 1 ? children[0] : {
			kind: "or",
			children
		};
	}
	function parseAnd() {
		const children = [parseUnary()];
		while (peek()?.t === "and") {
			pos++;
			children.push(parseUnary());
		}
		return children.length === 1 ? children[0] : {
			kind: "and",
			children
		};
	}
	function parseUnary() {
		if (peek()?.t === "not") {
			pos++;
			return {
				kind: "not",
				child: parseUnary()
			};
		}
		return parsePrimary(ctx);
	}
	const ctx = {
		next,
		parseOr
	};
	const expr = parseOr();
	if (pos !== tokens.length) throw new ParseFail();
	return expr;
}
function parseCelPrimary(ctx) {
	const tok = ctx.next();
	if (tok.t === "lparen") {
		const inner = ctx.parseOr();
		if (ctx.next().t !== "rparen") throw new ParseFail();
		return inner;
	}
	if (tok.t !== "ident") throw new ParseFail();
	const word = tok.v;
	const lower = word.toLowerCase();
	if (lower === "hasprefix" || lower === "has") {
		if (ctx.next().t !== "lparen") throw new ParseFail();
		const arg = ctx.next();
		if (arg.t !== "ident") throw new ParseFail();
		const key = celKey(arg.v);
		if (lower === "has") {
			if (ctx.next().t !== "rparen") throw new ParseFail();
			return {
				kind: "has",
				key
			};
		}
		if (ctx.next().t !== "comma") throw new ParseFail();
		const val = ctx.next();
		if (val.t !== "str") throw new ParseFail();
		if (ctx.next().t !== "rparen") throw new ParseFail();
		return {
			kind: "prefix",
			key,
			value: val.v
		};
	}
	if (word.includes(":")) {
		const [ns, key] = word.split(":");
		if (ns !== "attributes" || !key) throw new ParseFail();
		return {
			kind: "has",
			key
		};
	}
	const key = celKey(word);
	const op = ctx.next();
	if (op.t !== "eq" && op.t !== "neq") throw new ParseFail();
	const val = ctx.next();
	if (val.t !== "str") throw new ParseFail();
	return {
		kind: op.t === "eq" ? "eq" : "neq",
		key,
		value: val.v
	};
}
function parseCelFilter(src) {
	if (typeof src !== "string" || !src.trim()) return null;
	try {
		return parseBool(tokenizeCel(src), parseCelPrimary);
	} catch {
		return null;
	}
}
function tokenizeSql(src) {
	const tokens = [];
	let i = 0;
	while (i < src.length) {
		const c = src[i];
		if (/\s/.test(c)) {
			i++;
			continue;
		}
		if (c === "(") {
			tokens.push({ t: "lparen" });
			i++;
		} else if (c === ")") {
			tokens.push({ t: "rparen" });
			i++;
		} else if (c === "<" && src[i + 1] === ">") {
			tokens.push({ t: "neq" });
			i += 2;
		} else if (c === "!" && src[i + 1] === "=") {
			tokens.push({ t: "neq" });
			i += 2;
		} else if (c === "=") {
			tokens.push({ t: "eq" });
			i++;
		} else if (c === "'") {
			const end = src.indexOf("'", i + 1);
			if (end === -1) throw new ParseFail();
			tokens.push({
				t: "str",
				v: src.slice(i + 1, end)
			});
			i = end + 1;
		} else if (/[A-Za-z_]/.test(c)) {
			let j = i;
			while (j < src.length && /[A-Za-z0-9_.]/.test(src[j])) j++;
			const word = src.slice(i, j);
			const lower = word.toLowerCase();
			if (lower === "and") tokens.push({ t: "and" });
			else if (lower === "or") tokens.push({ t: "or" });
			else if (lower === "not") tokens.push({ t: "not" });
			else if (lower === "like") tokens.push({ t: "like" });
			else tokens.push({
				t: "ident",
				v: word
			});
			i = j;
		} else throw new ParseFail();
	}
	return tokens;
}
/** sys./user. namespace prefixes strip to the bare key; any other dotted ident is invalid. */
function sqlKey(ident) {
	const lower = ident.toLowerCase();
	let key;
	if (lower.startsWith("sys.")) key = ident.slice(4);
	else if (lower.startsWith("user.")) key = ident.slice(5);
	else if (ident.includes(".")) throw new ParseFail();
	else key = ident;
	if (!key) throw new ParseFail();
	return key;
}
function parseSqlPrimary(ctx) {
	const tok = ctx.next();
	if (tok.t === "lparen") {
		const inner = ctx.parseOr();
		if (ctx.next().t !== "rparen") throw new ParseFail();
		return inner;
	}
	if (tok.t !== "ident") throw new ParseFail();
	const key = sqlKey(tok.v);
	const op = ctx.next();
	if (op.t === "eq" || op.t === "neq") {
		const val = ctx.next();
		if (val.t !== "str") throw new ParseFail();
		return {
			kind: op.t === "eq" ? "eq" : "neq",
			key,
			value: val.v
		};
	}
	if (op.t === "like") {
		const val = ctx.next();
		if (val.t !== "str") throw new ParseFail();
		if (!/^[^%_]+%$/.test(val.v)) throw new ParseFail();
		return {
			kind: "prefix",
			key,
			value: val.v.slice(0, -1)
		};
	}
	throw new ParseFail();
}
function parseSqlFilter(src) {
	if (typeof src !== "string" || !src.trim()) return null;
	try {
		return parseBool(tokenizeSql(src), parseSqlPrimary);
	} catch {
		return null;
	}
}
var DNF_CAP = 32;
var NAME_CAP = 10;
function toNnf(ast, negate = false) {
	switch (ast.kind) {
		case "not": return toNnf(ast.child, !negate);
		case "and":
		case "or": return {
			kind: negate ? ast.kind === "and" ? "or" : "and" : ast.kind,
			children: ast.children.map((c) => toNnf(c, negate))
		};
		case "eq": return negate ? {
			kind: "neq",
			key: ast.key,
			value: ast.value
		} : ast;
		case "neq": return negate ? {
			kind: "eq",
			key: ast.key,
			value: ast.value
		} : ast;
		default: return negate ? {
			kind: "not",
			child: ast
		} : ast;
	}
}
function toDnf(ast) {
	switch (ast.kind) {
		case "or": {
			const out = [];
			for (const child of ast.children) {
				const sub = toDnf(child);
				if (!sub) return null;
				out.push(...sub);
				if (out.length > DNF_CAP) return null;
			}
			return out;
		}
		case "and": {
			let acc = [[]];
			for (const child of ast.children) {
				const sub = toDnf(child);
				if (!sub) return null;
				const next = [];
				for (const a of acc) for (const s of sub) {
					next.push([...a, ...s]);
					if (next.length > DNF_CAP) return null;
				}
				acc = next;
			}
			return acc;
		}
		default: return [[ast]];
	}
}
function deriveEventNames(ast) {
	const SUMMARIZED = {
		names: [],
		summarized: true
	};
	const dnf = toDnf(toNnf(ast));
	if (!dnf) return SUMMARIZED;
	const names = /* @__PURE__ */ new Set();
	const keys = /* @__PURE__ */ new Set();
	for (const disjunct of dnf) {
		const eqs = disjunct.filter((l) => l.kind === "eq");
		const prefixes = disjunct.filter((l) => l.kind === "prefix");
		const named = eqs.length > 0 ? eqs : prefixes;
		if (named.length === 0) return SUMMARIZED;
		for (const l of named) keys.add(l.key);
		if (keys.size !== 1 || new Set(named.map((l) => l.value)).size !== 1) return SUMMARIZED;
		names.add(eqs.length > 0 ? named[0].value : `${named[0].value}*`);
	}
	if (names.size === 0 || names.size > NAME_CAP) return SUMMARIZED;
	return {
		names: [...names],
		summarized: false
	};
}
//#endregion
export { deriveEventNames, parseCelFilter, parseSqlFilter };
