import "../graph/stateMachine.mjs";
//#region ../core/dist/authoring/stateToAsl.js
/** `[*]` can never be a state id, so it doubles as the "end of this region" target. */
var END = "[*]";
var START = "[*]";
/**
* Compiles a parsed `stateDiagram-v2` into ASL that `decodeStateMachine` reads
* and `expandStateMachines` draws. The result is drawing-only ASL: a Parallel
* may carry `Choices`, a fork that does not resolve may emit a rule with no
* `Condition`, and the ArcSync-only fields (`ArcSyncLabel`, `ArcSyncNextLabel`,
* `ArcSyncEnd` rules, `ArcSyncDefaultEnd`) carry labels and ends to the
* expander. Step Functions would accept none of these.
*/
var stateAstToAsl = (ast, blockId, diags) => {
	const warn = (message, line) => diags.add({
		level: "warning",
		block: blockId,
		line,
		column: 1,
		message
	});
	const defs = /* @__PURE__ */ new Map();
	const home = /* @__PURE__ */ new Map();
	const infoOf = /* @__PURE__ */ new Map();
	const transitions = [];
	const walk = (info) => {
		infoOf.set(info.region, info);
		for (const t of info.region.transitions) transitions.push({
			...t,
			in: info
		});
		for (const def of info.region.states.values()) {
			defs.set(def.id, def);
			home.set(def.id, info);
			const regions = def.children ?? [];
			regions.forEach((region, i) => {
				const name = regions.length > 1 ? `'${def.id}' region ${i + 1}` : `'${def.id}'`;
				walk({
					region,
					parent: info,
					owner: def,
					name
				});
			});
		}
	};
	walk({
		region: ast.root,
		name: "the diagram"
	});
	const exits = /* @__PURE__ */ new Map();
	const starts = /* @__PURE__ */ new Map();
	/** The one End exit ruling (a) gives a source leaving its composite; an explicit `[*]` exit replaces it. */
	const liftedEnds = /* @__PURE__ */ new Map();
	const addExit = (from, exit) => {
		const list = exits.get(from);
		if (list) list.push(exit);
		else exits.set(from, [exit]);
	};
	const homeOf = (id) => home.get(id);
	const ancestors = (info) => {
		const chain = [];
		for (let r = info; r; r = r.parent) chain.push(r);
		return chain;
	};
	const lift = (id, target) => {
		let current = id;
		for (let r = homeOf(current); r !== target; r = homeOf(current)) current = r.owner.id;
		return current;
	};
	for (const t of transitions.sort((a, b) => a.line - b.line)) {
		if (t.from === START && t.to === END) continue;
		if (t.from === START) {
			if (!ancestors(homeOf(t.to)).includes(t.in)) {
				warn(`[*] in ${t.in.name} cannot start at '${t.to}', which is outside it`, t.line);
				continue;
			}
			const to = lift(t.to, t.in);
			if (to !== t.to) warn(`transition into '${t.to}' inside composite '${to}' is drawn to '${to}'`, t.line);
			const list = starts.get(t.in) ?? [];
			list.push({
				id: to,
				line: t.line
			});
			starts.set(t.in, list);
			continue;
		}
		const label = t.label === void 0 ? {} : { label: t.label };
		if (t.to === END) {
			const exit = {
				to: END,
				...label
			};
			const lifted = liftedEnds.get(t.from);
			const list = exits.get(t.from);
			if (lifted && list) {
				list[list.indexOf(lifted)] = exit;
				liftedEnds.delete(t.from);
			} else addExit(t.from, exit);
			continue;
		}
		const fromChain = ancestors(homeOf(t.from));
		const common = ancestors(homeOf(t.to)).find((r) => fromChain.includes(r));
		const from = lift(t.from, common);
		const to = lift(t.to, common);
		const liftedFrom = from !== t.from;
		const liftedTo = to !== t.to;
		if (from === to && (liftedFrom || liftedTo)) {
			warn(liftedFrom && liftedTo ? `transition from '${t.from}' to '${t.to}' crosses concurrent regions of '${from}'; not drawn` : `transition from '${t.from}' to '${t.to}' stays inside composite '${from}'; not drawn`, t.line);
			continue;
		}
		if (liftedFrom) {
			warn(`transition from '${t.from}' to '${t.to}' leaves composite '${from}'; drawn as an exit of '${from}'`, t.line);
			if (!exits.get(t.from)?.some((e) => e.to === END)) {
				const exit = { to: END };
				liftedEnds.set(t.from, exit);
				addExit(t.from, exit);
			}
		}
		if (liftedTo) warn(`transition into '${t.to}' inside composite '${to}' is drawn to '${to}'`, t.line);
		addExit(from, {
			to,
			...label
		});
	}
	const emitScope = (ids, startAt, depth, exitsOf) => {
		const inScope = new Set(ids);
		const kindOf = (id) => defs.get(id).kind;
		const preds = new Map(ids.map((id) => [id, []]));
		preds.get(startAt).push(START);
		for (const id of ids) for (const e of exitsOf(id)) preds.get(e.to)?.push(id);
		const memo = /* @__PURE__ */ new Map();
		const visiting = /* @__PURE__ */ new Set();
		const branchFrom = (fork, target, joins) => {
			const seen = /* @__PURE__ */ new Set();
			let reachesJoin = false;
			const stack = [target];
			while (stack.length > 0) {
				const s = stack.pop();
				if (s === END || s === fork || !inScope.has(s)) return void 0;
				if (kindOf(s) === "join") {
					joins.add(s);
					reachesJoin = true;
					continue;
				}
				if (seen.has(s)) continue;
				seen.add(s);
				const inner = kindOf(s) === "fork" ? match(s) : void 0;
				if (inner) {
					for (const b of inner.branches) for (const id of b.ids) seen.add(id);
					seen.add(inner.join);
				}
				for (const e of exitsOf(inner ? inner.join : s)) stack.push(e.to);
			}
			return reachesJoin ? seen : void 0;
		};
		const computeMatch = (fork) => {
			const targets = exitsOf(fork).map((e) => e.to);
			if (targets.length === 0) return void 0;
			const joins = /* @__PURE__ */ new Set();
			const claimed = /* @__PURE__ */ new Set();
			const branches = [];
			for (const target of targets) {
				const set = branchFrom(fork, target, joins);
				if (!set || joins.has(target)) return void 0;
				for (const id of set) {
					if (claimed.has(id)) return void 0;
					claimed.add(id);
				}
				branches.push({
					start: target,
					ids: ids.filter((id) => set.has(id)),
					set
				});
			}
			if (joins.size !== 1) return void 0;
			const join = [...joins][0];
			const entered = (b) => b.ids.every((id) => preds.get(id).every((p) => b.set.has(p) || p === fork && id === b.start));
			if (!branches.every(entered)) return void 0;
			if (!preds.get(join).every((p) => claimed.has(p))) return void 0;
			return {
				join,
				branches
			};
		};
		function match(fork) {
			if (memo.has(fork)) return memo.get(fork);
			if (visiting.has(fork)) return void 0;
			visiting.add(fork);
			const result = computeMatch(fork);
			visiting.delete(fork);
			memo.set(fork, result);
			return result;
		}
		const forks = ids.filter((id) => kindOf(id) === "fork");
		const fits = depth + 1 <= 3;
		const parallels = /* @__PURE__ */ new Map();
		const absorbed = /* @__PURE__ */ new Set();
		if (fits) for (const f of forks) {
			const m = match(f);
			if (!m) continue;
			parallels.set(f, m);
			for (const b of m.branches) for (const id of b.ids) absorbed.add(id);
			absorbed.add(m.join);
		}
		for (const f of forks) if (absorbed.has(f)) parallels.delete(f);
		else if (!parallels.has(f)) {
			const reason = !fits && match(f) ? "is nested too deeply" : "has no single join";
			warn(`fork '${f}' ${reason}; drawn as separate states`, defs.get(f).line);
		}
		const kept = ids.filter((id) => !absorbed.has(id));
		const single = (e) => ({
			...e.to === END ? { End: true } : { Next: e.to },
			...e.label === void 0 ? {} : { ArcSyncNextLabel: e.label }
		});
		const goTo = (e) => e.to === END ? { ArcSyncEnd: true } : { Next: e.to };
		const rules = (def, list) => {
			const unlabelled = list.filter((e) => e.label === void 0).length;
			const loose = def.kind === "fork";
			if (unlabelled > 1 && !loose) warn(`label every branch of '${def.id}'`, def.line);
			let option = 0;
			let fallback = {};
			const choices = [];
			for (const e of list) if (e.label !== void 0) choices.push({
				Condition: e.label,
				...goTo(e)
			});
			else if (loose) choices.push(goTo(e));
			else if (unlabelled === 1) fallback = e.to === END ? { ArcSyncDefaultEnd: true } : { Default: e.to };
			else choices.push({
				Condition: `option ${++option}`,
				...goTo(e)
			});
			return {
				Choices: choices,
				...fallback
			};
		};
		const States = {};
		for (const id of kept) {
			const def = defs.get(id);
			const fork = parallels.get(id);
			const regions = (def.children ?? []).filter((r) => r.states.size > 0);
			if (regions.length > 0 && !fits) warn(`composite '${id}' is nested too deeply; its states are not drawn`, def.line);
			let branches;
			let list = exitsOf(id);
			if (fork) {
				const join = fork.join;
				const inBranch = (s) => exitsOf(s).map((e) => e.to === join ? {
					...e,
					to: END
				} : e);
				branches = fork.branches.map((b) => emitScope(b.ids, b.start, depth + 1, inBranch));
				list = exitsOf(join);
			} else if (regions.length > 0 && fits) branches = regions.map((r) => emitRegion(infoOf.get(r), depth + 1));
			let shape;
			if (branches) shape = {
				Type: "Parallel",
				Branches: branches,
				...list.length === 0 ? { End: true } : list.length === 1 ? single(list[0]) : rules(def, list)
			};
			else if (list.length === 0) shape = { Type: "Succeed" };
			else if (list.length === 1 && def.kind !== "choice") shape = {
				Type: "Pass",
				...single(list[0])
			};
			else shape = {
				Type: "Choice",
				...rules(def, list)
			};
			States[id] = {
				...shape,
				...def.label === void 0 ? {} : { ArcSyncLabel: def.label },
				...def.description.length > 0 ? { Comment: def.description.join("\n") } : {}
			};
		}
		return {
			StartAt: startAt,
			States
		};
	};
	const emitRegion = (info, depth) => {
		const ids = [...info.region.states.keys()];
		const list = starts.get(info) ?? [];
		const first = list[0];
		let startAt;
		if (first) {
			startAt = first.id;
			const second = list[1];
			if (second) warn(`more than one start in ${info.name}; starting at '${startAt}'`, second.line);
		} else {
			startAt = ids[0];
			warn(`no start state in ${info.name}; starting at '${startAt}'`, defs.get(startAt).line);
		}
		return emitScope(ids, startAt, depth, (id) => exits.get(id) ?? []);
	};
	if (ast.root.states.size === 0) {
		warn("the diagram has no states", 1);
		return {
			StartAt: "End",
			States: { End: { Type: "Succeed" } }
		};
	}
	return emitRegion(infoOf.get(ast.root), 0);
};
//#endregion
export { stateAstToAsl };
