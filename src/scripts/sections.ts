// Scroll scenes for the longer sections. motion.ts calls these in page
// order, after the reel, so pins further down measure the space above them.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

/* A Sunday: pinned while the service runs through its steps. Each step
   wipes its slide onto the screen from the right, like a cut to live. */
export function setupSunday(mm: gsap.MatchMedia) {
	const section = $("[data-sunday]");
	if (!section) return;
	const steps = $$(".step", section);
	const frames = $$(".sunday-frame", section);
	const time = $("[data-sunday-time]", section)!;
	const times = steps.map((s) => $(".step-time", s)!.textContent!);
	const bar = $("[data-sunday-bar]", section)!;
	const head = $("[data-sunday-head]", section)!;
	const stops = $$("[data-sunday-stop]", section);
	let current = -1;

	const show = (i: number) => {
		if (i === current) return;
		const prev = current;
		current = i;
		steps.forEach((s, k) => s.classList.toggle("is-on", k === i));
		time.textContent = times[i];
		gsap.fromTo(time, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "expo.out" });
		frames.forEach((f, k) => {
			if (k === i) {
				gsap.set(f, { zIndex: 1 });
				gsap.fromTo(
					f,
					{ opacity: 1, clipPath: k > prev ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" },
					{ clipPath: "inset(0 0% 0 0%)", duration: 0.8, ease: "expo.inOut" },
				);
				gsap.fromTo($("img", f), { scale: 1.08 }, { scale: 1, duration: 1.2, ease: "expo.out" });
			} else {
				gsap.set(f, { zIndex: 0 });
				if (k === prev) gsap.to(f, { opacity: 0, duration: 0.3, delay: 0.6 });
				else gsap.set(f, { opacity: 0 });
			}
		});
	};

	mm.add("(min-width: 901px)", () => {
		show(0);
		const per = () => innerHeight * 0.55;
		ScrollTrigger.create({
			trigger: section,
			pin: ".sunday-pin",
			start: "top top",
			end: () => "+=" + per() * steps.length,
			scrub: true,
			invalidateOnRefresh: true,
			refreshPriority: 1,
			onUpdate: (self) => {
				show(Math.min(steps.length - 1, Math.floor(self.progress * steps.length)));
				gsap.set(bar, { scaleX: self.progress });
				gsap.set(head, { left: `${self.progress * 100}%` });
				stops.forEach((s, k) => s.classList.toggle("is-on", self.progress >= k / stops.length));
			},
		});
		return () => {
			current = -1;
		};
	});

	// Small screens: no pin, every step reads open and the screen shows
	// whichever step is nearest the middle of the viewport.
	mm.add("(max-width: 900px)", () => {
		section.classList.add("is-static");
		show(0);
		steps.forEach((s, i) => ScrollTrigger.create({ trigger: s, start: "top 60%", end: "bottom 60%", onToggle: (self) => self.isActive && show(i) }));
		return () => section.classList.remove("is-static");
	});
}

/* Coming from EasyWorship: songs leave the old library and land in Crater,
   tied to the scroll so the reader moves the import along. */
export function setupSwitch() {
	const root = $("[data-switch]");
	if (!root) return;
	const from = $$("[data-from]", root);
	const to = $$("[data-to]", root);
	const pct = $("[data-switch-pct]", root)!;
	const o = { p: 0 };
	gsap.set(to, { opacity: 0, x: -24 });
	const tl = gsap.timeline({
		defaults: { ease: "none" },
		scrollTrigger: { trigger: $(".switch-demo", root)!, start: "top 75%", end: "bottom 45%", scrub: 0.6 },
	});
	from.forEach((el, i) => {
		const at = i * 0.5;
		tl.to(el, { x: 24, opacity: 0.25, duration: 0.6 }, at).to(to[i], { x: 0, opacity: 1, duration: 0.6 }, at + 0.3);
	});
	const total = tl.duration();
	tl.to("[data-switch-bar]", { scaleX: 1, duration: total }, 0).to(
		o,
		{ p: 100, duration: total, onUpdate: () => (pct.textContent = `${Math.round(o.p)}%`) },
		0,
	);
}

/* One laptop, every screen: the cables draw out from the laptop and each
   screen pops on as its cable arrives. Tied to the scroll, so a fast
   scroll never lands on an empty map. Signal pulses flow once it is whole. */
export function setupScreens() {
	const root = $("[data-screens]");
	if (!root) return;
	const lines = $$(".ml", root);
	const outs = $$("[data-out]", root);
	const hub = $("[data-hub]", root)!;
	gsap.set(lines, { strokeDasharray: 1, strokeDashoffset: 1 });
	gsap.set(outs, { opacity: 0, scale: 0.85, y: 20 });
	gsap.set(hub, { opacity: 0, scale: 0.9 });
	const tl = gsap.timeline({
		scrollTrigger: {
			trigger: $(".map", root)!,
			start: "top 85%",
			end: "center 60%",
			scrub: 0.6,
			onUpdate: (self) => root.classList.toggle("is-live", self.progress > 0.98),
		},
	});
	tl.to(hub, { opacity: 1, scale: 1, duration: 0.9, ease: "power2.out" })
		// pathLength is 1, so the offset runs 1 to 0. GSAP rounds pixel values
		// unless told not to, which snapped the whole line in at once.
		.to(lines, { strokeDashoffset: 0, autoRound: false, duration: 1.1, stagger: 0.12, ease: "power1.inOut" }, 0.35)
		.to(outs, { opacity: 1, scale: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "back.out(1.4)" }, 1.0);
}

/* Themes: scrolling walks the slide through every theme. On desktop the
   section pins while it does, on phones it steps as the section passes.
   Clicking a swatch jumps to it, and the next scroll step moves on from
   there. The slide also leans back and settles as it scrolls in. */
export function setupThemes(mm: gsap.MatchMedia) {
	const root = $("[data-themes]");
	if (!root) return;
	const grid = $(".themes-grid", root)!;
	const slide = $("[data-slide]", root)!;
	const layers = [$(".slide-bg-a", slide)!, $(".slide-bg-b", slide)!];
	const name = $("[data-theme-name]", root)!;
	const swatches = $$<HTMLButtonElement>(".swatch", root);
	let front = 0;
	let current = 0;
	let step = 0;

	// Both background layers stay mounted and crossfade by opacity, so the
	// mesh gradient never snaps from one theme to the next.
	const read = (el: HTMLElement, v: string) => el.style.getPropertyValue(v).trim();
	const apply = (i: number) => {
		if (i === current) return;
		current = i;
		const sw = swatches[i];
		swatches.forEach((s, k) => s.setAttribute("aria-pressed", String(k === i)));
		for (const v of ["--t-text", "--t-accent", "--t-muted"]) slide.style.setProperty(v, read(sw, v));
		const back = layers[1 - front];
		["a", "b", "c", "d"].forEach((c, k) => back.style.setProperty(`--b${k + 1}`, read(sw, `--t-${c}`)));
		back.style.opacity = "1";
		layers[front].style.opacity = "0";
		front = 1 - front;
		name.textContent = $(".sw-name", sw)!.textContent;
		gsap.fromTo(name, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "expo.out" });
	};

	swatches.forEach((sw, i) => sw.addEventListener("click", () => apply(i)));

	// Only a change of scroll step moves the theme, so a swatch the visitor
	// clicked stays put until they scroll on.
	const onUpdate = (self: ScrollTrigger) => {
		const next = Math.min(swatches.length - 1, Math.floor(self.progress * swatches.length));
		if (next !== step) {
			step = next;
			apply(next);
		}
	};
	mm.add("(min-width: 901px)", () => {
		ScrollTrigger.create({
			trigger: grid,
			start: "center center",
			end: () => `+=${window.innerHeight * 0.3 * swatches.length}`,
			pin: true,
			onUpdate,
		});
	});
	mm.add("(max-width: 900px)", () => {
		ScrollTrigger.create({ trigger: slide, start: "top 80%", end: "bottom 20%", onUpdate });
	});

	gsap.fromTo(
		slide,
		{ rotateX: 18, rotateY: -14, scale: 0.92 },
		{ rotateX: 0, rotateY: 0, scale: 1, ease: "none", scrollTrigger: { trigger: slide, start: "top 95%", end: "center 55%", scrub: 0.6 } },
	);
	gsap.set(swatches, { opacity: 0 });
	ScrollTrigger.batch(swatches, {
		start: "top 92%",
		once: true,
		onEnter: (els) => gsap.fromTo(els, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: "expo.out" }),
	});
}

/* Keyboard first: a short script of real shortcuts, pressed in turn, with
   the little projector answering each one. Loops while it is visible.
   Clicking a shortcut in the list takes over: the loop stops, that key is
   pressed on the demo, and the loop comes back after a quiet spell. */
export function setupKeys() {
	const root = $("[data-keys]");
	if (!root) return;
	const state = (k: string) => $(`[data-k="${k}"]`, root)!;
	const key = (k: string) => $(`[data-key="${k}"]`, root);
	const typed = $("[data-k-typed]", root)!;
	const cap = $("[data-k-cap]", root)!;
	const states = $$(".kstate", root);
	const keycaps = $$(".kkey", root);
	const video = state("video");
	const vidIcon = $("[data-k-vid-icon]", root)!;
	gsap.set(states, { opacity: 0 });

	let shown: string | null = "v16";
	const DOWN = "↓";
	const UP = "↑";
	// Keys that are not on the little board still show in the caption.
	const down = (keys: string[]) => {
		const els = keys.map(key).filter((e): e is HTMLElement => !!e);
		els.forEach((e) => e.classList.add("is-down"));
		gsap.delayedCall(0.35, () => els.forEach((e) => e.classList.remove("is-down")));
	};
	const press = (tl: gsap.core.Timeline, keys: string[], label: string, at: number) => {
		tl.call(() => down(keys), [], at)
			.call(() => (cap.textContent = label), [], at)
			.fromTo(cap, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, at);
	};
	const swap = (tl: gsap.core.Timeline, k: string | null, at: number) => {
		tl.call(() => (shown = k), [], at);
		tl.to(states, { opacity: 0, duration: 0.25 }, at);
		if (k) tl.fromTo(state(k), { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.5, ease: "expo.out" }, at + 0.1);
	};

	const tl = gsap.timeline({ repeat: -1, paused: true, repeatDelay: 0.2 });
	tl.call(() => (typed.textContent = ""), [], 0);
	press(tl, ["Ctrl", "K"], "Ctrl K  search everything", 0.3);
	swap(tl, "search", 0.35);
	const q = "jn 3 16";
	for (let i = 0; i < q.length; i++) tl.call(() => (typed.textContent = q.slice(0, i + 1)), [], 0.9 + i * 0.09);
	press(tl, ["Enter"], "Enter  send it live", 2.1);
	swap(tl, "v16", 2.15);
	press(tl, [DOWN], `${DOWN}  next verse`, 4.0);
	swap(tl, "v17", 4.05);
	press(tl, ["Ctrl", "L"], "Ctrl L  logo on", 5.9);
	swap(tl, "logo", 5.95);
	press(tl, ["Ctrl", "C"], "Ctrl C  clear the screen", 7.6);
	swap(tl, null, 7.65);
	tl.to(cap, { opacity: 0, duration: 0.3 }, 8.4);
	// The screen waits on John 3:16 rather than blank until the loop starts.
	// This comes after the loop because its fromTo tweens render their start
	// values as soon as they are built, which would hide the verse again.
	gsap.set(state("v16"), { opacity: 1 });

	/* ── Hands-on mode ─────────────────────────────────────────────── */
	let manual = false;
	let inView = false;
	let underLogo: string | null = null;
	let underHelp: string | null = null;
	let paused = false;
	let step: gsap.core.Timeline | null = null;
	let idle: gsap.core.Tween | null = null;
	const rows = $$<HTMLButtonElement>("[data-k-act]", root);

	const resume = () => {
		manual = false;
		rows.forEach((r) => r.classList.remove("is-now"));
		step?.kill();
		gsap.to([...states, cap], { opacity: 0, duration: 0.4, overwrite: true });
		gsap.delayedCall(0.5, () => {
			if (!manual && inView) tl.restart();
		});
	};
	const act = (keys: string[], label: string, k: string | null, extra?: (s: gsap.core.Timeline) => void) => {
		tl.pause();
		step?.kill();
		manual = true;
		step = gsap.timeline();
		press(step, keys, label, 0);
		// Pausing the video keeps the same picture, so it does not fade.
		if (k !== shown) swap(step, k, 0.05);
		extra?.(step);
		idle?.kill();
		idle = gsap.delayedCall(9, resume);
	};

	const actions: Record<string, () => void> = {
		live: () => act(["Enter"], "Enter  send it live", "v16"),
		step: () => {
			if (shown === "v16") act([DOWN], `${DOWN}  next verse`, "v17");
			else if (shown === "v17") act([UP], `${UP}  previous verse`, "v16");
			else if (shown === "verse") act([DOWN], `${DOWN}  next slide`, "chorus");
			else if (shown === "chorus") act([UP], `${UP}  previous slide`, "verse");
			else act([DOWN], `${DOWN}  next slide`, "v16");
		},
		chorus: () => {
			if (shown === "chorus") act(["PgUp"], "PgUp  back to the verse", "verse");
			else act(["PgDn"], "PgDn  jump to the chorus", "chorus");
		},
		search: () =>
			act(["Ctrl", "K"], "Ctrl K  search everything", "search", (s) => {
				s.call(() => (typed.textContent = ""), [], 0);
				for (let i = 0; i < q.length; i++) s.call(() => (typed.textContent = q.slice(0, i + 1)), [], 0.5 + i * 0.09);
			}),
		logo: () => {
			if (shown === "logo") return act(["Ctrl", "L"], "Ctrl L  logo off", underLogo);
			underLogo = shown;
			act(["Ctrl", "L"], "Ctrl L  logo on", "logo");
		},
		clear: () => act(["Ctrl", "C"], "Ctrl C  clear the text", null),
		video: () => {
			const fresh = shown !== "video";
			paused = fresh ? false : !paused;
			video.classList.toggle("is-paused", paused);
			act(["Ctrl", "P"], paused ? "Ctrl P  pause the video" : "Ctrl P  play the video", "video", (s) =>
				// Paused holds the badge up, as a player does. Playing flashes it away.
				paused
					? s.fromTo(vidIcon, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(2)" }, 0.1)
					: s.fromTo(vidIcon, { opacity: 1, scale: 1 }, { opacity: 0, scale: 1.15, duration: 0.8, ease: "power2.out" }, 0.1),
			);
		},
		help: () => {
			if (shown === "help") return act(["F1"], "F1  close the list", underHelp);
			underHelp = shown;
			act(["F1"], "F1  every shortcut", "help");
		},
	};
	rows.forEach((r) =>
		r.addEventListener("click", () => {
			rows.forEach((o) => o.classList.toggle("is-now", o === r));
			actions[r.dataset.kAct!]?.();
		}),
	);
	root.classList.add("is-live");

	ScrollTrigger.create({
		trigger: $(".kdemo", root)!,
		start: "top 85%",
		end: "bottom top",
		onToggle: (self) => {
			inView = self.isActive;
			if (manual) return;
			if (self.isActive) tl.play();
			else tl.pause();
		},
	});
	gsap.set(keycaps, { opacity: 0, transformPerspective: 400 });
	ScrollTrigger.batch(keycaps, {
		start: "top 95%",
		once: true,
		onEnter: (els) =>
			gsap.fromTo(els, { y: 30, rotateX: -60, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 0.9, stagger: 0.05, ease: "back.out(1.8)", clearProps: "transform" }),
	});
}

/* Feature requests: the form types itself out with the scroll, picks the
   part of Crater it is about, then the send button presses and confirms. */
export function setupRequest() {
	const root = $("[data-request]");
	if (!root) return;
	const typed = $("[data-rq-typed]", root)!;
	const text = typed.textContent ?? "";
	const chip = $('[data-rq-chip="Songs"]', root)!;
	const send = $("[data-rq-send]", root)!;
	const sent = $("[data-rq-sent]", root)!;
	const o = { n: 0 };
	typed.textContent = "";
	gsap.set(sent, { x: 10 });
	// The chip and the button state follow the timeline's own progress, so
	// they also undo cleanly when the visitor scrolls back up.
	const tl = gsap.timeline({
		scrollTrigger: { trigger: $(".rq", root)!, start: "top 80%", end: "bottom 45%", scrub: 0.5 },
		onUpdate: () => {
			chip.classList.toggle("is-on", tl.time() > 3.2);
			send.classList.toggle("is-ready", tl.time() > 3.6);
		},
	});
	tl.to(o, { n: text.length, duration: 3, ease: "none", onUpdate: () => (typed.textContent = text.slice(0, Math.round(o.n))) })
		.to(send, { scale: 0.95, duration: 0.15 }, 4)
		.to(send, { scale: 1, duration: 0.15 })
		.to(sent, { opacity: 1, x: 0, duration: 0.4, ease: "power2.out" }, 4.2);
}

/* Open source: the commit graph draws itself, and the release timeline
   fills down the page, lighting each release as the line reaches it. */
export function setupOpen() {
	const root = $("[data-open]");
	if (!root) return;
	const paths = $$(".og", root);
	const nodes = $$(".on", root);
	gsap.set(paths, { strokeDasharray: 1, strokeDashoffset: 1 });
	gsap.set(nodes, { scale: 0, transformOrigin: "50% 50%" });
	gsap
		.timeline({ scrollTrigger: { trigger: $(".open-graph", root)!, start: "top 85%", once: true } })
		.to(paths, { strokeDashoffset: 0, autoRound: false, duration: 1.4, stagger: 0.25, ease: "power2.inOut" })
		.to(nodes, { scale: 1, duration: 0.5, stagger: 0.08, ease: "back.out(2.4)" }, 0.3);

	const cl = $("[data-cl]", root)!;
	gsap.to($("[data-cl-fill]", root), { scaleY: 1, ease: "none", scrollTrigger: { trigger: cl, start: "top 70%", end: "bottom 60%", scrub: 0.5 } });
	$$("[data-cl-item]", root).forEach((it) => {
		gsap.fromTo(it, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: "expo.out", scrollTrigger: { trigger: it, start: "top 88%", once: true } });
		ScrollTrigger.create({ trigger: it, start: "top 65%", onEnter: () => it.classList.add("is-on"), onLeaveBack: () => it.classList.remove("is-on") });
	});
}

/* Small details used all over the page. */
export function setupMicro(finePointer: boolean) {
	// Reading progress along the top edge.
	gsap.to(".progress", { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

	// Eyebrows: the letters close up from a wide spacing as they arrive.
	$$(".eyebrow").forEach((el) =>
		gsap.from(el, { letterSpacing: "0.42em", duration: 1.2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }),
	);

	if (!finePointer) return;

	// The hero glow leans toward the pointer.
	const sun = $(".hero .sun");
	const hero = $(".hero");
	if (sun && hero) {
		const sx = gsap.quickTo(sun, "x", { duration: 1.6, ease: "power3.out" });
		hero.addEventListener("pointermove", (e) => sx((e.clientX / innerWidth - 0.5) * 160));
		hero.addEventListener("pointerleave", () => sx(0));
	}

	// Reel slides tilt toward the pointer.
	$$(".reel-frame").forEach((el) => {
		const ry = gsap.quickTo(el, "rotateY", { duration: 0.6, ease: "power3.out" });
		const rx = gsap.quickTo(el, "rotateX", { duration: 0.6, ease: "power3.out" });
		gsap.set(el, { transformPerspective: 1000 });
		el.addEventListener("pointermove", (e) => {
			const r = el.getBoundingClientRect();
			ry(((e.clientX - r.left) / r.width - 0.5) * 8);
			rx(-((e.clientY - r.top) / r.height - 0.5) * 8);
		});
		el.addEventListener("pointerleave", () => {
			rx(0);
			ry(0);
		});
	});
}

/* ── Feature cards ────────────────────────────────────────────────────────
   Tied to the scroll rather than played once: each card starts tipped back,
   low and a little small, and settles flat as it rises into view. The pair
   come in from either side, the three small ones one after another, and
   what's inside each card trails the card by a beat. */
export function setupFeatures(mm: gsap.MatchMedia) {
	const cards = $$("[data-feat]");
	if (!cards.length) return;
	mm.add({ wide: "(min-width: 1061px)", narrow: "(max-width: 1060px)" }, (ctx) => {
		const { wide } = ctx.conditions as { wide: boolean };
		let small = 0;
		cards.forEach((card, i) => {
			const isSmall = card.classList.contains("feat-sm");
			const isWide = card.classList.contains("feat-wide");
			// Side by side only when the grid is wide: the pair at 1 and 2,
			// the small cards in a row of three.
			const side = wide && !isWide && !isSmall ? (i % 2 ? -1 : 1) : 0;
			const lag = wide && isSmall ? small++ * 70 : 0;
			const st = { trigger: card, start: `top+=${lag} bottom`, end: `top+=${lag} 58%`, scrub: 0.7 };
			gsap.fromTo(
				card,
				{ y: wide ? 150 : 90, x: side * 70, rotateX: wide ? 16 : 10, rotateY: side * -6, scale: 0.92, opacity: 0, transformPerspective: 1400, transformOrigin: "50% 0%" },
				{ y: 0, x: 0, rotateX: 0, rotateY: 0, scale: 1, opacity: 1, ease: "none", scrollTrigger: st },
			);
			// The inside follows a little later, so the card reads as having depth.
			const inner = Array.from(card.children) as HTMLElement[];
			gsap.fromTo(
				inner,
				{ y: 40, opacity: 0.2 },
				{ y: 0, opacity: 1, ease: "none", stagger: 0.08, scrollTrigger: { ...st, start: `top+=${lag + 60} bottom`, end: `top+=${lag} 50%` } },
			);
		});
	});
}
