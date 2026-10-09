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
			anticipatePin: 1,
			invalidateOnRefresh: true,
			refreshPriority: 1,
			onUpdate: (self) => {
				show(Math.min(steps.length - 1, Math.floor(self.progress * steps.length)));
				gsap.set("[data-sunday-bar]", { scaleX: self.progress });
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

/* One laptop, every screen: the cables draw out from the laptop, each
   screen pops on as its cable arrives, then signal pulses keep flowing. */
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
		scrollTrigger: { trigger: $(".map", root)!, start: "top 75%", once: true },
		onComplete: () => root.classList.add("is-live"),
	});
	tl.to(hub, { opacity: 1, scale: 1, duration: 0.9, ease: "expo.out" })
		.to(lines, { strokeDashoffset: 0, duration: 1.1, stagger: 0.12, ease: "power2.inOut" }, 0.35)
		.to(outs, { opacity: 1, scale: 1, y: 0, duration: 0.9, stagger: 0.12, ease: "back.out(1.6)" }, 1.0);
}

/* Themes: hover or tap a swatch to restyle the slide. Left alone, it walks
   through the themes while it is on screen. The slide also leans back and
   settles as it scrolls in. */
export function setupThemes(finePointer: boolean) {
	const root = $("[data-themes]");
	if (!root) return;
	const slide = $("[data-slide]", root)!;
	const layers = [$(".slide-bg-a", slide)!, $(".slide-bg-b", slide)!];
	const name = $("[data-theme-name]", root)!;
	const swatches = $$<HTMLButtonElement>(".swatch", root);
	let front = 0;
	let current = 0;
	let timer = 0;
	let held = false;

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
		gsap.fromTo(name, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "expo.out" });
		gsap.fromTo($(".slide-text", slide), { y: 10, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out" });
	};

	swatches.forEach((sw, i) => {
		const pick = () => {
			held = true;
			apply(i);
		};
		sw.addEventListener("click", pick);
		if (finePointer) sw.addEventListener("pointerenter", pick);
	});
	root.addEventListener("pointerleave", () => (held = false));

	ScrollTrigger.create({
		trigger: slide,
		start: "top bottom",
		end: "bottom top",
		onToggle: (self) => {
			clearInterval(timer);
			if (self.isActive) timer = window.setInterval(() => !held && apply((current + 1) % swatches.length), 2600);
		},
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
   the little projector answering each one. Loops while it is visible. */
export function setupKeys() {
	const root = $("[data-keys]");
	if (!root) return;
	const state = (k: string) => $(`[data-k="${k}"]`, root)!;
	const key = (k: string) => $(`[data-key="${k}"]`, root)!;
	const typed = $("[data-k-typed]", root)!;
	const cap = $("[data-k-cap]", root)!;
	const states = $$(".kstate", root);
	const keycaps = $$(".kkey", root);
	gsap.set(states, { opacity: 0 });

	const press = (tl: gsap.core.Timeline, keys: string[], label: string, at: number) => {
		const els = keys.map(key);
		tl.call(() => els.forEach((e) => e.classList.add("is-down")), [], at)
			.call(() => els.forEach((e) => e.classList.remove("is-down")), [], at + 0.35)
			.call(() => (cap.textContent = label), [], at)
			.fromTo(cap, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, at);
	};
	const swap = (tl: gsap.core.Timeline, k: string | null, at: number) => {
		tl.to(states, { opacity: 0, duration: 0.25 }, at);
		if (k) tl.fromTo(state(k), { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.5, ease: "expo.out" }, at + 0.1);
	};

	const DOWN = "↓";
	const tl = gsap.timeline({ repeat: -1, paused: true, repeatDelay: 0.6 });
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
	tl.to(cap, { opacity: 0, duration: 0.3 }, 9.0);

	ScrollTrigger.create({
		trigger: $(".kdemo", root)!,
		start: "top 85%",
		end: "bottom top",
		onToggle: (self) => (self.isActive ? tl.play() : tl.pause()),
	});
	gsap.set(keycaps, { opacity: 0, transformPerspective: 400 });
	ScrollTrigger.batch(keycaps, {
		start: "top 95%",
		once: true,
		onEnter: (els) =>
			gsap.fromTo(els, { y: 30, rotateX: -60, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 0.9, stagger: 0.05, ease: "back.out(1.8)", clearProps: "transform" }),
	});
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
		.to(paths, { strokeDashoffset: 0, duration: 1.4, stagger: 0.25, ease: "power2.inOut" })
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

	// Eyebrows: the rule draws in, then the label decodes out of noise.
	const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	$$(".eyebrow").forEach((el) => {
		const text = el.textContent ?? "";
		ScrollTrigger.create({
			trigger: el,
			start: "top 90%",
			once: true,
			onEnter: () => {
				el.classList.add("is-in");
				const o = { p: 0 };
				gsap.to(o, {
					p: 1,
					duration: 0.9,
					delay: 0.15,
					ease: "power2.out",
					onUpdate: () => {
						const n = Math.floor(o.p * text.length);
						let rest = "";
						for (const c of text.slice(n)) rest += c === " " ? " " : glyphs[(Math.random() * glyphs.length) | 0];
						el.textContent = text.slice(0, n) + rest;
					},
					onComplete: () => {
						el.textContent = text;
					},
				});
			},
		});
	});

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
