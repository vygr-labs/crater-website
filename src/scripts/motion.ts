// Motion for the landing page: smooth scrolling, the hero intro, scroll
// scenes and the small hover details. Everything here is progressive: the
// page is complete without it, and prefers-reduced-motion skips the lot
// except the theme toggle.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { setupKeys, setupMicro, setupOpen, setupRequest, setupScreens, setupSunday, setupSwitch, setupThemes } from "./sections";

gsap.registerPlugin(ScrollTrigger);

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(pointer: fine)").matches;
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

/* ── Theme toggle ────────────────────────────────────────────────────────
   The new theme spreads out from the button as a circle, using the View
   Transitions API where the browser has it. */
function setupTheme() {
	const btn = $<HTMLButtonElement>("#theme-toggle");
	if (!btn) return;
	const root = document.documentElement;
	const label = () => btn.setAttribute("aria-label", root.dataset.theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
	label();
	btn.addEventListener("click", () => {
		const next = root.dataset.theme === "dark" ? "light" : "dark";
		const apply = () => {
			root.dataset.theme = next;
			try {
				localStorage.setItem("crater-theme", next);
			} catch {}
			label();
		};
		const vt = (document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }).startViewTransition;
		if (!vt || reduce) return apply();
		const r = btn.getBoundingClientRect();
		const x = r.left + r.width / 2;
		const y = r.top + r.height / 2;
		const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
		const t = vt.call(document, apply);
		t.ready.then(() => {
			document.documentElement.animate(
				{ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
				{ duration: 700, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" },
			);
		});
	});
}

setupTheme();

if (reduce) {
	// Leave everything in its finished state.
	$$("[data-hl]").forEach((el) => el.style.setProperty("--p", "100%"));
	$$("[data-static-when-still]").forEach((el) => el.classList.add("is-static"));
} else {
	run();
}

function run() {
	/* ── Smooth scroll ─────────────────────────────────────────────────── */
	const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
	lenis.on("scroll", ScrollTrigger.update);
	gsap.ticker.add((time) => lenis.raf(time * 1000));
	gsap.ticker.lagSmoothing(0);

	$$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
		a.addEventListener("click", (e) => {
			const id = a.getAttribute("href")!;
			const target = id === "#top" ? 0 : $(id);
			if (target === null) return;
			e.preventDefault();
			lenis.scrollTo(target as HTMLElement | number, { offset: -24, duration: 1.4 });
		}),
	);

	/* ── Nav hides on the way down, returns on the way up ─────────────── */
	let lastY = 0;
	lenis.on("scroll", ({ scroll }: { scroll: number }) => {
		const down = scroll > lastY && scroll > 240;
		document.body.classList.toggle("nav-hidden", down);
		lastY = scroll;
	});

	/* ── Highlight sweep: the gold wash crosses the word ──────────────── */
	const sweep = (el: HTMLElement, delay = 0) =>
		gsap.fromTo(el, { "--p": "0%", "--s": 0 }, { "--p": "100%", "--s": 1, duration: 1.1, delay, ease: "power3.inOut" });

	/* ── Hero intro, on the home page ───────────────────────────────────── */
	if ($(".hero")) setupHero(sweep);

	/* ── Scroll reveals ────────────────────────────────────────────────── */
	ScrollTrigger.batch('[data-reveal="up"]', {
		start: "top 88%",
		once: true,
		onEnter: (els) => gsap.fromTo(els, { y: 48, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: 0.09, ease: "expo.out" }),
	});
	ScrollTrigger.batch('[data-reveal="card"]', {
		start: "top 90%",
		once: true,
		onEnter: (els) =>
			gsap.fromTo(
				els,
				{ y: 90, scale: 0.96, opacity: 0, filter: "blur(10px)" },
				{ y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: 1.4, stagger: 0.12, ease: "expo.out", clearProps: "filter" },
			),
	});
	ScrollTrigger.batch('[data-reveal="row"]', {
		start: "top 92%",
		once: true,
		onEnter: (els) => gsap.fromTo(els, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.9, stagger: 0.06, ease: "expo.out" }),
	});
	gsap.set('[data-reveal="up"], [data-reveal="card"], [data-reveal="row"]', { opacity: 0 });

	$$("[data-hl]")
		.filter((el) => !el.closest(".hero-title"))
		.forEach((el) => ScrollTrigger.create({ trigger: el, start: "top 80%", once: true, onEnter: () => sweep(el, 0.25) }));

	/* ── Counters ──────────────────────────────────────────────────────── */
	$$("[data-count]").forEach((el) => {
		const to = parseFloat(el.dataset.count!);
		const dec = parseInt(el.dataset.decimals || "0", 10);
		const o = { v: 0 };
		el.textContent = (0).toFixed(dec);
		ScrollTrigger.create({
			trigger: el,
			start: "top 90%",
			once: true,
			onEnter: () =>
				gsap.to(o, { v: to, duration: 1.8, ease: "power3.out", onUpdate: () => (el.textContent = o.v.toFixed(dec)) }),
		});
	});

	/* ── The reel: pinned, scrolls sideways ───────────────────────────── */
	const mm = gsap.matchMedia();
	mm.add("(min-width: 801px)", () => {
		const section = $("[data-reel]");
		if (!section) return;
		const track = $("[data-reel-track]")!;
		const distance = () => track.scrollWidth - innerWidth;
		const slide = gsap.to(track, {
			x: () => -distance(),
			ease: "none",
			scrollTrigger: {
				trigger: section,
				pin: ".room-pin",
				start: "top top",
				end: () => "+=" + distance(),
				scrub: 0.7,
				invalidateOnRefresh: true,
				// Pins measure first so every trigger below sees their spacers.
				refreshPriority: 2,
			},
		});
		// The scrubber under the reel: the line fills, the head rides it, and
		// each stop lights once its slide has come into view.
		const bar = $("[data-reel-bar]")!;
		const head = $("[data-reel-head]")!;
		const steps = $$("[data-reel-step]");
		const last = steps.length - 1;
		const prog = { p: 0 };
		gsap.to(prog, {
			p: 1,
			ease: "none",
			scrollTrigger: { trigger: section, start: "top top", end: () => "+=" + distance(), scrub: 0.7 },
			onUpdate: () => {
				const p = prog.p;
				gsap.set(bar, { scaleX: p });
				gsap.set(head, { left: `${p * 100}%` });
				const now = Math.round(p * last);
				steps.forEach((s, i) => {
					s.classList.toggle("is-on", p >= i / last - 0.001);
					s.classList.toggle("is-now", i === now);
				});
			},
		});
		// Each slide's picture drifts inside its frame as it crosses.
		$$(".reel-frame img").forEach((img) =>
			gsap.fromTo(
				img,
				{ xPercent: 6, scale: 1.14 },
				{ xPercent: -6, scale: 1.04, ease: "none", scrollTrigger: { trigger: img.parentElement!, containerAnimation: slide, start: "left right", end: "right left", scrub: true } },
			),
		);
	});

	/* ── Longer sections, in page order below the reel ─────────────────── */
	setupSunday(mm);
	setupScreens();
	setupThemes(mm);
	setupKeys();
	setupSwitch();
	setupOpen();
	setupRequest();
	setupMicro(finePointer);

	/* ── Feature pictures drift inside their cards ───────────────────── */
	$$("[data-parallax-box]").forEach((box) => {
		const img = $("img", box);
		if (!img) return;
		gsap.fromTo(img, { yPercent: -4 }, { yPercent: 4, ease: "none", scrollTrigger: { trigger: box, start: "top bottom", end: "bottom top", scrub: true } });
	});

	/* ── Statement: words light up as you read down ───────────────────── */
	const sw = $$("[data-scrub-words] span");
	if (sw.length)
		gsap.to(sw, {
			opacity: 1,
			stagger: 0.12,
			ease: "none",
			scrollTrigger: { trigger: "[data-scrub-words]", start: "top 78%", end: "bottom 42%", scrub: 0.5 },
		});

	/* ── Download: a second sunrise, the wordmark climbs out ──────────── */
	if ($("[data-sun-2]"))
		gsap.fromTo(
			"[data-sun-2]",
			{ yPercent: 35, scale: 0.6, opacity: 0 },
			{ yPercent: 0, scale: 1, opacity: 1, ease: "none", scrollTrigger: { trigger: "#download", start: "top 85%", end: "center center", scrub: 0.8 } },
		);
	gsap.fromTo(
		"[data-wordmark]",
		{ yPercent: 45, opacity: 0 },
		{ yPercent: 0, opacity: 1, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: 0.6 } },
	);

	/* ── Preview to live, on a loop ────────────────────────────────────── */
	setupGoLive();

	/* ── FAQ opens and closes smoothly ─────────────────────────────────── */
	$$<HTMLDetailsElement>("details").forEach((d) => {
		const summary = $("summary", d)!;
		const body = $(".faq-a", d)!;
		summary.addEventListener("click", (e) => {
			e.preventDefault();
			if (d.open) {
				gsap.to(body, { height: 0, opacity: 0, duration: 0.45, ease: "power3.inOut", onComplete: () => { d.open = false; ScrollTrigger.refresh(); } });
			} else {
				d.open = true;
				gsap.fromTo(body, { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.6, ease: "expo.out", onComplete: () => ScrollTrigger.refresh() });
			}
		});
	});

	/* ── Pointer details: spotlight, tilt, magnetic buttons ───────────── */
	if (finePointer) {
		$$("[data-spot]").forEach((el) => {
			el.addEventListener("pointermove", (e) => {
				const r = el.getBoundingClientRect();
				el.style.setProperty("--mx", `${e.clientX - r.left}px`);
				el.style.setProperty("--my", `${e.clientY - r.top}px`);
			});
		});
		$$(".platform").forEach((el) => {
			const rx = gsap.quickTo(el, "rotateX", { duration: 0.6, ease: "power3.out" });
			const ry = gsap.quickTo(el, "rotateY", { duration: 0.6, ease: "power3.out" });
			gsap.set(el, { transformPerspective: 900 });
			el.addEventListener("pointermove", (e) => {
				const r = el.getBoundingClientRect();
				ry(((e.clientX - r.left) / r.width - 0.5) * 10);
				rx(-((e.clientY - r.top) / r.height - 0.5) * 10);
			});
			el.addEventListener("pointerleave", () => {
				rx(0);
				ry(0);
			});
		});
		$$("[data-magnetic]").forEach((el) => {
			const mx = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3.out" });
			const my = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3.out" });
			el.addEventListener("pointermove", (e) => {
				const r = el.getBoundingClientRect();
				mx((e.clientX - r.left - r.width / 2) * 0.25);
				my((e.clientY - r.top - r.height / 2) * 0.35);
			});
			el.addEventListener("pointerleave", () => {
				mx(0);
				my(0);
			});
		});
	}

	// Fonts and images change heights after first layout.
	ScrollTrigger.sort();
	addEventListener("load", () => ScrollTrigger.refresh());
	document.fonts?.ready.then(() => ScrollTrigger.refresh());
}

/* The hero: the words rise, the console lies back and settles as you
   scroll, the projector floats up past it and the sun keeps rising. */
function setupHero(sweep: (el: HTMLElement, delay?: number) => gsap.core.Tween) {
	const words = $$(".hero-title .w");
	gsap.set(words, { yPercent: 110 });
	gsap.set("[data-hero-in]", { y: 24, opacity: 0 });
	gsap.set(".hero .sun", { yPercent: 30, scale: 0.6, opacity: 0 });
	gsap.set(".hero .arc", { opacity: 0, scale: 0.9 });
	gsap.set("[data-screen]", { y: 140, rotateX: 28, scale: 0.9, opacity: 0 });
	gsap.set("[data-float]", { y: 120, opacity: 0 });

	const intro = gsap.timeline({ defaults: { ease: "expo.out" }, delay: 0.15 });
	intro
		.to(".hero .sun", { yPercent: 0, scale: 1, opacity: 1, duration: 2.4, ease: "power2.out" }, 0)
		.to(".hero .arc", { opacity: 1, scale: 1, duration: 2, ease: "power2.out" }, 0.2)
		.to(".pill", { y: 0, opacity: 1, duration: 1 }, 0.1)
		.to(words, { yPercent: 0, duration: 1.3, stagger: 0.07 }, 0.2)
		.add(() => {
			const hl = $(".hero-title [data-hl]");
			if (hl) sweep(hl);
		}, 0.95)
		.to(".hero-lede, .hero-ctas, .hero-note", { y: 0, opacity: 1, duration: 1.1, stagger: 0.08 }, 0.6)
		.to("[data-screen]", { y: 0, opacity: 1, duration: 1.8 }, 0.75)
		.to("[data-float]", { y: 0, opacity: 1, duration: 1.6 }, 1.15)
		.fromTo(".screen-sheen", { backgroundPosition: "120% 0" }, { backgroundPosition: "-20% 0", duration: 1.8, ease: "power2.inOut" }, 1.3);

	// Scroll: the console lies back and settles flat, the projector floats
	// up past it, and the sun keeps rising behind.
	gsap.fromTo(
		"[data-screen]",
		{ rotateX: 28, scale: 0.9 },
		{
			rotateX: 0,
			scale: 1,
			ease: "none",
			scrollTrigger: { trigger: ".stage", start: "top 95%", end: "top 25%", scrub: 0.6 },
			immediateRender: false,
		},
	);
	gsap.to("[data-float]", {
		yPercent: -40,
		ease: "none",
		scrollTrigger: { trigger: ".stage", start: "top 60%", end: "bottom top", scrub: 0.8 },
	});
	gsap.to(".hero .sun", {
		yPercent: -18,
		scale: 1.12,
		ease: "none",
		scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
	});
}

/* The go-live card: the slide waiting in preview flies across into live,
   the next one drops into preview, and it repeats while on screen. */
function setupGoLive() {
	const card = $("[data-golive]");
	if (!card) return;
	const prevSlot = $(".gl-preview .gl-slot", card)!;
	const liveSlot = $(".gl-live .gl-slot", card)!;
	const pick = (img: HTMLImageElement) => ({ src: img.currentSrc || img.src, srcset: img.srcset });
	const a = $<HTMLImageElement>("[data-gl-a]", card)!;
	const b = $<HTMLImageElement>("[data-gl-b]", card)!;
	const live = $<HTMLImageElement>("[data-gl-live]", card)!;
	const order = [pick(live), pick(a), pick(b)];
	b.remove();
	let i = 0;
	const put = (img: HTMLImageElement, s: { src: string; srcset: string }) => {
		img.srcset = s.srcset;
		img.src = s.src;
	};

	const step = () => {
		// The flyer lives on the card, not in the slot, so the slot's
		// rounded clip doesn't cut it off on the way across.
		const flyer = a.cloneNode() as HTMLImageElement;
		const cr = card.getBoundingClientRect();
		const pr = prevSlot.getBoundingClientRect();
		const lr = liveSlot.getBoundingClientRect();
		Object.assign(flyer.style, {
			position: "absolute", left: `${pr.left - cr.left}px`, top: `${pr.top - cr.top}px`,
			width: `${pr.width}px`, height: `${pr.height}px`, inset: "auto", zIndex: "2", borderRadius: "6px",
		});
		card.appendChild(flyer);
		const tl = gsap.timeline({
			onComplete: () => {
				i = (i + 1) % order.length;
				put(live, order[i]);
				flyer.remove();
				put(a, order[(i + 1) % order.length]);
				gsap.fromTo(a, { opacity: 0, scale: 1.08 }, { opacity: 1, scale: 1, duration: 0.6, ease: "expo.out" });
			},
		});
		tl.to(prevSlot, { boxShadow: "0 0 0 4px var(--gold)", duration: 0.2, yoyo: true, repeat: 1 })
			.to(flyer, { x: lr.left - pr.left, y: lr.top - pr.top, width: lr.width, height: lr.height, duration: 0.7, ease: "expo.inOut" }, 0.15)
			.to(a, { opacity: 0, duration: 0.2 }, 0.15)
			.fromTo(liveSlot, { boxShadow: "0 0 0 2px var(--live)" }, { boxShadow: "0 0 0 6px var(--live)", duration: 0.25, yoyo: true, repeat: 1 }, 0.8);
	};

	let timer = 0;
	ScrollTrigger.create({
		trigger: card,
		start: "top bottom",
		end: "bottom top",
		onToggle: (self) => {
			clearInterval(timer);
			if (self.isActive) timer = window.setInterval(step, 3200);
		},
	});
}
