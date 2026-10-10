// The docs pages: the sidebar drawer on small screens, tabs, the search
// dialog, the "on this page" highlight and copy buttons on code.
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

/* ── Sidebar drawer ─────────────────────────────────────────────────────── */
const side = $("[data-side]");
const scrim = $("[data-side-scrim]");
const opener = $<HTMLButtonElement>("[data-side-open]");
const setSide = (open: boolean) => {
	side?.classList.toggle("is-open", open);
	if (scrim) scrim.hidden = !open;
	opener?.setAttribute("aria-expanded", String(open));
	document.body.classList.toggle("side-open", open);
	if (open) side?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "center" });
};
// The sidebar scrolls on its own, so keep its place from page to page.
// Otherwise a link low in the list jumps back to the top after the click.
const sideScroll = $(".side-inner", side ?? document);
if (sideScroll) {
	try {
		sideScroll.scrollTop = +(sessionStorage.getItem("crater-docs-side") ?? 0);
	} catch {}
	addEventListener("pagehide", () => {
		try {
			sessionStorage.setItem("crater-docs-side", String(sideScroll.scrollTop));
		} catch {}
	});
}
opener?.addEventListener("click", () => setSide(true));
scrim?.addEventListener("click", () => setSide(false));
$("[data-side-close]")?.addEventListener("click", () => setSide(false));
addEventListener("keydown", (e) => e.key === "Escape" && side?.classList.contains("is-open") && setSide(false));
matchMedia("(min-width: 1001px)").addEventListener("change", (e) => e.matches && setSide(false));

/* ── Tabs ───────────────────────────────────────────────────────────────── */
for (const group of $$("[data-tabs]")) {
	const buttons = $$<HTMLButtonElement>('[role="tab"]', group);
	const pick = (i: number) =>
		buttons.forEach((b, j) => {
			b.setAttribute("aria-selected", String(i === j));
			b.tabIndex = i === j ? 0 : -1;
			const panel = document.getElementById(b.getAttribute("aria-controls")!);
			if (panel) panel.toggleAttribute("data-on", i === j);
		});
	buttons.forEach((b, i) => {
		b.addEventListener("click", () => pick(i));
		b.addEventListener("keydown", (e) => {
			const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
			if (!step) return;
			const n = (i + step + buttons.length) % buttons.length;
			pick(n);
			buttons[n].focus();
		});
	});
	// Show the reader's own system first where a tab names it.
	const ua = navigator.userAgent;
	const os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
	const mine = os ? buttons.findIndex((b) => b.textContent?.startsWith(os)) : -1;
	pick(mine > 0 ? mine : 0);
	group.classList.add("is-live");
}

/* ── Copy buttons on code blocks ────────────────────────────────────────── */
for (const pre of $$("pre", $(".prose") ?? document)) {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "copy";
	btn.textContent = "Copy";
	btn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(pre.querySelector("code")?.innerText ?? pre.innerText);
			btn.textContent = "Copied";
		} catch {
			btn.textContent = "Press Ctrl + C";
		}
		setTimeout(() => (btn.textContent = "Copy"), 1600);
	});
	const wrap = document.createElement("div");
	wrap.className = "code-wrap";
	pre.replaceWith(wrap);
	wrap.append(pre, btn);
}

/* ── On this page: highlight the section being read ─────────────────────── */
const tocLinks = $$<HTMLAnchorElement>("[data-toc] a");
if (tocLinks.length) {
	const targets = tocLinks.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean) as HTMLElement[];
	const mark = () => {
		const line = innerHeight * 0.3;
		let current = 0;
		targets.forEach((t, i) => {
			if (t.getBoundingClientRect().top < line) current = i;
		});
		tocLinks.forEach((a, i) => a.classList.toggle("is-here", i === current));
	};
	addEventListener("scroll", mark, { passive: true });
	mark();
}

/* ── Search ─────────────────────────────────────────────────────────────── */
type Entry = { page: string; section: string; url: string; text: string };
const dialog = $<HTMLDialogElement>("[data-search]");
const input = $<HTMLInputElement>("[data-search-input]");
const list = $("[data-search-results]");
const empty = $("[data-search-empty]");
let index: Entry[] | null = null;
let picked = 0;

const load = async () => {
	if (index) return index;
	try {
		index = (await (await fetch("/docs/search.json")).json()) as Entry[];
	} catch {
		index = [];
	}
	return index;
};

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const mark = (s: string, words: string[]) => {
	let out = escape(s);
	for (const w of words) out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
	return out;
};

// Every word has to appear somewhere. Titles and headings count for more
// than body text, and a word at the start of a heading most of all.
function search(q: string) {
	q = q.trim();
	const words = q.toLowerCase().split(/\s+/).filter(Boolean);
	if (!words.length || !index) return [];
	const hits: { e: Entry; score: number }[] = [];
	for (const e of index) {
		const page = e.page.toLowerCase();
		const sec = e.section.toLowerCase();
		const body = e.text.toLowerCase();
		let score = 0;
		let all = true;
		for (const w of words) {
			const s = (page.includes(w) ? 8 : 0) + (sec.includes(w) ? 10 : 0) + (sec.startsWith(w) ? 4 : 0) + (body.includes(w) ? 2 : 0);
			if (!s) {
				all = false;
				break;
			}
			score += s;
		}
		// A page whose title holds the whole query is usually what was meant.
		if (all) hits.push({ e, score: score + (e.section ? 0 : page.includes(q.toLowerCase().trim()) ? 30 : 1) });
	}
	return hits.sort((a, b) => b.score - a.score).slice(0, 12);
}

function snippet(text: string, words: string[]) {
	const low = text.toLowerCase();
	const at = Math.max(0, Math.min(...words.map((w) => (low.indexOf(w) + 1 || Infinity) - 1)));
	const start = Number.isFinite(at) ? Math.max(0, at - 40) : 0;
	return (start ? "…" : "") + text.slice(start, start + 150) + (start + 150 < text.length ? "…" : "");
}

function draw() {
	if (!list || !input) return;
	const q = input.value.trim();
	const words = q.toLowerCase().split(/\s+/).filter(Boolean);
	const hits = search(q);
	picked = 0;
	list.innerHTML = hits
		.map(
			({ e }, i) => `<li role="option" aria-selected="${i === 0}">
				<a href="${e.url}">
					<span class="r-page">${escape(e.page)}</span>
					<strong>${mark(e.section || e.page, words)}</strong>
					<span class="r-text">${mark(snippet(e.text, words), words)}</span>
				</a>
			</li>`,
		)
		.join("");
	if (empty) empty.hidden = !q || hits.length > 0;
}

function move(by: number) {
	const items = $$("li", list!);
	if (!items.length) return;
	picked = (picked + by + items.length) % items.length;
	items.forEach((li, i) => li.setAttribute("aria-selected", String(i === picked)));
	items[picked].scrollIntoView({ block: "nearest" });
}

async function openSearch() {
	if (!dialog || dialog.open) return;
	setSide(false);
	dialog.showModal();
	document.documentElement.classList.add("search-open");
	input?.focus();
	input?.select();
	await load();
	draw();
}

$$("[data-search-open]").forEach((b) => b.addEventListener("click", openSearch));
$("[data-search-close]")?.addEventListener("click", () => dialog?.close());
dialog?.addEventListener("close", () => document.documentElement.classList.remove("search-open"));
dialog?.addEventListener("click", (e) => e.target === dialog && dialog.close());
input?.addEventListener("input", draw);
input?.addEventListener("keydown", (e) => {
	if (e.key === "ArrowDown") (e.preventDefault(), move(1));
	else if (e.key === "ArrowUp") (e.preventDefault(), move(-1));
	else if (e.key === "Enter") {
		const a = $<HTMLAnchorElement>(`li:nth-child(${picked + 1}) a`, list!);
		if (a) location.href = a.href;
	}
});
// Clicking a result on the same page only changes the hash, so close too.
list?.addEventListener("click", (e) => (e.target as Element).closest("a") && dialog?.close());

addEventListener("keydown", (e) => {
	const typing = (e.target as HTMLElement).closest("input, textarea, [contenteditable]");
	if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
		e.preventDefault();
		openSearch();
	}
});
