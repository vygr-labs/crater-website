// Bible text and reference parsing for the practice console. The text comes
// from public domain translations packed as nested arrays:
// book -> chapter -> verse, in the usual Protestant order.

export const BOOKS = [
	"Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
	"1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
	"Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
	"Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi", "Matthew",
	"Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians",
	"Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter",
	"2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
];

export const TRANSLATIONS = [
	{ id: "KJV", name: "King James Version", file: "/playground/kjv.json" },
	{ id: "WEB", name: "World English Bible", file: "/playground/web.json" },
] as const;
export type TranslationId = (typeof TRANSLATIONS)[number]["id"];

type Text = string[][][];
const texts: Partial<Record<TranslationId, Text>> = {};
const loading: Partial<Record<TranslationId, Promise<Text>>> = {};

export function loadTranslation(id: TranslationId): Promise<Text> {
	if (texts[id]) return Promise.resolve(texts[id]!);
	const t = TRANSLATIONS.find((x) => x.id === id)!;
	loading[id] ??= fetch(t.file)
		.then((r) => {
			if (!r.ok) throw new Error(`${t.file} ${r.status}`);
			return r.json() as Promise<Text>;
		})
		.then((data) => (texts[id] = data))
		.catch((e) => {
			delete loading[id];
			throw e;
		});
	return loading[id]!;
}

export const hasTranslation = (id: TranslationId) => !!texts[id];

export function chapter(id: TranslationId, book: number, ch: number): string[] {
	return texts[id]?.[book]?.[ch - 1] ?? [];
}

export const chapterCount = (book: number) => texts.KJV?.[book]?.length ?? texts.WEB?.[book]?.length ?? 0;

// Short forms people actually type. Anything else falls back to the first
// book whose name starts with what was typed.
const ALIASES: Record<string, string> = {
	gen: "Genesis", gn: "Genesis", ex: "Exodus", exo: "Exodus", lev: "Leviticus", lv: "Leviticus", num: "Numbers", nm: "Numbers",
	deut: "Deuteronomy", dt: "Deuteronomy", josh: "Joshua", jos: "Joshua", judg: "Judges", jdg: "Judges", jg: "Judges", rth: "Ruth",
	ps: "Psalms", psa: "Psalms", psalm: "Psalms", pslm: "Psalms", prov: "Proverbs", pr: "Proverbs", prv: "Proverbs",
	eccl: "Ecclesiastes", ecc: "Ecclesiastes", qoh: "Ecclesiastes", song: "Song of Solomon", sos: "Song of Solomon", ss: "Song of Solomon",
	songofsongs: "Song of Solomon", canticles: "Song of Solomon", isa: "Isaiah", is: "Isaiah", jer: "Jeremiah", lam: "Lamentations",
	ezek: "Ezekiel", eze: "Ezekiel", ezk: "Ezekiel", dan: "Daniel", dn: "Daniel", hos: "Hosea", jl: "Joel", obad: "Obadiah", ob: "Obadiah",
	jon: "Jonah", jnh: "Jonah", mic: "Micah", nah: "Nahum", hab: "Habakkuk", zeph: "Zephaniah", zep: "Zephaniah", hag: "Haggai",
	zech: "Zechariah", zec: "Zechariah", mal: "Malachi", mt: "Matthew", matt: "Matthew", mk: "Mark", mrk: "Mark", lk: "Luke", luk: "Luke",
	jn: "John", jhn: "John", joh: "John", ac: "Acts", rom: "Romans", rm: "Romans", ro: "Romans", gal: "Galatians", eph: "Ephesians",
	phil: "Philippians", php: "Philippians", pp: "Philippians", col: "Colossians", phlm: "Philemon", phm: "Philemon", philem: "Philemon",
	heb: "Hebrews", jas: "James", jm: "James", jud: "Jude", jd: "Jude", rev: "Revelation", rv: "Revelation", revelations: "Revelation",
	"1sam": "1 Samuel", "1sa": "1 Samuel", "2sam": "2 Samuel", "2sa": "2 Samuel", "1kgs": "1 Kings", "1ki": "1 Kings", "2kgs": "2 Kings",
	"2ki": "2 Kings", "1chr": "1 Chronicles", "1ch": "1 Chronicles", "2chr": "2 Chronicles", "2ch": "2 Chronicles", "1cor": "1 Corinthians",
	"1co": "1 Corinthians", "2cor": "2 Corinthians", "2co": "2 Corinthians", "1thess": "1 Thessalonians", "1th": "1 Thessalonians",
	"2thess": "2 Thessalonians", "2th": "2 Thessalonians", "1tim": "1 Timothy", "1ti": "1 Timothy", "2tim": "2 Timothy", "2ti": "2 Timothy",
	"1pet": "1 Peter", "1pe": "1 Peter", "1pt": "1 Peter", "2pet": "2 Peter", "2pe": "2 Peter", "2pt": "2 Peter", "1jn": "1 John",
	"1jhn": "1 John", "2jn": "2 John", "3jn": "3 John",
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const SQUASHED = BOOKS.map(squash);

export function findBook(raw: string): number {
	let s = squash(raw.replace(/^(i{1,3})\s+/i, (m, r: string) => `${r.length} `).replace(/^(1st|2nd|3rd|first|second|third)\b/i, (m) => ({ "1st": "1", "2nd": "2", "3rd": "3", first: "1", second: "2", third: "3" })[m.toLowerCase()]!));
	if (!s) return -1;
	if (ALIASES[s]) return BOOKS.indexOf(ALIASES[s]);
	const exact = SQUASHED.indexOf(s);
	if (exact >= 0) return exact;
	return SQUASHED.findIndex((b) => b.startsWith(s));
}

// A whole book name with no numbers ("romans", "rev") opens its first
// chapter. Anything shorter or vaguer is treated as words to search for.
export const isBookName = (q: string) => {
	const s = squash(q);
	return !!ALIASES[s] || SQUASHED.includes(s);
};

export type Ref ={ book: number; chapter: number; verse: number; to: number };

// "jn 3:16", "john 3 16", "1 cor 13:4-7", "ps 23", "romans 8.28"
export function parseRef(q: string): Ref | null {
	const m = q
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ")
		.match(/^((?:[1-3]|i{1,3}|1st|2nd|3rd|first|second|third)?\s*[a-z][a-z .]*?)\s*(\d+)?(?:\s*[:. ]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/);
	if (!m) return null;
	const book = findBook(m[1]);
	if (book < 0) return null;
	const chapter = m[2] ? +m[2] : 1;
	const verse = m[3] ? +m[3] : 1;
	const to = m[4] ? Math.max(+m[4], verse) : verse;
	return { book, chapter, verse, to };
}

// One psalm is a Psalm.
export const refLabel = (book: number, ch: number, v: number, to = v) => `${BOOKS[book] === "Psalms" ? "Psalm" : BOOKS[book]} ${ch}:${v}${to > v ? `-${to}` : ""}`;
export const refKey = (book: number, ch: number, v: number) => `${book}:${ch}:${v}`;

// Every verse that holds all the words, in Bible order.
export function searchText(id: TranslationId, q: string, limit = 60) {
	const t = texts[id];
	const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
	const out: { book: number; chapter: number; verse: number; text: string }[] = [];
	if (!t || !words.length) return out;
	for (let b = 0; b < t.length && out.length < limit; b++)
		for (let c = 0; c < t[b].length && out.length < limit; c++)
			for (let v = 0; v < t[b][c].length; v++) {
				const low = t[b][c][v].toLowerCase();
				if (words.every((w) => low.includes(w))) {
					out.push({ book: b, chapter: c + 1, verse: v + 1, text: t[b][c][v] });
					if (out.length >= limit) break;
				}
			}
	return out;
}
