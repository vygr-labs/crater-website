// The practice console. A small copy of Crater's live controls: a library
// with Scripture and Songs, Preview, Live and the projector the room sees.
// Drills read out cues and time how long the wall takes to show the answer.
import {
	BOOKS,
	TRANSLATIONS,
	chapter,
	hasTranslation,
	isBookName,
	loadTranslation,
	parseRef,
	refKey,
	refLabel,
	searchText,
	type TranslationId,
} from "./bible";
import { DRILLS, type Cue, type Drill, type Slide, type Wall } from "./drills";
import { SONGS, sectionName } from "./songs";
import { clearSessions, loadSessions, overview, previous, saveSession, secs, span, summarise, type CueResult } from "./stats";
import { cleared, requestLink, saved, signOut, startSync, syncState } from "./sync";

type Item = { title: string; slides: Slide[] };
type Zone = "library" | "preview" | "live";
type Via = "keys" | "click";
type Row = { book: number; chapter: number; verse: number; text: string };

const root = document.querySelector<HTMLElement>("[data-pg]");
if (root) start(root);

function start(root: HTMLElement) {
	const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
	const $$ = <T extends HTMLElement = HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel));
	const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
	const touchFirst = matchMedia("(hover: none)").matches;

	const el = {
		console: $("[data-console]"),
		wall: $("[data-wall]"),
		wallContent: $("[data-wall-content]"),
		coach: $("[data-coach]"),
		overlay: $("[data-overlay]"),
		libTabs: $$<HTMLButtonElement>("[data-lib-tab]"),
		scripture: $("[data-lib='scripture']"),
		songs: $("[data-lib='songs']"),
		q: $<HTMLInputElement>("[data-q]"),
		sq: $<HTMLInputElement>("[data-sq]"),
		interp: $("[data-interp]"),
		trans: $$<HTMLButtonElement>("[data-trans]"),
		rows: $("[data-rows]"),
		count: $("[data-count]"),
		songRows: $("[data-song-rows]"),
		preview: $("[data-preview-list]"),
		previewCount: $("[data-preview-count]"),
		live: $("[data-live-list]"),
		liveCount: $("[data-live-count]"),
		clearBtns: $$<HTMLButtonElement>("[data-act='clear']"),
		logoBtns: $$<HTMLButtonElement>("[data-act='logo']"),
		views: $$<HTMLButtonElement>("[data-view]"),
		fullBtns: $$<HTMLButtonElement>("[data-act='full']"),
		stats: document.querySelector<HTMLElement>("[data-stats]"),
	};

	/* ── State ──────────────────────────────────────────────────────────── */
	const s = {
		zone: null as Zone | null,
		view: "library" as Zone,
		tab: "scripture" as "scripture" | "songs",
		trans: "KJV" as TranslationId,
		rows: [] as Row[],
		sel: -1,
		range: 0, // extra verses after sel, from "1 cor 13:4-7"
		songSel: 0,
		preview: { item: null as Item | null, sel: 0 },
		live: { item: null as Item | null, sel: 0 },
		clear: false,
		logo: false,
	};

	// The drill in progress.
	const run = {
		drill: null as Drill | null,
		cues: [] as Cue[],
		at: 0,
		started: 0,
		results: [] as CueResult[],
		cur: { wrong: 0, keys: 0, clicks: 0, hinted: false },
		timer: 0,
		hintTimer: 0,
		between: false,
		// The last finished run of this drill, to race against.
		prev: { last: null as CueResult[] | null, best: 0, runs: 0 },
	};

	const wall = (): Wall => ({ slide: s.live.item?.slides[s.live.sel] ?? null, clear: s.clear, logo: s.logo });
	const cue = () => (run.drill && !run.between ? run.cues[run.at] : null);

	/* ── Building items ─────────────────────────────────────────────────── */
	const verseSlide = (r: Row, t: TranslationId): Slide => ({
		key: refKey(r.book, r.chapter, r.verse),
		label: `${refLabel(r.book, r.chapter, r.verse)} · ${t}`,
		text: r.text,
		trans: t,
	});

	function verseItem(): Item | null {
		const r = s.rows[s.sel];
		if (!r) return null;
		const slides = [verseSlide(r, s.trans)];
		for (let i = 1; i <= s.range; i++) {
			const n = s.rows[s.sel + i];
			if (n && n.chapter === r.chapter && n.book === r.book) slides.push(verseSlide(n, s.trans));
		}
		const last = slides.length > 1 ? r.verse + slides.length - 1 : r.verse;
		return { title: `${refLabel(r.book, r.chapter, r.verse, last)} (${s.trans})`, slides };
	}

	function songItem(i: number): Item | null {
		const song = filteredSongs()[i];
		if (!song) return null;
		return {
			title: song.title,
			slides: song.order.map((k) => ({ key: `${song.id}:${k}`, label: sectionName(k), text: song.sections[k], songId: song.id, section: k })),
		};
	}

	const filteredSongs = () => {
		const q = el.sq.value.trim().toLowerCase();
		return q ? SONGS.filter((x) => `${x.title} ${x.author} ${Object.values(x.sections).join(" ")}`.toLowerCase().includes(q)) : SONGS;
	};

	/* ── Recording what the learner does ────────────────────────────────── */
	const tally = (via: Via) => {
		if (!cue()) return;
		if (via === "keys") run.cur.keys++;
		else run.cur.clicks++;
	};

	// Anything that changes the wall runs through here so the drill can check it.
	function wallChanged(textChanged: boolean) {
		drawWall();
		drawLive();
		drawButtons();
		const c = cue();
		if (!c) return;
		if (c.done(wall())) return finishCue();
		if (textChanged && !s.clear && !s.logo) {
			run.cur.wrong++;
			flashWrong();
			drawRun();
		}
	}

	/* ── Actions ────────────────────────────────────────────────────────── */
	function loadPreview(item: Item | null, sel = 0) {
		s.preview = { item, sel };
		drawPreview();
	}

	function goLive(item: Item | null, sel: number, via: Via) {
		if (!item) return;
		tally(via);
		const before = wall().slide?.key + "|" + wall().slide?.trans;
		s.live = { item, sel };
		const after = wall().slide?.key + "|" + wall().slide?.trans;
		wallChanged(before !== after);
	}

	function sendFromLibrary(via: Via) {
		if (s.tab === "scripture") {
			const item = verseItem();
			loadPreview(item);
			goLive(item, 0, via);
		} else {
			const item = songItem(s.songSel);
			loadPreview(item);
			goLive(item, 0, via);
		}
	}

	const sendPreview = (via: Via) => goLive(s.preview.item, s.preview.sel, via);

	function moveLive(by: number, via: Via) {
		const item = s.live.item;
		if (!item) return;
		const n = Math.min(item.slides.length - 1, Math.max(0, s.live.sel + by));
		if (n === s.live.sel) return;
		goLive(item, n, via);
	}

	function toggleClear(via: Via) {
		tally(via);
		s.clear = !s.clear;
		wallChanged(false);
	}

	function toggleLogo(via: Via) {
		tally(via);
		s.logo = !s.logo;
		wallChanged(false);
	}

	/* ── Library: Scripture ─────────────────────────────────────────────── */
	let searchTimer = 0;
	async function runScripture(keepSel = false) {
		const q = el.q.value.trim();
		if (!hasTranslation(s.trans)) {
			el.rows.innerHTML = `<p class="pg-empty">Loading the ${esc(TRANSLATIONS.find((t) => t.id === s.trans)!.name)}…</p>`;
			try {
				await loadTranslation(s.trans);
			} catch {
				el.rows.innerHTML = `<p class="pg-empty">The Bible text didn't load. Check your connection and try again.</p>`;
				return;
			}
		}
		const ref = q && (/\d/.test(q) || isBookName(q)) ? parseRef(q) : null;
		const prevSel = s.rows[s.sel];
		if (ref) {
			const verses = chapter(s.trans, ref.book, ref.chapter);
			s.rows = verses.map((text, i) => ({ book: ref.book, chapter: ref.chapter, verse: i + 1, text }));
			s.sel = Math.min(ref.verse, verses.length) - 1;
			s.range = Math.min(ref.to, verses.length) - ref.verse;
			el.interp.textContent = verses.length ? `Interpreted: ${refLabel(ref.book, ref.chapter, Math.min(ref.verse, verses.length), Math.min(ref.to, verses.length))}` : `${BOOKS[ref.book]} has no chapter ${ref.chapter}`;
		} else if (q.length > 2) {
			s.rows = searchText(s.trans, q);
			s.sel = s.rows.length ? 0 : -1;
			s.range = 0;
			el.interp.textContent = s.rows.length ? `Verses with “${q}”` : "";
		} else {
			s.rows = [];
			s.sel = -1;
			s.range = 0;
			el.interp.textContent = "";
		}
		// Switching translation keeps the same verse picked.
		if (keepSel && prevSel) {
			const at = s.rows.findIndex((r) => r.book === prevSel.book && r.chapter === prevSel.chapter && r.verse === prevSel.verse);
			if (at >= 0) s.sel = at;
		}
		drawRows();
		loadPreview(verseItem());
	}

	function drawRows() {
		if (!el.q.value.trim()) {
			el.count.textContent = "";
			el.rows.innerHTML = `<div class="pg-empty">
				<p>Type a reference or words you remember.</p>
				<div class="pg-try">${["jn 3:16", "ps 23", "rom 8:28", "1 cor 13:4-7", "the lord is my shepherd"]
					.map((t) => `<button type="button" data-try="${esc(t)}">${esc(t)}</button>`)
					.join("")}</div>
			</div>`;
			return;
		}
		el.count.textContent = s.rows.length ? `${s.rows.length} ${s.rows.length === 1 ? "verse" : "verses"}` : "";
		if (!s.rows.length) {
			el.rows.innerHTML = `<p class="pg-empty">Nothing found. Try a reference like “jn 3:16”.</p>`;
			return;
		}
		el.rows.innerHTML = s.rows
			.map(
				(r, i) => `<button type="button" class="vrow${i === s.sel ? " is-sel" : ""}${i > s.sel && i <= s.sel + s.range ? " is-range" : ""}" data-row="${i}">
					<span class="vrow-text">${esc(r.text)}</span>
					<span class="vrow-ref">${esc(refLabel(r.book, r.chapter, r.verse))}</span>
				</button>`,
			)
			.join("");
		keepInView(el.rows, el.rows.querySelector(".is-sel"));
	}

	function pickRow(i: number) {
		if (i < 0 || i >= s.rows.length) return;
		s.sel = i;
		s.range = 0;
		drawRows();
		loadPreview(verseItem());
	}

	/* ── Library: Songs ─────────────────────────────────────────────────── */
	function drawSongs() {
		const list = filteredSongs();
		s.songSel = Math.min(s.songSel, Math.max(0, list.length - 1));
		el.songRows.innerHTML = list.length
			? list
					.map(
						(x, i) => `<button type="button" class="srow${i === s.songSel ? " is-sel" : ""}" data-song="${i}">
							<span>${esc(x.title)}</span><small>${esc(x.author)}</small>
							<em>${x.order.filter((k, j, a) => a.indexOf(k) === j).map((k) => (k === "C" ? "C" : k)).join(" · ")}</em>
						</button>`,
					)
					.join("")
			: `<p class="pg-empty">No song matches that.</p>`;
		keepInView(el.songRows, el.songRows.querySelector(".is-sel"));
	}

	function pickSong(i: number) {
		const list = filteredSongs();
		if (i < 0 || i >= list.length) return;
		s.songSel = i;
		drawSongs();
		loadPreview(songItem(i));
	}

	function setTab(tab: "scripture" | "songs") {
		s.tab = tab;
		el.libTabs.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.libTab === tab)));
		el.scripture.hidden = tab !== "scripture";
		el.songs.hidden = tab !== "songs";
		if (tab === "songs") {
			drawSongs();
			loadPreview(songItem(s.songSel));
		} else loadPreview(verseItem());
	}

	/* ── Preview and Live ───────────────────────────────────────────────── */
	const slideRow = (sl: Slide, i: number, sel: number, attr: string) => `
		<button type="button" class="slide${i === sel ? " is-sel" : ""}" ${attr}="${i}">
			<span class="slide-n">${sl.songId ? esc(sl.section === "C" ? "C" : sl.section!) : i + 1}</span>
			<span class="slide-body">
				<span class="slide-label">${esc(sl.label)}</span>
				<span class="slide-text">${esc(sl.text).replace(/\n/g, "<br>")}</span>
			</span>
		</button>`;

	function drawPreview() {
		const it = s.preview.item;
		el.previewCount.textContent = it ? `${s.preview.sel + 1} / ${it.slides.length}` : "";
		el.preview.innerHTML = it
			? it.slides.map((sl, i) => slideRow(sl, i, s.preview.sel, "data-pslide")).join("")
			: `<p class="pg-empty">Pick something in the library and it shows here first, before anyone sees it.</p>`;
		keepInView(el.preview, el.preview.querySelector(".is-sel"));
	}

	function drawLive() {
		const it = s.live.item;
		el.liveCount.textContent = it ? `${s.live.sel + 1} / ${it.slides.length}` : "";
		el.live.innerHTML = it
			? it.slides.map((sl, i) => slideRow(sl, i, s.live.sel, "data-lslide")).join("")
			: `<p class="pg-empty">Nothing is live yet. What you send live shows on the projector.</p>`;
		keepInView(el.live, el.live.querySelector(".is-sel"));
	}

	function drawButtons() {
		el.clearBtns.forEach((b) => b.setAttribute("aria-pressed", String(s.clear)));
		el.logoBtns.forEach((b) => b.setAttribute("aria-pressed", String(s.logo)));
		root.classList.toggle("has-live", !!s.live.item);
	}

	/* ── The projector ──────────────────────────────────────────────────── */
	let lastWall = "";
	function drawWall() {
		const w = wall();
		const sl = w.slide;
		const sig = `${w.logo}|${w.clear}|${sl?.key}|${sl?.trans}`;
		if (sig === lastWall) return;
		lastWall = sig;
		el.wall.classList.toggle("is-logo", w.logo);
		el.wall.classList.toggle("is-clear", w.clear);
		const html = sl
			? `<p class="wall-label">${esc(sl.songId ? "" : sl.label)}</p><p class="wall-text${sl.songId ? " is-song" : ""}" style="--fs:${fit(sl.text)}">${esc(sl.text).replace(/\n/g, "<br>")}</p>`
			: "";
		el.wallContent.classList.add("is-swap");
		setTimeout(() => {
			el.wallContent.innerHTML = html;
			el.wallContent.classList.remove("is-swap");
		}, 140);
	}

	// Longer text gets a smaller size so a verse always fits the wall.
	const fit = (t: string) => {
		const n = t.length + t.split("\n").length * 12;
		return n < 90 ? "5.6cqw" : n < 170 ? "4.7cqw" : n < 250 ? "4cqw" : n < 340 ? "3.4cqw" : "3cqw";
	};

	/* ── Coach ──────────────────────────────────────────────────────────── */
	function drawCoach() {
		const c = cue();
		if (!run.drill) {
			el.coach.innerHTML = `
				<p class="coach-kicker">Free play</p>
				<p class="coach-say">Try anything. ${touchFirst ? "Tap a verse, then Go live." : "Type <kbd>jn 3:16</kbd> in Scripture and press <kbd>Enter</kbd>."}</p>
				<ul class="coach-tips">
					<li>Search by reference, or by words you remember.</li>
					<li>Send a hymn live, then step through it from the Live panel.</li>
					<li>Clear hides the words. Logo covers the whole screen.</li>
				</ul>
				<button type="button" class="coach-btn" data-open-drills>Start a drill</button>`;
			return;
		}
		if (!c) return;
		el.coach.innerHTML = `
			<div class="coach-top">
				<p class="coach-kicker">${esc(run.drill.name)} · ${run.at + 1} of ${run.cues.length}</p>
				<span class="coach-time" data-time>0.0s</span>
			</div>
			<div class="coach-progress" aria-hidden="true"><span style="width:${(run.at / run.cues.length) * 100}%"></span></div>
			<p class="coach-who">${esc(c.who)}</p>
			<p class="coach-say">${esc(c.say)}</p>
			<p class="coach-task">${esc(c.task)}</p>
			<p class="coach-hint" data-hint hidden>${esc(touchFirst ? c.hint.touch : c.hint.keys)}</p>
			<div class="coach-actions">
				<button type="button" class="coach-link" data-show-hint>Show a hint</button>
				<button type="button" class="coach-link" data-stop>Stop</button>
			</div>
			<div class="run" data-run></div>`;
		drawRun();
	}

	// The running score under the cue: one bar per cue, the last run's times
	// as ticks to beat, and the numbers so far.
	function drawRun() {
		const box = el.coach.querySelector<HTMLElement>("[data-run]");
		if (!box || !run.drill) return;
		const done = run.results;
		const last = run.prev.last;
		const sum = summarise(done);
		const wrongNow = done.reduce((a, r) => a + r.wrong, 0) + (run.between ? 0 : run.cur.wrong);
		const top = Math.max(...done.map((r) => r.ms), ...(last ?? []).map((r) => r.ms), 4000);
		const h = (ms: number) => Math.max(6, Math.min(100, (ms / top) * 100));
		const bars = run.cues
			.map((_, i) => {
				const r = done[i];
				const was = last?.[i];
				const now = i === done.length && !run.between;
				const tip = r ? `Cue ${i + 1}: ${secs(r.ms)}${r.wrong ? `, ${r.wrong} wrong` : ""}${was ? `. Last run ${secs(was.ms)}` : ""}` : `Cue ${i + 1}`;
				return `<span class="run-col${now ? " is-now" : ""}" title="${esc(tip)}">
					${r ? `<i class="run-bar${r.wrong ? " is-bad" : ""}" style="height:${h(r.ms)}%"></i>` : ""}
					${was ? `<b class="run-was" style="bottom:${h(was.ms)}%"></b>` : ""}
				</span>`;
			})
			.join("");
		let pace = "";
		if (last && done.length) {
			const diff = done.reduce((a, r, i) => a + ((last[i]?.ms ?? r.ms) - r.ms), 0);
			pace = Math.abs(diff) < 100 ? "Level" : `${secs(Math.abs(diff))} ${diff > 0 ? "ahead" : "behind"}`;
		}
		const paceClass = pace.endsWith("ahead") ? "is-good" : pace.endsWith("behind") ? "is-bad" : "";
		box.innerHTML = `
			<div class="run-bars" aria-hidden="true">${bars}</div>
			${last ? `<p class="run-key" aria-hidden="true"><span class="run-key-bar"></span>This run<span class="run-key-was"></span>Last run</p>` : ""}
			<dl class="run-stats">
				<div><dt>Average</dt><dd>${done.length ? secs(sum.avgMs) : "–"}</dd></div>
				<div><dt>Clean</dt><dd>${sum.clean}/${done.length}</dd></div>
				<div><dt>Wrong slides</dt><dd class="${wrongNow ? "is-bad" : ""}">${wrongNow}</dd></div>
				<div><dt>${last ? "Against last run" : "Best before"}</dt><dd class="${paceClass}">${last ? pace || "–" : run.prev.best ? secs(run.prev.best) : "First run"}</dd></div>
			</dl>`;
	}

	function showHint() {
		const h = el.coach.querySelector<HTMLElement>("[data-hint]");
		if (!h || !h.hidden) return;
		h.hidden = false;
		run.cur.hinted = true;
		el.coach.querySelector("[data-show-hint]")?.remove();
	}

	function flashWrong() {
		el.coach.classList.remove("is-wrong");
		void el.coach.offsetWidth;
		el.coach.classList.add("is-wrong");
	}

	/* ── Drills ─────────────────────────────────────────────────────────── */
	function resetConsole(withLogo: boolean) {
		s.live = { item: null, sel: 0 };
		s.clear = false;
		s.logo = withLogo;
		drawLive();
		drawButtons();
		drawWall();
	}

	function startDrill(id: string) {
		const d = DRILLS.find((x) => x.id === id);
		if (!d) return;
		closeOverlay();
		run.drill = d;
		run.cues = d.build();
		run.results = [];
		run.prev = previous(d.id);
		run.started = Date.now();
		resetConsole(!!d.startWithLogo);
		startCue(0);
	}

	function startCue(i: number) {
		run.at = i;
		run.between = false;
		run.cur = { wrong: 0, keys: 0, clicks: 0, hinted: false };
		drawCoach();
		const t0 = performance.now();
		run.started = t0;
		cancelAnimationFrame(run.timer);
		const tick = () => {
			const t = el.coach.querySelector("[data-time]");
			if (t) t.textContent = secs(performance.now() - t0);
			run.timer = requestAnimationFrame(tick);
		};
		run.timer = requestAnimationFrame(tick);
		clearTimeout(run.hintTimer);
		run.hintTimer = window.setTimeout(showHint, 12000);
		// Some cues are already true (the logo is up when asked to keep it up).
		if (run.cues[i].done(wall())) finishCue();
	}

	function finishCue() {
		const c = run.cues[run.at];
		const ms = performance.now() - run.started;
		cancelAnimationFrame(run.timer);
		clearTimeout(run.hintTimer);
		run.results.push({ skill: c.skill, kind: c.kind, ms, ...run.cur });
		run.between = true;
		el.coach.classList.add("is-done");
		const t = el.coach.querySelector("[data-time]");
		if (t) t.textContent = secs(ms);
		drawRun();
		const task = el.coach.querySelector(".coach-task");
		if (task) task.innerHTML = `<strong>Done in ${secs(ms)}.</strong>${run.cur.wrong ? ` ${run.cur.wrong} wrong ${run.cur.wrong === 1 ? "slide" : "slides"} went up first.` : ""}`;
		setTimeout(() => {
			el.coach.classList.remove("is-done");
			if (run.at + 1 < run.cues.length) startCue(run.at + 1);
			else endDrill();
		}, 1100);
	}

	function stopDrill() {
		cancelAnimationFrame(run.timer);
		clearTimeout(run.hintTimer);
		run.drill = null;
		drawCoach();
	}

	function endDrill() {
		const d = run.drill!;
		const results = run.results;
		const prev = run.prev;
		const all = saveSession({ at: Date.now(), drill: d.id, cues: results });
		saved();
		const now = summarise(results);
		const then = prev.last ? summarise(prev.last) : null;
		stopDrill();
		drawStats(all);
		const best = prev.best && now.avgMs < prev.best - 50;
		// "0.6s faster than last run", or nothing when there is nothing to compare.
		const vs = (a: number, b: number | undefined, unit: "s" | "n", good: "less" | "more") => {
			if (b === undefined) return "";
			const diff = a - b;
			if (Math.abs(diff) < (unit === "s" ? 50 : 1)) return `<small>Same as last run</small>`;
			const better = good === "less" ? diff < 0 : diff > 0;
			const amount = unit === "s" ? secs(Math.abs(diff)) : String(Math.abs(diff));
			const word = unit === "s" ? (diff < 0 ? "faster" : "slower") : diff > 0 ? "more" : "fewer";
			return `<small class="${better ? "is-good" : "is-bad"}">${amount} ${word} than last run</small>`;
		};
		openOverlay(`
			<div class="ov-card ov-wide">
				<p class="ov-kicker">${esc(d.name)} finished</p>
				<h3 class="ov-title">${best ? "A new personal best." : now.accuracy === 1 ? "Clean run. Nothing wrong reached the wall." : "Run complete."}</h3>
				<dl class="ov-stats">
					<div><dt>Average per cue</dt><dd>${secs(now.avgMs)}</dd>${vs(now.avgMs, then?.avgMs, "s", "less")}</div>
					<div><dt>Whole drill</dt><dd>${secs(now.totalMs)}</dd>${vs(now.totalMs, then?.totalMs, "s", "less")}</div>
					<div><dt>Clean cues</dt><dd>${now.clean} of ${results.length}</dd>${vs(now.clean, then?.clean, "n", "more")}</div>
					<div><dt>Wrong slides</dt><dd>${now.wrong}</dd>${vs(now.wrong, then?.wrong, "n", "less")}</div>
					<div><dt>Fastest cue</dt><dd>${secs(now.fastMs)}</dd></div>
					<div><dt>Slowest cue</dt><dd>${secs(now.slowMs)}</dd></div>
					${touchFirst ? "" : `<div><dt>Keyboard use</dt><dd>${Math.round(now.keyboard * 100)}%</dd></div>`}
					<div><dt>Hints</dt><dd>${now.hinted}</dd></div>
				</dl>
				${prev.best ? `<p class="ov-note">${best ? `Your old best was ${secs(prev.best)} a cue.` : `Your best on this drill is ${secs(prev.best)} a cue.`} This was run ${prev.runs + 1}.</p>` : ""}
				${cueChart(results, prev.last)}
				<ol class="ov-cues">${results
					.map((r, i) => {
						const was = prev.last?.[i];
						return `<li><span>${esc(run.cues[i].task)}</span><b class="${r.wrong ? "is-bad" : ""}">${secs(r.ms)}${r.wrong ? ` · ${r.wrong} wrong` : ""}${was ? `<em>last ${secs(was.ms)}</em>` : ""}</b></li>`;
					})
					.join("")}</ol>
				<div class="ov-actions">
					<button type="button" class="btn btn-brand" data-drill="${d.id}">Run it again</button>
					<button type="button" class="btn btn-ghost" data-open-drills>Pick another</button>
					<a class="btn btn-ghost" href="#progress-h" data-close-overlay data-to-progress>See all progress</a>
				</div>
			</div>`);
	}

	// This run's time for each cue beside the last run's.
	function cueChart(now: CueResult[], last: CueResult[] | null) {
		const W = 520, H = 150, P = 22, B = 16;
		const n = now.length;
		const top = Math.max(...now.map((r) => r.ms), ...(last ?? []).map((r) => r.ms), 1000) * 1.1;
		const slot = (W - P * 2) / n;
		const bw = Math.min(last ? 14 : 22, slot / (last ? 2.6 : 1.8));
		const y = (ms: number) => H - B - (ms / top) * (H - B - 12);
		const bars = now
			.map((r, i) => {
				const cx = P + slot * (i + 0.5);
				const was = last?.[i];
				const x1 = last ? cx - bw - 1 : cx - bw / 2;
				return `${was ? `<rect x="${cx + 1}" y="${y(was.ms)}" width="${bw}" height="${H - B - y(was.ms)}" rx="3" class="cc-was"><title>Cue ${i + 1}, last run: ${secs(was.ms)}</title></rect>` : ""}
					<rect x="${x1}" y="${y(r.ms)}" width="${bw}" height="${H - B - y(r.ms)}" rx="3" class="cc-now${r.wrong ? " is-bad" : ""}"><title>Cue ${i + 1}: ${secs(r.ms)}</title></rect>
					<text x="${cx}" y="${H - 2}" text-anchor="middle" class="st-tick">${i + 1}</text>`;
			})
			.join("");
		return `<figure class="ov-chart">
			<figcaption>Seconds per cue${last ? `<span><i class="cc-key-now"></i>This run<i class="cc-key-was"></i>Last run</span>` : ""}</figcaption>
			<svg viewBox="0 0 ${W} ${H}" class="st-chart" role="img" aria-label="Time for each cue in this run${last ? " beside the last run" : ""}.">
				<line x1="${P}" x2="${W - P}" y1="${H - B}" y2="${H - B}" class="st-axis" />${bars}
			</svg>
		</figure>`;
	}

	function openDrills(focus = true) {
		openOverlay(`
			<div class="ov-card">
				<p class="ov-kicker">Practice drills</p>
				<h3 class="ov-title">Pick a drill. Each cue is timed.</h3>
				<p class="ov-note">Someone in the room says something and you put the right thing on the projector. Wrong slides that reach the wall count against you, just like on Sunday.</p>
				<div class="ov-drills">${DRILLS.map(
					(d) => `<button type="button" class="ov-drill" data-drill="${d.id}">
						<strong>${esc(d.name)}</strong>
						<span>${esc(d.about)}</span>
						<small>${d.build().length} cues</small>
					</button>`,
				).join("")}</div>
				<div class="ov-full" data-full-offer ${isFull() ? "hidden" : ""}>
					<p>Practise in full screen so the rest of the page stays out of the way.</p>
					<button type="button" class="btn btn-brand" data-act="full">Go full screen</button>
				</div>
				<button type="button" class="coach-link" data-close-overlay>Just let me explore</button>
			</div>`, focus);
	}

	/* ── Full screen ────────────────────────────────────────────────────────
	   The console covers the page so nothing else competes for attention. Where
	   the browser allows it the whole screen is taken too, which hides the
	   tabs and address bar. iPhones only allow that for video, so there the
	   console just fills the browser window. */
	const html = document.documentElement;
	const native = !!html.requestFullscreen && document.fullscreenEnabled;
	const isFull = () => html.classList.contains("pg-full");
	function setFull(on: boolean) {
		html.classList.toggle("pg-full", on);
		if (native && on && !document.fullscreenElement) html.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
		if (native && !on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
		for (const b of el.fullBtns) {
			b.setAttribute("aria-pressed", String(on));
			const label = b.querySelector("span");
			if (label) label.textContent = on ? "Exit full screen" : "Full screen";
			else b.setAttribute("aria-label", on ? "Exit full screen" : "Full screen");
		}
		const offer = el.overlay.querySelector<HTMLElement>("[data-full-offer]");
		if (offer) offer.hidden = on;
	}
	// The browser's own Escape leaves full screen without telling the page first.
	document.addEventListener("fullscreenchange", () => !document.fullscreenElement && isFull() && setFull(false));

	function openOverlay(html: string, focus = true) {
		el.overlay.innerHTML = html;
		el.overlay.hidden = false;
		el.overlay.scrollTop = 0;
		if (focus) (el.overlay.querySelector("[data-drill], .btn") as HTMLElement | null)?.focus({ preventScroll: true });
	}

	function closeOverlay() {
		el.overlay.hidden = true;
		el.overlay.innerHTML = "";
	}

	/* ── Progress panel ─────────────────────────────────────────────────── */
	let statsDrill = "";
	function drawStats(all = loadSessions()) {
		if (!el.stats) return;
		const body = el.stats.querySelector<HTMLElement>("[data-stats-body]")!;
		if (!all.length) {
			body.innerHTML = `<p class="st-empty">Finish a drill and your times, accuracy and keyboard use show up here, with charts comparing each run.</p>${saveBox()}`;
			return;
		}
		const weeks = innerWidth < 600 ? 15 : 26;
		const o = overview(all, statsDrill || undefined, weeks);
		const name = (id: string) => DRILLS.find((d) => d.id === id)?.name ?? id;
		const r = o.recent;
		// Which way the last 40 cues moved against the 40 before them.
		const move = (a: number, b: number | undefined, kind: "time" | "pct", good: "less" | "more") => {
			if (b === undefined) return "";
			const diff = a - b;
			if (kind === "time" ? Math.abs(diff) < 100 : Math.abs(diff) < 0.01) return `<small>Steady</small>`;
			const better = good === "less" ? diff < 0 : diff > 0;
			const text = kind === "time" ? `${secs(Math.abs(diff))} ${diff < 0 ? "faster" : "slower"}` : `${Math.round(Math.abs(diff) * 100)} points ${diff > 0 ? "up" : "down"}`;
			return `<small class="${better ? "is-good" : "is-bad"}">${text} than the 40 before</small>`;
		};
		const filters = [["", "All drills"], ...DRILLS.map((d) => [d.id, d.name])]
			.map(([id, label]) => `<button type="button" data-st-drill="${id}" aria-pressed="${statsDrill === id}">${esc(label)}</button>`)
			.join("");
		body.innerHTML = `
			<div class="st-filter" role="group" aria-label="Show progress for">${filters}</div>
			${
				!o.sessions
					? `<p class="st-empty">No ${esc(name(statsDrill).toLowerCase())} drills finished yet.</p>`
					: `
			<div class="st-cards">
				<div><dt>Drills finished</dt><dd>${o.sessions}</dd><small>${o.cues} cues answered</small></div>
				<div><dt>Time on cues</dt><dd>${span(o.totalMs)}</dd><small>from cue to the right slide</small></div>
				<div><dt>Average per cue</dt><dd>${secs(r.avgMs)}</dd>${move(r.avgMs, o.before?.avgMs, "time", "less") || "<small>last 40 cues</small>"}</div>
				<div><dt>Clean cues</dt><dd>${Math.round(r.accuracy * 100)}%</dd>${move(r.accuracy, o.before?.accuracy, "pct", "more") || "<small>no wrong slide shown</small>"}</div>
				${
					touchFirst
						? `<div><dt>Hints used</dt><dd>${r.hinted}</dd><small>in the last 40 cues</small></div>`
						: `<div><dt>Keyboard use</dt><dd>${Math.round(r.keyboard * 100)}%</dd>${move(r.keyboard, o.before?.keyboard, "pct", "more") || "<small>of your actions</small>"}</div>`
				}
				<div><dt>Days in a row</dt><dd>${o.streak.now}</dd><small>best ${o.streak.best} · ${o.streak.days} ${o.streak.days === 1 ? "day" : "days"} in all</small></div>
			</div>
			<div class="st-grid">
				<figure class="st-panel">
					<figcaption>Speed<span>Average seconds per cue, last ${o.runs.length} ${o.runs.length === 1 ? "run" : "runs"}. Lower is better.</span></figcaption>
					${speedChart(o.runs, statsDrill ? o.best[statsDrill] : 0)}
				</figure>
				<figure class="st-panel">
					<figcaption>Accuracy<span>Share of cues with no wrong slide, each run.</span></figcaption>
					${accuracyChart(o.runs)}
				</figure>
			</div>
			<div class="st-grid">
				<figure class="st-panel">
					<figcaption>Where your time goes<span>Your latest cues of each kind, against your first.</span></figcaption>
					${kindBars(o.kinds)}
				</figure>
				<figure class="st-panel">
					<figcaption>Practice<span>Cues answered each day, last ${weeks} weeks.</span></figcaption>
					${heatmap(o.activity)}
				</figure>
			</div>
			<div class="st-recent">
				<p class="st-h">By drill</p>
				<table>
					<thead><tr><th>Drill</th><th>Runs</th><th>First run</th><th>Latest</th><th>Best</th><th>Change</th></tr></thead>
					<tbody>${Object.entries(o.drills)
						.map(([id, d]) => {
							const diff = d.first - d.latest;
							const change = d.runs < 2 ? "–" : `${secs(Math.abs(diff))} ${diff >= 0 ? "faster" : "slower"}`;
							return `<tr><td>${esc(name(id))}</td><td>${d.runs}</td><td>${secs(d.first)}</td><td>${secs(d.latest)}</td><td>${secs(d.best)}</td><td class="${d.runs < 2 ? "" : diff >= 0 ? "is-good" : "is-bad"}">${change}</td></tr>`;
						})
						.join("")}</tbody>
				</table>
			</div>
			<div class="st-recent">
				<p class="st-h">Recent runs</p>
				<table>
					<thead><tr><th>When</th><th>Drill</th><th>Per cue</th><th>Whole drill</th><th>Fastest</th><th>Slowest</th><th>Clean</th><th>Wrong</th><th>Hints</th>${touchFirst ? "" : "<th>Keyboard</th>"}</tr></thead>
					<tbody>${[...o.runs]
						.reverse()
						.slice(0, 10)
						.map(
							(t) =>
								`<tr><td>${when(t.at)}</td><td>${esc(name(t.drill))}</td><td>${secs(t.avgMs)}</td><td>${secs(t.totalMs)}</td><td>${secs(t.fastMs)}</td><td>${secs(t.slowMs)}</td><td>${Math.round(t.accuracy * 100)}%</td><td class="${t.wrong ? "is-bad" : ""}">${t.wrong}</td><td>${t.hinted}</td>${touchFirst ? "" : `<td>${Math.round(t.keyboard * 100)}%</td>`}</tr>`,
						)
						.join("")}</tbody>
				</table>
			</div>`
			}
			${saveBox()}
			<button type="button" class="st-reset" data-reset>Clear my progress</button>`;
	}

	// Saving to an email address, so the runs follow the learner to another
	// computer. linkSent holds what happened to the last "send me a link".
	let linkSent: "" | "sending" | "sent" | "email" | "busy" | "failed" = "";
	function saveBox() {
		const sync = syncState();
		if (sync.email)
			return `<div class="st-save is-on">
				<p>${sync.note === "signed-in" ? "You're signed in. " : ""}Your progress is saved to <b>${esc(sync.email)}</b> and follows you to any browser you sign in on.</p>
				<div class="st-save-acts">
					<button type="button" data-sign-out>Sign out of this browser</button>
					<button type="button" data-forget>Delete my saved progress</button>
				</div>
			</div>`;
		const note =
			sync.note === "expired" && !linkSent
				? `<p class="st-save-note is-bad">That link has expired or was used already. Send yourself a new one.</p>`
				: sync.note === "forgotten" && !linkSent
					? `<p class="st-save-note">Your saved progress and email address are deleted. Your runs in this browser are still here.</p>`
					: {
							"": "",
							sending: "",
							sent: `<p class="st-save-note is-good">Check your inbox for a link from Crater. It works once, for the next 30 minutes.</p>`,
							email: `<p class="st-save-note is-bad">That email address doesn't look right.</p>`,
							busy: `<p class="st-save-note is-bad">Too many links asked for just now. Try again in an hour.</p>`,
							failed: `<p class="st-save-note is-bad">The email couldn't be sent. Try again in a minute.</p>`,
						}[linkSent];
		return `<form class="st-save" data-save novalidate>
			<p class="st-h">Keep your progress</p>
			<p>Your runs are saved in this browser only. Enter your email and we'll send you a link that saves them, so you can pick up on another computer.</p>
			<div class="st-save-row">
				<input id="save-email" name="email" aria-label="Email address" type="email" autocomplete="email" placeholder="you@example.com" required />
				<button type="submit" class="btn btn-brand" ${linkSent === "sending" ? "disabled" : ""}>${linkSent === "sending" ? "Sending…" : "Send me a link"}</button>
			</div>
			${note}
			<p class="st-save-fine">We only use your address to sign you in. No newsletters.</p>
		</form>`;
	}

	const when = (t: number) => {
		const d = new Date(t);
		const today = new Date().toDateString() === d.toDateString();
		return today ? d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
	};
	// Narrow screens draw narrower charts so the labels stay readable.
	const chartW = () => (innerWidth < 600 ? 340 : 560);
	type Run = ReturnType<typeof overview>["runs"][number];

	function speedChart(runs: Run[], best: number) {
		if (runs.length < 2) return `<p class="st-note">Finish one more drill to see the trend.</p>`;
		const W = chartW(), H = 200, L = 40, R = 16, T = 18, B = 26;
		const values = runs.map((r) => r.avgMs);
		const max = Math.max(...values, best) * 1.15;
		const x = (i: number) => L + (i / (values.length - 1)) * (W - L - R);
		const y = (v: number) => H - B - (v / max) * (H - B - T);
		const line = (vs: number[]) => vs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
		// A three-run average smooths out one lucky or unlucky run.
		const smooth = values.map((_, i) => values.slice(Math.max(0, i - 2), i + 1)).map((w) => w.reduce((a, b) => a + b, 0) / w.length);
		const grid = [0.25, 0.5, 0.75].map((f) => max * f);
		const last = values[values.length - 1];
		return `<svg viewBox="0 0 ${W} ${H}" class="st-chart" role="img" aria-label="Average seconds per cue for each recent run. Latest ${secs(last)}.">
			${grid.map((g) => `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="st-gridline" /><text x="${L - 8}" y="${y(g) + 4}" text-anchor="end" class="st-tick">${(g / 1000).toFixed(g < 10000 ? 1 : 0)}s</text>`).join("")}
			<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="st-axis" />
			${best ? `<line x1="${L}" x2="${W - R}" y1="${y(best)}" y2="${y(best)}" class="st-bestline" /><text x="${W - R}" y="${y(best) - 6}" text-anchor="end" class="st-tick">best ${secs(best)}</text>` : ""}
			<polygon points="${x(0)},${H - B} ${line(values)} ${x(values.length - 1)},${H - B}" class="st-area" />
			<polyline points="${line(smooth)}" class="st-smooth" />
			<polyline points="${line(values)}" class="st-line" />
			${runs.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.avgMs)}" r="${i === runs.length - 1 ? 5 : 3.5}" class="st-dot${i === runs.length - 1 ? " is-last" : ""}"><title>${when(r.at)}, ${esc(DRILLS.find((d) => d.id === r.drill)?.name ?? "")}: ${secs(r.avgMs)} a cue</title></circle>`).join("")}
			<text x="${L}" y="${H - 6}" class="st-tick">${when(runs[0].at)}</text>
			<text x="${W - R}" y="${H - 6}" text-anchor="end" class="st-tick">${when(runs[runs.length - 1].at)}</text>
		</svg>
		<p class="st-legend"><span><i class="lg-line"></i>Each run</span><span><i class="lg-smooth"></i>Three-run average</span>${best ? `<span><i class="lg-best"></i>Your best</span>` : ""}</p>`;
	}

	function accuracyChart(runs: Run[]) {
		const W = chartW(), H = 200, L = 40, R = 16, T = 12, B = 26;
		const slot = (W - L - R) / Math.max(runs.length, 8);
		const bw = Math.min(26, slot * 0.62);
		const y = (f: number) => H - B - f * (H - B - T);
		return `<svg viewBox="0 0 ${W} ${H}" class="st-chart" role="img" aria-label="Share of clean cues in each recent run.">
			${[0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${y(f)}" y2="${y(f)}" class="st-gridline" /><text x="${L - 8}" y="${y(f) + 4}" text-anchor="end" class="st-tick">${f * 100}%</text>`).join("")}
			${runs
				.map((r, i) => {
					const x = L + slot * i + (slot - bw) / 2;
					return `<rect x="${x}" y="${T}" width="${bw}" height="${H - B - T}" rx="4" class="ac-bg" /><rect x="${x}" y="${y(r.accuracy)}" width="${bw}" height="${Math.max(0, H - B - y(r.accuracy))}" rx="4" class="ac-bar${r.accuracy < 1 ? " is-short" : ""}"><title>${when(r.at)}: ${r.clean} of ${r.count} clean, ${r.wrong} wrong ${r.wrong === 1 ? "slide" : "slides"}</title></rect>`;
				})
				.join("")}
			<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" class="st-axis" />
			<text x="${L}" y="${H - 6}" class="st-tick">${when(runs[0].at)}</text>
			<text x="${W - R}" y="${H - 6}" text-anchor="end" class="st-tick">${when(runs[runs.length - 1].at)}</text>
		</svg>
		<p class="st-legend"><span><i class="lg-bar"></i>Every cue clean</span><span><i class="lg-short"></i>Something wrong went up</span></p>`;
	}

	function kindBars(kinds: ReturnType<typeof overview>["kinds"]) {
		if (!kinds.length) return `<p class="st-note">Finish a drill to see which parts take you longest.</p>`;
		const max = Math.max(...kinds.map((k) => Math.max(k.avgMs, k.firstMs)), 1);
		const slow = kinds.length > 1 ? [...kinds].sort((a, b) => b.avgMs - a.avgMs)[0] : null;
		return `<ul class="st-skills st-kinds">${kinds
			.map((k) => {
				const gain = k.firstMs - k.avgMs;
				const grown = k.count > 12;
				return `<li${k === slow ? ` class="is-slow"` : ""}>
					<span class="st-skill">${esc(k.name)}</span>
					<span class="st-val">${secs(k.avgMs)} · ${Math.round(k.accuracy * 100)}% clean${grown && Math.abs(gain) >= 100 ? ` · ${secs(Math.abs(gain))} ${gain > 0 ? "faster" : "slower"} than at first` : ""}${k === slow ? " · slowest" : ""}</span>
					<span class="st-bar"><i style="width:${Math.max(4, (k.avgMs / max) * 100)}%"></i>${grown ? `<b style="left:${(k.firstMs / max) * 100}%" title="When you started: ${secs(k.firstMs)}"></b>` : ""}</span>
				</li>`;
			})
			.join("")}</ul>
		<p class="st-legend"><span><i class="lg-bar"></i>Latest 12</span><span><i class="lg-tick"></i>Your first 12</span></p>`;
	}

	function heatmap(days: ReturnType<typeof overview>["activity"]) {
		const C = 15, G = 4, L = 32, T = 4;
		const weeks = days.length / 7;
		const W = L + weeks * (C + G), H = T + 7 * (C + G) + 18;
		const level = (n: number) => (n === 0 ? 0 : n <= 6 ? 1 : n <= 12 ? 2 : n <= 24 ? 3 : 4);
		const date = (t: number) => new Date(t).toLocaleDateString([], { day: "numeric", month: "short", timeZone: "UTC" });
		const total = days.reduce((a, d) => a + d.cues, 0);
		const active = days.filter((d) => d.cues).length;
		return `<svg viewBox="0 0 ${W} ${H}" class="st-chart st-heat" role="img" aria-label="${total} cues on ${active} days in the last ${weeks} weeks.">
			${["Mon", "Wed", "Fri"].map((d, i) => `<text x="0" y="${T + i * 2 * (C + G) + 12}" class="st-tick">${d}</text>`).join("")}
			${days
				.map((d, i) => (d.future ? "" : `<rect x="${L + Math.floor(i / 7) * (C + G)}" y="${T + (i % 7) * (C + G)}" width="${C}" height="${C}" rx="3" class="hm-${level(d.cues)}"><title>${date(d.at)}: ${d.cues} ${d.cues === 1 ? "cue" : "cues"}</title></rect>`))
				.join("")}
			<text x="${L}" y="${H - 2}" class="st-tick">${date(days[0].at)}</text>
			<text x="${W - G}" y="${H - 2}" text-anchor="end" class="st-tick">This week</text>
		</svg>
		<p class="st-legend"><span>${total} ${total === 1 ? "cue" : "cues"} on ${active} ${active === 1 ? "day" : "days"}</span><span class="hm-scale">Less<i class="hm-0"></i><i class="hm-1"></i><i class="hm-2"></i><i class="hm-3"></i><i class="hm-4"></i>More</span></p>`;
	}

	/* ── Helpers ────────────────────────────────────────────────────────── */
	// Scroll a list so its row shows, without moving the page.
	function keepInView(list: HTMLElement, row: Element | null) {
		if (!row) return;
		const r = row as HTMLElement;
		const top = r.offsetTop - list.offsetTop;
		if (top < list.scrollTop) list.scrollTop = top - 8;
		else if (top + r.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + r.offsetHeight - list.clientHeight + 8;
	}

	function setZone(z: Zone | null) {
		s.zone = z;
		$$("[data-zone]").forEach((n) => n.classList.toggle("is-zone", n.dataset.zone === z));
	}

	function setView(v: Zone) {
		s.view = v;
		el.console.dataset.show = v;
		el.views.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
		setZone(v);
	}

	/* ── Wiring ─────────────────────────────────────────────────────────── */
	el.q.addEventListener("input", () => {
		clearTimeout(searchTimer);
		searchTimer = window.setTimeout(() => runScripture(), 110);
	});
	el.q.addEventListener("focus", () => setZone("library"));
	el.sq.addEventListener("input", () => {
		s.songSel = 0;
		drawSongs();
		loadPreview(songItem(0));
	});
	el.sq.addEventListener("focus", () => setZone("library"));

	el.trans.forEach((b) =>
		b.addEventListener("click", async () => {
			s.trans = b.dataset.trans as TranslationId;
			el.trans.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
			tally("click");
			const again = twice(`trans:${b.dataset.trans}`);
			await runScripture(true);
			if (again && s.sel >= 0) sendFromLibrary("click");
		}),
	);

	el.libTabs.forEach((b) => b.addEventListener("click", () => setTab(b.dataset.libTab as "scripture" | "songs")));
	el.views.forEach((b) => b.addEventListener("click", () => setView(b.dataset.view as Zone)));

	// A second click on the same row soon after the first sends it live. The
	// first click redraws the list, so the browser's own double-click never
	// fires on the new row.
	let lastClick = { key: "", at: 0 };
	const twice = (key: string) => {
		const now = performance.now();
		const hit = lastClick.key === key && now - lastClick.at < 450;
		lastClick = hit ? { key: "", at: 0 } : { key, at: now };
		return hit;
	};

	root.addEventListener("click", (e) => {
		const t = e.target as HTMLElement;
		const hit = <T extends HTMLElement>(sel: string) => t.closest<T>(sel);
		let n: HTMLElement | null;
		if ((n = hit("[data-try]"))) {
			el.q.value = n.dataset.try!;
			runScripture();
			el.q.focus();
		} else if ((n = hit("[data-row]"))) {
			tally("click");
			pickRow(+n.dataset.row!);
			setZone("library");
			if (twice(`row:${n.dataset.row}`)) sendFromLibrary("click");
		} else if ((n = hit("[data-song]"))) {
			tally("click");
			pickSong(+n.dataset.song!);
			setZone("library");
			if (twice(`song:${n.dataset.song}`)) sendFromLibrary("click");
		} else if ((n = hit("[data-pslide]"))) {
			tally("click");
			s.preview.sel = +n.dataset.pslide!;
			drawPreview();
			if (twice(`pslide:${n.dataset.pslide}`)) sendPreview("click");
		} else if ((n = hit("[data-lslide]"))) {
			const i = +n.dataset.lslide!;
			if (s.live.item && i !== s.live.sel) goLive(s.live.item, i, "click");
		} else if (hit("[data-act='golive']")) {
			sendPreview("click");
		} else if (hit("[data-act='clear']")) toggleClear("click");
		else if (hit("[data-act='logo']")) toggleLogo("click");
		else if (hit("[data-act='prev']")) moveLive(-1, "click");
		else if (hit("[data-act='next']")) moveLive(1, "click");
		else if (hit("[data-act='full']")) setFull(!isFull());
		else if ((n = hit("[data-drill]"))) startDrill(n.dataset.drill!);
		else if (hit("[data-open-drills]")) openDrills();
		else if (hit("[data-close-overlay]")) {
			closeOverlay();
			if (hit("[data-to-progress]") && isFull()) setFull(false);
		}
		else if (hit("[data-show-hint]")) showHint();
		else if (hit("[data-stop]")) stopDrill();
	});

	el.stats?.addEventListener("click", (e) => {
		const f = (e.target as HTMLElement).closest<HTMLElement>("[data-st-drill]");
		if (f) {
			statsDrill = f.dataset.stDrill!;
			return drawStats();
		}
		if ((e.target as HTMLElement).closest("[data-sign-out]")) return void signOut();
		if ((e.target as HTMLElement).closest("[data-forget]")) {
			if (confirm("Delete the progress saved to your email? Your runs stay in this browser.")) signOut(true);
			return;
		}
		if (!(e.target as HTMLElement).closest("[data-reset]")) return;
		const where = syncState().email ? "in this browser and saved to your email" : "in this browser";
		if (!confirm(`Clear every drill result ${where}?`)) return;
		clearSessions();
		cleared();
		drawStats([]);
	});

	el.stats?.addEventListener("submit", async (e) => {
		const form = (e.target as HTMLElement).closest<HTMLFormElement>("[data-save]");
		if (!form) return;
		e.preventDefault();
		const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
		linkSent = "sending";
		drawStats();
		linkSent = await requestLink(email);
		drawStats();
		// Keep what they typed when it needs fixing.
		const input = el.stats!.querySelector<HTMLInputElement>("#save-email");
		if (input && linkSent !== "sent") {
			input.value = email;
			input.focus();
		}
	});

	// The arrow keys and Enter act on the panel clicked last.
	document.addEventListener("pointerdown", (e) => {
		const t = e.target as HTMLElement;
		const z = t.closest<HTMLElement>("[data-zone]");
		if (z && root.contains(z)) setZone(z.dataset.zone as Zone);
		else if (!t.closest("[data-console], [data-coach]")) setZone(null);
	});

	document.addEventListener("keydown", (e) => {
		const t = e.target as HTMLElement;
		const inOurSearch = t === el.q || t === el.sq;
		const typingElsewhere = !inOurSearch && t.closest("input, textarea, select, [contenteditable]");
		if (typingElsewhere) return;
		if (!inOurSearch && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "f") {
			e.preventDefault();
			return setFull(!isFull());
		}
		// Without the browser's full screen, Escape is ours to leave with.
		if (e.key === "Escape" && isFull() && !document.fullscreenElement && el.overlay.hidden) return setFull(false);
		if (!el.overlay.hidden) {
			if (e.key === "Escape") closeOverlay();
			return;
		}
		const ctrl = e.ctrlKey || e.metaKey;
		const k = e.key.toLowerCase();

		// Clear and Logo work from anywhere in the console, like the app.
		if (s.zone || inOurSearch) {
			const selected = (window.getSelection()?.toString() ?? "") !== "" || (inOurSearch && (t as HTMLInputElement).selectionStart !== (t as HTMLInputElement).selectionEnd);
			if (ctrl && (k === "." || (k === "c" && !selected))) {
				e.preventDefault();
				return toggleClear("keys");
			}
			if (ctrl && k === "l") {
				e.preventDefault();
				return toggleLogo("keys");
			}
		}
		if (!s.zone || ctrl || e.altKey) return;

		const zone = inOurSearch ? "library" : s.zone;
		if (e.key === "ArrowDown" || e.key === "ArrowUp") {
			e.preventDefault();
			const by = e.key === "ArrowDown" ? 1 : -1;
			if (zone === "live") return moveLive(by, "keys");
			tally("keys");
			if (zone === "library") s.tab === "scripture" ? pickRow(s.sel + by) : pickSong(s.songSel + by);
			else if (zone === "preview" && s.preview.item) {
				s.preview.sel = Math.min(s.preview.item.slides.length - 1, Math.max(0, s.preview.sel + by));
				drawPreview();
			}
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (zone === "library") sendFromLibrary("keys");
			else if (zone === "preview") sendPreview("keys");
		} else if (e.key === "/" && !inOurSearch) {
			e.preventDefault();
			setTab("scripture");
			el.q.focus();
		}
	});

	/* ── Start ──────────────────────────────────────────────────────────── */
	setTab("scripture");
	setView("library");
	setZone(null);
	drawRows();
	drawPreview();
	drawLive();
	drawButtons();
	drawCoach();
	drawStats();
	startSync((all) => drawStats(all));
	loadTranslation("KJV").then(() => el.q.value.trim() && runScripture(true), () => {});
	if (new URLSearchParams(location.search).has("drill")) startDrill(new URLSearchParams(location.search).get("drill")!);
	else openDrills(false);
}
