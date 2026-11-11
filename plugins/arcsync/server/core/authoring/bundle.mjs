import { DATA_MODEL_ATTRIBUTE } from "../graph/dataModel.mjs";
import { EdgeType, ResourceType } from "../graph/types.mjs";
import { createDiagnostics } from "./diagnostics.mjs";
import { parseErDiagram } from "./erDiagram.mjs";
import { edgeBudget, parseFlowchart } from "./flowchart.mjs";
import { resolveIcon, suggestIcon } from "./icons.mjs";
import { splitSource } from "./source.mjs";
import { parseStateDiagram, stateBudget } from "./stateDiagram.mjs";
import { stateAstToAsl } from "./stateToAsl.mjs";
//#region ../core/dist/authoring/bundle.js
var MAX_AUTHORED_NODES = 2e3;
var DIAGRAM_ID_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
var NO_DIAGRAM_ID = "add %% diagram: <id> to the first block, or pass diagramId";
var DIAGRAM_ID_FROM_TITLE = "diagram id comes from the title; add %% diagram: <id> to keep it stable when the title changes";
var EDGE_TYPES = {
	sync: EdgeType.REFERENCE,
	async: EdgeType.EVENT_FLOW,
	data: EdgeType.DEPENDENCY,
	network: EdgeType.NETWORK,
	iam: EdgeType.IAM
};
var DEFINITION_KEYS = [
	"Definition",
	"DefinitionString",
	"definition"
];
var CONTRACT_KEYS = /* @__PURE__ */ new Set([
	"icon",
	"kind",
	"link",
	"fill",
	"stroke",
	"authored",
	"description",
	"details",
	...DEFINITION_KEYS
]);
var HTTP_URL = /^https?:\/\//i;
var ID_COMMENT = /^\s*%%\s*diagram:/;
var TITLE_LINE = /^\s*(?:%%\s*)?title:/;
var slug = (title) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+/, "").slice(0, 64).replace(/-+$/, "") || void 0;
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var providerOf = (icon) => {
	const colon = icon.indexOf(":");
	return colon > 0 ? icon.slice(0, colon) : "custom";
};
var blockName = (block) => block.id ?? `block-${block.index + 1}`;
var parseArcsync = (source) => {
	const diags = createDiagnostics();
	const report = (level, block, line, message, suggestion) => diags.add({
		level,
		block,
		line,
		column: 1,
		message,
		...suggestion && { suggestion }
	});
	const clamp = (text, what, block, line) => {
		if (text.length <= 200) return text;
		report("warning", block, line, `${what} longer than 200 characters was shortened`);
		return text.slice(0, 200);
	};
	const split = splitSource(source, diags).map((block) => block.title === void 0 || block.title.length <= 200 ? block : {
		...block,
		title: clamp(block.title, "title", blockName(block), block.lines.find((l) => TITLE_LINE.test(l.text))?.line ?? 1)
	});
	const flowBudget = edgeBudget();
	const stateLimits = stateBudget();
	const seen = /* @__PURE__ */ new Set();
	const flows = [];
	const states = /* @__PURE__ */ new Map();
	const stateTitles = /* @__PURE__ */ new Map();
	const models = /* @__PURE__ */ new Map();
	const modelTitles = /* @__PURE__ */ new Map();
	const kept = [];
	for (const block of split) {
		if (block.kind === "unknown") continue;
		const id = blockName(block);
		if (seen.has(id)) {
			report("error", id, block.lines.find((l) => ID_COMMENT.test(l.text))?.line ?? 1, `duplicate block id '${id}'`);
			continue;
		}
		seen.add(id);
		kept.push({
			id,
			kind: block.kind,
			...block.title !== void 0 && { title: block.title }
		});
		if (block.kind === "flow") flows.push({
			id,
			title: block.title,
			ast: parseFlowchart(block, diags, flowBudget)
		});
		else if (block.kind === "er") {
			models.set(id, parseErDiagram(block, diags));
			modelTitles.set(id, block.title);
		} else {
			states.set(id, parseStateDiagram(block, diags, stateLimits));
			stateTitles.set(id, block.title);
		}
	}
	const definitions = /* @__PURE__ */ new Map();
	const definitionOf = (id, ast) => {
		let definition = definitions.get(id);
		if (!definition) {
			definition = stateAstToAsl(ast, id, diags);
			definitions.set(id, definition);
		}
		return definition;
	};
	const nodes = /* @__PURE__ */ new Map();
	const edges = [];
	const groups = /* @__PURE__ */ new Set();
	const expanded = /* @__PURE__ */ new Set();
	const multi = flows.length > 1;
	const contain = (parent, child) => edges.push({
		id: `${parent}->contains->${child}`,
		source: parent,
		target: child,
		type: EdgeType.CONTAINS
	});
	const buildNode = (fn, flow) => {
		const { label: _label, props, expands, icon, link, ...rest } = fn.meta;
		const warn = (message) => report("warning", flow.id, fn.line, message);
		if (DEFINITION_KEYS.some((key) => Object.hasOwn(rest, key))) {
			warn("Definition is set only by expands");
			for (const key of DEFINITION_KEYS) delete rest[key];
		}
		const extra = isRecord(props) ? { ...props } : props !== void 0 ? { props } : {};
		for (const key of Object.keys(extra)) {
			if (!CONTRACT_KEYS.has(key)) continue;
			warn(`props.${key} is ignored; set ${key} directly`);
			delete extra[key];
		}
		const attributes = {
			...rest,
			...extra,
			authored: true
		};
		let type = ResourceType.AUTHORED;
		let provider = "custom";
		if (icon !== void 0) {
			const resolved = typeof icon === "string" ? resolveIcon(icon) : void 0;
			if (resolved) {
				attributes.icon = resolved.icon;
				provider = providerOf(resolved.icon);
				if (!fn.isGroup) type = resolved.type;
			} else {
				attributes.icon = icon;
				const suggestion = typeof icon === "string" ? suggestIcon(icon) : void 0;
				report("warning", flow.id, fn.line, `unknown icon '${String(icon)}'`, suggestion);
			}
		}
		const url = fn.link ?? (typeof link === "string" ? link : void 0);
		if (url !== void 0) {
			if (HTTP_URL.test(url)) attributes.link = url;
			else report("warning", flow.id, fn.line, "only http and https links are kept");
		}
		const style = {};
		for (const cls of fn.classes) Object.assign(style, flow.ast.classDefs.get(cls));
		Object.assign(style, fn.style);
		if (style.fill !== void 0) attributes.fill = style.fill;
		if (style.stroke !== void 0) attributes.stroke = style.stroke;
		if (expands !== void 0) {
			const ast = typeof expands === "string" ? states.get(expands) : void 0;
			const model = typeof expands === "string" ? models.get(expands) : void 0;
			if (typeof expands !== "string") report("error", flow.id, fn.line, "expands must name a state or ER diagram block");
			else if (model) {
				attributes[DATA_MODEL_ATTRIBUTE] = model;
				expanded.add(expands);
			} else if (ast) {
				attributes.Definition = definitionOf(expands, ast);
				expanded.add(expands);
			} else if (seen.has(expands)) report("error", flow.id, fn.line, `'${expands}' is not a state or ER diagram block`);
			else report("error", flow.id, fn.line, `no block named '${expands}'`);
		}
		return {
			id: fn.id,
			type,
			provider,
			name: clamp(fn.label ?? fn.id, fn.isGroup ? "container name" : "node name", flow.id, fn.line),
			resourceType: type,
			attributes
		};
	};
	const authoredNode = (id, name, attributes) => ({
		id,
		type: ResourceType.AUTHORED,
		provider: "custom",
		name,
		resourceType: ResourceType.AUTHORED,
		attributes: {
			...attributes,
			authored: true
		}
	});
	for (const flow of flows) {
		if (multi && !nodes.has(flow.id)) nodes.set(flow.id, authoredNode(flow.id, clamp(flow.title ?? flow.id, "container name", flow.id, 1), { kind: "diagram" }));
		const endpoints = new Set(flow.ast.edges.flatMap((e) => [e.source, e.target]));
		for (const fn of flow.ast.nodes.values()) {
			if (fn.isGroup) groups.add(fn.id);
			const existing = nodes.get(fn.id);
			if (existing) {
				if (fn.label !== void 0 && fn.label.slice(0, 200) !== existing.name) report("warning", flow.id, fn.line, `node '${fn.id}' is already defined as '${existing.name}'`);
				continue;
			}
			if (!fn.isGroup && fn.label === void 0 && fn.shape === void 0 && Object.keys(fn.meta).length === 0 && endpoints.has(fn.id)) report("info", flow.id, fn.line, `node '${fn.id}' is created by an edge`);
			nodes.set(fn.id, buildNode(fn, flow));
			const parent = fn.parent ?? (multi ? flow.id : void 0);
			if (parent !== void 0) contain(parent, fn.id);
		}
	}
	for (const [id, ast] of states) {
		if (expanded.has(id)) continue;
		if (nodes.has(id)) {
			report("error", id, 1, `'${id}' is both a node and a state diagram block`);
			continue;
		}
		nodes.set(id, authoredNode(id, clamp(stateTitles.get(id) ?? id, "container name", id, 1), {
			icon: "service",
			kind: "state machine",
			Definition: definitionOf(id, ast)
		}));
	}
	for (const [id, model] of models) {
		if (expanded.has(id)) continue;
		if (nodes.has(id)) {
			report("error", id, 1, `'${id}' is both a node and an ER diagram block`);
			continue;
		}
		nodes.set(id, authoredNode(id, clamp(modelTitles.get(id) ?? id, "container name", id, 1), {
			icon: "database",
			kind: "data model",
			[DATA_MODEL_ATTRIBUTE]: model
		}));
	}
	const named = split.find((b) => b.title !== void 0)?.title ?? split.find((b) => b.id !== void 0)?.id;
	const title = named === void 0 ? "Untitled diagram" : clamp(named, "title", "source", 1);
	const head = split[0];
	const headName = head ? blockName(head) : "source";
	const fallbackId = named === void 0 ? void 0 : slug(title);
	let diagramId;
	let diagramIdSource;
	if (head?.id !== void 0 && DIAGRAM_ID_RE.test(head.id)) {
		diagramId = head.id;
		diagramIdSource = "pinned";
	} else {
		if (head?.id !== void 0) {
			const line = head.lines.find((l) => ID_COMMENT.test(l.text))?.line ?? 1;
			const using = fallbackId === void 0 ? "" : `; using '${fallbackId}'`;
			report("warning", headName, line, `diagram id '${head.id}' must be lowercase letters, digits and hyphens${using}`);
		}
		diagramId = fallbackId;
		diagramIdSource = fallbackId === void 0 ? "none" : "title";
		report("warning", headName, 1, fallbackId === void 0 ? NO_DIAGRAM_ID : DIAGRAM_ID_FROM_TITLE);
	}
	const first = flows[0];
	const metadata = {
		source: "cloudformation",
		generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
		authored: true,
		...first && { rankdir: first.ast.direction }
	};
	const result = (graph) => ({
		graph,
		diagnostics: diags.list(),
		blocks: kept,
		title,
		diagramId,
		diagramIdSource,
		ok: !diags.hasErrors()
	});
	if (nodes.size > 2e3) {
		report("error", "source", 1, `more than ${MAX_AUTHORED_NODES} nodes`);
		return result({
			nodes: [],
			edges: [],
			metadata
		});
	}
	const idCounts = /* @__PURE__ */ new Map();
	for (const flow of flows) for (const e of flow.ast.edges) {
		const clash = [e.source, e.target].find((id) => groups.has(id) && states.has(id));
		if (clash !== void 0) {
			report("error", flow.id, e.line, `'${clash}' is both a group and a state diagram block`);
			continue;
		}
		const { kind: _kind, ...rest } = e.meta;
		const type = e.kind ? EDGE_TYPES[e.kind] : EdgeType.REFERENCE;
		const base = `${e.source}->${type}->${e.target}`;
		const count = (idCounts.get(base) ?? 0) + 1;
		idCounts.set(base, count);
		const edge = {
			id: count === 1 ? base : `${base}#${count}`,
			source: e.source,
			target: e.target,
			type
		};
		if (e.label !== void 0) edge.label = clamp(e.label, "edge label", flow.id, e.line);
		if (e.bidirectional) edge.direction = "bidirectional";
		if (Object.keys(rest).length > 0) edge.attributes = rest;
		edges.push(edge);
	}
	return result({
		nodes: [...nodes.values()],
		edges,
		metadata
	});
};
//#endregion
export { DIAGRAM_ID_FROM_TITLE, DIAGRAM_ID_RE, MAX_AUTHORED_NODES, NO_DIAGRAM_ID, parseArcsync };
