//#region ../core/dist/authoring/source.js
var MAX_SOURCE_CHARS = 2e5;
var FENCE_OPEN = /^\s*```+\s*([A-Za-z0-9_-]*)/;
var FENCE_CLOSE = /^\s*```+\s*$/;
var FLOW_START = /^(?:flowchart|graph)\b/;
var STATE_START = /^stateDiagram(?:-v2)?\b/;
var ER_START = /^erDiagram\b/;
var ID_COMMENT = /^\s*%%\s*diagram:\s*(\S.*)$/;
var TITLE_COMMENT = /^\s*%%\s*title:\s*(\S.*)$/;
var FRONT_MATTER_TITLE = /^title:\s*(\S.*)$/;
var normaliseSource = (source) => source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").replace(/\t/g, "  ");
var normalise = (source) => normaliseSource(source).split("\n");
var frontMatterEnd = (lines) => {
	const first = lines.findIndex((l) => l.text.trim() !== "");
	if (first < 0 || lines[first]?.text.trim() !== "---") return -1;
	return lines.findIndex((l, i) => i > first && l.text.trim() === "---");
};
var describeBlock = (index, lines, openLine, diags) => {
	let id;
	let title;
	for (const { text } of lines) {
		id ??= ID_COMMENT.exec(text)?.[1]?.trimEnd();
		title ??= TITLE_COMMENT.exec(text)?.[1]?.trimEnd();
	}
	const fmEnd = frontMatterEnd(lines);
	let bodyStart = 0;
	if (fmEnd >= 0) {
		const fmStart = lines.findIndex((l) => l.text.trim() !== "");
		title ??= lines.slice(fmStart + 1, fmEnd).map((l) => FRONT_MATTER_TITLE.exec(l.text.trim())?.[1]?.trimEnd()).find((t) => t !== void 0);
		bodyStart = fmEnd + 1;
	}
	const head = lines.slice(bodyStart).find((l) => l.text.trim() !== "" && !l.text.trim().startsWith("%%"));
	const text = head?.text.trim() ?? "";
	const kind = FLOW_START.test(text) ? "flow" : STATE_START.test(text) ? "state" : ER_START.test(text) ? "er" : "unknown";
	if (kind === "unknown") diags.add({
		level: "error",
		block: id ?? `block-${index + 1}`,
		line: head?.line ?? openLine,
		column: head ? head.text.length - head.text.trimStart().length + 1 : 1,
		message: "a block must start with flowchart, graph, stateDiagram-v2 or erDiagram"
	});
	return {
		index,
		kind,
		id,
		title,
		lines
	};
};
var collectFences = (all, accept) => {
	const blocks = [];
	let current;
	let inOther = false;
	let sawOtherFence = false;
	for (const entry of all) if (current) {
		if (FENCE_CLOSE.test(entry.text)) {
			blocks.push(current);
			current = void 0;
		} else current.lines.push(entry);
	} else if (inOther) {
		if (FENCE_CLOSE.test(entry.text)) inOther = false;
	} else {
		const lang = FENCE_OPEN.exec(entry.text)?.[1];
		if (lang === accept) current = {
			lines: [],
			openLine: entry.line
		};
		else if (lang !== void 0) {
			inOther = true;
			sawOtherFence = true;
		}
	}
	if (current) blocks.push(current);
	return {
		blocks,
		unclosed: current && {
			lang: accept,
			openLine: current.openLine
		},
		sawOtherFence
	};
};
var splitSource = (source, diags) => {
	if (source.length > 2e5) {
		diags.add({
			level: "error",
			block: "source",
			line: 1,
			column: 1,
			message: "source is larger than 200,000 characters"
		});
		return [];
	}
	const all = normalise(source).map((text, i) => ({
		text,
		line: i + 1
	}));
	let found = collectFences(all, "arcsync");
	if (found.blocks.length === 0 && found.sawOtherFence) {
		const mermaid = collectFences(all, "mermaid");
		if (mermaid.blocks.length > 0) found = mermaid;
	}
	const raw = found.blocks;
	if (found.unclosed) diags.add({
		level: "warning",
		block: `block-${raw.length}`,
		line: found.unclosed.openLine,
		column: 1,
		message: `${found.unclosed.lang} fence is never closed`
	});
	if (raw.length === 0) {
		if (found.sawOtherFence || all.every((l) => l.text.trim() === "")) {
			diags.add({
				level: "error",
				block: "source",
				line: 1,
				column: 1,
				message: "no arcsync or mermaid diagram found"
			});
			return [];
		}
		raw.push({
			lines: all,
			openLine: 1
		});
	}
	return raw.map((b, i) => describeBlock(i, b.lines, b.openLine, diags));
};
//#endregion
export { MAX_SOURCE_CHARS, normaliseSource, splitSource };
