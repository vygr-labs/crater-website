// The practice drills. Each cue is something a person in the room says,
// and the cue is done when the wall shows the right thing.
import { BOOKS, refKey, refLabel } from "./bible";
import { SONGS, sectionName, type Song } from "./songs";

export type Slide = {
	key: string; // what a cue checks against: "42:3:16" or "it-is-well:C"
	label: string; // shown above the slide: "John 3:16 · KJV" or "Chorus"
	text: string;
	trans?: string;
	songId?: string;
	section?: string;
};

export type Wall = { slide: Slide | null; clear: boolean; logo: boolean };

export type Skill = "scripture" | "songs" | "screen";

// What a cue asks for, so the progress page can say where the time goes.
export type Kind = "verse" | "readon" | "translation" | "songstart" | "songpart" | "clear" | "logo";
export const KIND_NAMES: Record<Kind, string> = {
	verse: "Finding a verse",
	readon: "Reading on",
	translation: "Switching translation",
	songstart: "Starting a song",
	songpart: "Following the band",
	clear: "Clear and bring back",
	logo: "Logo up and down",
};

export type Cue = {
	skill: Skill;
	kind: Kind;
	who: string;
	say: string;
	task: string;
	hint: { keys: string; touch: string };
	done: (w: Wall) => boolean;
};

export type Drill = {
	id: string;
	name: string;
	about: string;
	startWithLogo?: boolean;
	build: () => Cue[];
};

const pick = <T,>(list: T[], n: number) => [...list].sort(() => Math.random() - 0.5).slice(0, n);
const b = (name: string) => BOOKS.indexOf(name);

// Verses a preacher is likely to read, with how they might say them.
// The verse after each one exists, so "read on" always works.
const VERSES: [string, number, number, string][] = [
	["John", 3, 16, "John chapter 3, verse 16"],
	["Romans", 8, 28, "Romans 8:28"],
	["Psalms", 23, 1, "Psalm 23, from verse 1"],
	["Philippians", 4, 13, "Philippians 4 and verse 13"],
	["Jeremiah", 29, 11, "Jeremiah 29:11"],
	["Proverbs", 3, 5, "Proverbs chapter 3, verse 5"],
	["Isaiah", 41, 10, "Isaiah 41, verse 10"],
	["Matthew", 6, 33, "Matthew 6:33"],
	["Joshua", 1, 9, "Joshua chapter 1, verse 9"],
	["Hebrews", 11, 1, "Hebrews 11:1"],
	["2 Timothy", 3, 16, "Second Timothy 3:16"],
	["Ephesians", 2, 8, "Ephesians 2, verse 8"],
	["Genesis", 1, 1, "Genesis 1:1, the very beginning"],
	["Romans", 12, 1, "Romans chapter 12, verse 1"],
	["Galatians", 5, 22, "Galatians 5:22"],
	["1 Corinthians", 13, 4, "First Corinthians 13, verse 4"],
	["Psalms", 46, 1, "Psalm 46:1"],
	["Matthew", 11, 28, "Matthew 11:28"],
	["John", 14, 1, "John 14, from verse 1"],
	["Lamentations", 3, 22, "Lamentations 3:22"],
	["1 John", 1, 9, "First John chapter 1, verse 9"],
	["Micah", 6, 8, "Micah 6:8"],
];

const OPENERS = ["Please open your Bibles to", "Turn with me to", "Our text this morning is", "Let's read", "Find with me"];

const verseCue = (book: number, ch: number, v: number, said: string, trans?: string, readOn = false): Cue => ({
	skill: "scripture",
	kind: trans ? "translation" : readOn ? "readon" : "verse",
	who: "Preacher",
	say: said,
	task: `Put ${refLabel(book, ch, v)}${trans ? ` (${trans})` : ""} on the screen.`,
	hint: {
		keys: trans
			? `Pick ${trans} above the verses, then press Enter to send it live again.`
			: `Click the Scripture search, type something like "${short(book)} ${ch}:${v}", then press Enter.`,
		touch: trans ? `Tap ${trans} above the verses, then tap Go live.` : `Search "${short(book)} ${ch}:${v}" in Scripture, then tap Go live.`,
	},
	done: (w) => !w.logo && !w.clear && w.slide?.key === refKey(book, ch, v) && (!trans || w.slide.trans === trans),
});

const short = (book: number) => BOOKS[book].replace(/^(\d) /, "$1").slice(0, 4).toLowerCase().replace(/\s/g, "");

const songStart = (s: Song): Cue => ({
	skill: "songs",
	kind: "songstart",
	who: "Worship leader",
	say: `“Let's stand and sing ${s.title}.”`,
	task: `Put the first verse of ${s.title} on the screen.`,
	hint: {
		keys: `Open the Songs tab, pick ${s.title}, then press Enter to send the first slide live.`,
		touch: `Open Songs, tap ${s.title}, then tap Go live.`,
	},
	done: (w) => !w.logo && !w.clear && w.slide?.songId === s.id && w.slide.section === "V1",
});

const songPart = (s: Song, section: string, say: string): Cue => {
	const part = section === "C" ? "the chorus" : sectionName(section).toLowerCase();
	return {
		skill: "songs",
		kind: "songpart",
		who: "Worship leader",
		say,
		task: `Show ${part} of ${s.title}.`,
		hint: {
			keys: `Click the Live panel and press Down until ${part} shows, or click it there.`,
			touch: `Open Live and tap ${part}.`,
		},
		done: (w) => !w.logo && !w.clear && w.slide?.songId === s.id && w.slide.section === section,
	};
};

const clearCue = (on: boolean, who: string, say: string): Cue => ({
	skill: "screen",
	kind: "clear",
	who,
	say,
	task: on ? "Clear the words but keep the background up." : "Bring the words back.",
	hint: { keys: "Press Ctrl + . (or the Clear button).", touch: "Tap Clear." },
	done: (w) => w.clear === on && !w.logo,
});

const logoCue = (on: boolean, who: string, say: string): Cue => ({
	skill: "screen",
	kind: "logo",
	who,
	say,
	task: on ? "Put the church logo on the screen." : "Take the logo down.",
	hint: { keys: "Press Ctrl + L (or the Logo button).", touch: "Tap Logo." },
	done: (w) => w.logo === on,
});

function verseSet(n: number) {
	return pick(VERSES, n).map(([book, ch, v, said]) => ({ book: b(book), ch, v, said: `“${pick(OPENERS, 1)[0]} ${said}.”` }));
}

const withChorus = () => SONGS.filter((s) => s.order.includes("C"));

export const DRILLS: Drill[] = [
	{
		id: "scripture",
		name: "Scripture",
		about: "Find what the preacher reads, keep up as they read on, and switch translations.",
		build() {
			const [a, c, d] = verseSet(3);
			return [
				verseCue(a.book, a.ch, a.v, a.said),
				verseCue(a.book, a.ch, a.v + 1, `“And verse ${a.v + 1} goes on…”`, undefined, true),
				verseCue(c.book, c.ch, c.v, c.said),
				verseCue(c.book, c.ch, c.v, "“Let me read that again in the World English Bible.”", "WEB"),
				verseCue(d.book, d.ch, d.v, d.said),
				clearCue(true, "Preacher", "“Let's bow our heads and pray.”"),
			];
		},
	},
	{
		id: "songs",
		name: "Songs",
		about: "Start a hymn, follow the band through verses and choruses, and clear between songs.",
		build() {
			const [s] = pick(withChorus(), 1);
			const [t] = pick(SONGS.filter((x) => x.id !== s.id), 1);
			return [
				songStart(s),
				songPart(s, "C", "The band goes into the chorus."),
				songPart(s, "V2", "“Verse two!”"),
				songPart(s, "C", "Back to the chorus."),
				clearCue(true, "Worship leader", "The leader starts talking between songs."),
				clearCue(false, "Worship leader", "“Let's sing together.”"),
				songStart(t),
			];
		},
	},
	{
		id: "service",
		name: "A whole service",
		about: "Logo, songs, prayer, the sermon readings and the close, in the order a Sunday runs.",
		startWithLogo: true,
		build() {
			const [s] = pick(withChorus(), 1);
			const [t] = pick(SONGS.filter((x) => x.id !== s.id), 1);
			const [a, c] = verseSet(2);
			return [
				logoCue(false, "Service leader", "“Good morning, church! Let's begin.”"),
				songStart(s),
				songPart(s, "C", "The band goes into the chorus."),
				songPart(s, "V2", "“Verse two!”"),
				clearCue(true, "Service leader", "“Let us pray.”"),
				clearCue(false, "Service leader", "“Amen.”"),
				verseCue(a.book, a.ch, a.v, a.said),
				verseCue(a.book, a.ch, a.v + 1, `“Verse ${a.v + 1}…”`, undefined, true),
				verseCue(c.book, c.ch, c.v, c.said),
				songStart(t),
				logoCue(true, "Service leader", "“Go in peace. God bless you.”"),
			];
		},
	},
];
