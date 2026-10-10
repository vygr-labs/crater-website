// The learner's own record. It lives in this browser only: there are no
// accounts, and nothing is sent anywhere.
import { KIND_NAMES, type Kind, type Skill } from "./drills";

export type CueResult = { skill: Skill; kind?: Kind; ms: number; wrong: number; keys: number; clicks: number; hinted: boolean };
export type Session = { at: number; drill: string; cues: CueResult[] };

const KEY = "crater-practice-v1";
const MAX = 200;

export function loadSessions(): Session[] {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
		return Array.isArray(raw) ? raw : [];
	} catch {
		return [];
	}
}

export function saveSession(s: Session) {
	const all = [...loadSessions(), s].slice(-MAX);
	try {
		localStorage.setItem(KEY, JSON.stringify(all));
	} catch {}
	return all;
}

export function clearSessions() {
	try {
		localStorage.removeItem(KEY);
	} catch {}
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// A run of cues boiled down to the numbers the cards and charts show.
export function summarise(cues: CueResult[]) {
	const keys = sum(cues.map((c) => c.keys));
	const clicks = sum(cues.map((c) => c.clicks));
	const times = cues.map((c) => c.ms);
	return {
		count: cues.length,
		avgMs: avg(times),
		totalMs: sum(times),
		fastMs: times.length ? Math.min(...times) : 0,
		slowMs: times.length ? Math.max(...times) : 0,
		clean: cues.filter((c) => !c.wrong).length,
		wrong: sum(cues.map((c) => c.wrong)),
		accuracy: cues.length ? cues.filter((c) => !c.wrong).length / cues.length : 0,
		keyboard: keys + clicks ? keys / (keys + clicks) : 0,
		hinted: cues.filter((c) => c.hinted).length,
	};
}
export type Summary = ReturnType<typeof summarise>;

const dayOf = (t: number) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);

// Days in a row, ending today or yesterday, and the longest run ever.
function streaks(sessions: Session[]) {
	const days = new Set(sessions.map((s) => dayOf(s.at)));
	let d = dayOf(Date.now());
	if (!days.has(d)) d--;
	let now = 0;
	while (days.has(d)) (now++, d--);
	let best = 0;
	for (const x of days) {
		if (days.has(x - 1)) continue;
		let n = 0;
		while (days.has(x + n)) n++;
		best = Math.max(best, n);
	}
	return { now, best, days: days.size };
}

// Cues per day for the last `weeks` weeks, ending with this week.
function activity(sessions: Session[], weeks = 12) {
	const counts = new Map<number, number>();
	for (const s of sessions) counts.set(dayOf(s.at), (counts.get(dayOf(s.at)) ?? 0) + s.cues.length);
	const today = dayOf(Date.now());
	// Day 0 of the epoch was a Thursday. Rows run Monday to Sunday.
	const weekday = (today + 3) % 7;
	const start = today - weekday - (weeks - 1) * 7;
	return Array.from({ length: weeks * 7 }, (_, i) => {
		const day = start + i;
		return { day, at: day * 86400000, cues: counts.get(day) ?? 0, future: day > today };
	});
}

// The first and latest dozen cues of each kind, so a learner can see how far
// they have come at each part of the job.
function byKind(cues: CueResult[]) {
	return (Object.keys(KIND_NAMES) as Kind[])
		.map((kind) => {
			const mine = cues.filter((c) => c.kind === kind);
			const recent = mine.slice(-12);
			const first = mine.slice(0, 12);
			return {
				kind,
				name: KIND_NAMES[kind],
				count: mine.length,
				avgMs: avg(recent.map((c) => c.ms)),
				firstMs: avg(first.map((c) => c.ms)),
				accuracy: recent.length ? recent.filter((c) => !c.wrong).length / recent.length : 0,
			};
		})
		.filter((k) => k.count);
}

export function overview(all: Session[], drill?: string, weeks = 12) {
	const sessions = drill ? all.filter((s) => s.drill === drill) : all;
	const cues = sessions.flatMap((s) => s.cues);
	const runs = sessions.map((s) => ({ at: s.at, drill: s.drill, ...summarise(s.cues) }));
	const best: Record<string, number> = {};
	const drills: Record<string, { runs: number; best: number; first: number; latest: number; avg: number }> = {};
	for (const r of runs) {
		if (!r.count) continue;
		const d = (drills[r.drill] ??= { runs: 0, best: Infinity, first: r.avgMs, latest: 0, avg: 0 });
		d.runs++;
		d.best = Math.min(d.best, r.avgMs);
		d.latest = r.avgMs;
		d.avg += r.avgMs;
		best[r.drill] = d.best;
	}
	for (const d of Object.values(drills)) d.avg /= d.runs;
	return {
		sessions: sessions.length,
		cues: cues.length,
		totalMs: sum(cues.map((c) => c.ms)),
		recent: summarise(cues.slice(-40)),
		// The 40 before that, so the cards can say which way things are moving.
		before: cues.length > 40 ? summarise(cues.slice(-80, -40)) : null,
		streak: streaks(all),
		kinds: byKind(cues),
		best,
		drills,
		runs: runs.slice(-30),
		activity: activity(all, weeks),
	};
}

// The last finished run of a drill and its best average, for the live
// comparison while a drill is running.
export function previous(drill: string) {
	const mine = loadSessions().filter((s) => s.drill === drill && s.cues.length);
	const last = mine[mine.length - 1];
	const best = mine.length ? Math.min(...mine.map((s) => summarise(s.cues).avgMs)) : 0;
	return { last: last?.cues ?? null, best, runs: mine.length };
}

export const secs = (ms: number) => (ms >= 60000 ? `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`);
export const span = (ms: number) => {
	const m = Math.round(ms / 60000);
	return m < 1 ? `${Math.round(ms / 1000)}s` : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
