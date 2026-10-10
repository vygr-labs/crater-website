// Markdown extras for the docs.
//
// Callouts and tabs are written as directives so the files stay plain
// Markdown:
//
//   :::warning[Ctrl + C clears the screen]
//   Text of the callout.
//   :::
//
//   ::::tabs
//   :::tab[Windows]
//   ...
//   :::
//   ::::
//
// Without JavaScript every tab panel shows, each under its own label.
import { visit } from "unist-util-visit";

type Node = {
	type: string;
	name?: string;
	tagName?: string;
	value?: string;
	children?: Node[];
	properties?: Record<string, unknown>;
	data?: Record<string, unknown>;
	attributes?: Record<string, string>;
};

const CALLOUTS: Record<string, string> = {
	note: "Note",
	info: "Good to know",
	tip: "Tip",
	warning: "Careful",
	danger: "Careful",
};

const text = (n: Node): string => (n.value ?? "") + (n.children ?? []).map(text).join("");

// Pulls the [label] paragraph out of a directive and returns its children.
function takeLabel(node: Node): Node[] | null {
	const first = node.children?.[0];
	if (first?.type === "paragraph" && first.data?.directiveLabel) {
		node.children!.shift();
		return first.children ?? [];
	}
	return null;
}

export function remarkDocs() {
	let tabsSeen = 0;
	return (tree: Node) => {
		visit(tree as never, (node: Node) => {
			if (node.type !== "containerDirective" || !node.name) return;

			if (node.name in CALLOUTS) {
				const label = takeLabel(node);
				node.children!.unshift({
					type: "paragraph",
					data: { hProperties: { className: ["callout-title"] } },
					children: label ?? [{ type: "text", value: CALLOUTS[node.name] }],
				});
				node.data = { hName: "aside", hProperties: { className: ["callout"], dataKind: node.name === "danger" ? "warning" : node.name } };
				return;
			}

			if (node.name === "tabs") {
				const group = `tabs-${++tabsSeen}`;
				const tabs = (node.children ?? []).filter((c) => c.type === "containerDirective" && c.name === "tab");
				const buttons = tabs.map((tab, i) => {
					const label = takeLabel(tab);
					const name = label ? label.map(text).join("") : `Option ${i + 1}`;
					tab.children!.unshift({
						type: "paragraph",
						data: { hProperties: { className: ["tab-label"] } },
						children: [{ type: "text", value: name }],
					});
					tab.data = {
						hName: "div",
						hProperties: { className: ["tab-panel"], id: `${group}-${i}`, role: "tabpanel", dataOn: i === 0 ? "" : undefined },
					};
					return {
						type: "element",
						tagName: "button",
						properties: { type: "button", role: "tab", ariaControls: `${group}-${i}`, ariaSelected: i === 0 ? "true" : "false" },
						children: [{ type: "text", value: name }],
					};
				});
				node.children = [
					{ type: "tabList", data: { hName: "div", hProperties: { className: ["tab-list"], role: "tablist" }, hChildren: buttons } },
					...tabs,
				];
				node.data = { hName: "div", hProperties: { className: ["tabs"], dataTabs: "" } };
			}
		});
	};
}

// A small link after each section heading, so a section can be shared.
export function rehypeHeadingLinks() {
	return (tree: Node) => {
		visit(tree as never, "element", (node: Node) => {
			if ((node.tagName === "h2" || node.tagName === "h3") && node.properties?.id) {
				node.children!.push({
					type: "element",
					tagName: "a",
					properties: { className: ["h-anchor"], href: `#${node.properties.id}`, ariaLabel: "Link to this section" },
					children: [{ type: "text", value: "#" }],
				});
			}
		});
	};
}

// Links that leave the site open in a new tab, like the rest of the site's
// outside links, so the page someone was reading stays put.
export function rehypeExternalLinks() {
	return (tree: Node) => {
		visit(tree as never, "element", (node: Node) => {
			const href = node.tagName === "a" ? String(node.properties?.href ?? "") : "";
			if (/^https?:\/\//.test(href) && !/^https?:\/\/(www\.)?getcrater\.org/.test(href)) {
				node.properties!.target = "_blank";
				node.properties!.rel = ["noopener"];
			}
		});
	};
}
