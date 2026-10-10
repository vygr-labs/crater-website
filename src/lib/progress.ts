// Playground progress kept against an email address, so a learner's runs
// follow them to another computer. There are no passwords: a link sent to
// the address signs that browser in, and a cookie keeps it signed in.
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

const LINK_MINUTES = 30;
const MAX_SESSIONS = 200;
const MAX_CUES = 100;

let ready: Promise<void> | null = null;

function init() {
	ready ??= db()
		.batch(
			[
				`CREATE TABLE IF NOT EXISTS practice_users (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					email TEXT NOT NULL UNIQUE,
					sessions TEXT NOT NULL DEFAULT '[]',
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					updated_at TEXT NOT NULL DEFAULT (datetime('now'))
				)`,
				`CREATE TABLE IF NOT EXISTS practice_links (
					token_hash TEXT PRIMARY KEY,
					email TEXT NOT NULL,
					ip_hash TEXT NOT NULL,
					used INTEGER NOT NULL DEFAULT 0,
					created_at TEXT NOT NULL DEFAULT (datetime('now'))
				)`,
				"CREATE INDEX IF NOT EXISTS practice_links_ip ON practice_links (ip_hash, created_at)",
				"CREATE INDEX IF NOT EXISTS practice_links_email ON practice_links (email, created_at)",
				`CREATE TABLE IF NOT EXISTS practice_logins (
					token_hash TEXT PRIMARY KEY,
					user_id INTEGER NOT NULL,
					created_at TEXT NOT NULL DEFAULT (datetime('now'))
				)`,
			],
			"write",
		)
		.then(() => undefined);
	return ready;
}

// Only the hash of a token is stored, so a copy of the database can't be
// used to sign in as anyone.
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("base64url");

export const cleanEmail = (s: unknown) => String(s ?? "").trim().toLowerCase().slice(0, 200);
export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Links asked for in the last hour, from this sender and for this address. */
export async function linkCounts(ipHash: string, email: string) {
	await init();
	const r = await db().execute({
		sql: `SELECT
			SUM(ip_hash = ? AND created_at > datetime('now', '-1 hour')) AS ip,
			SUM(email = ? AND created_at > datetime('now', '-1 hour')) AS email
			FROM practice_links`,
		args: [ipHash, email],
	});
	return { ip: Number(r.rows[0]?.ip ?? 0), email: Number(r.rows[0]?.email ?? 0) };
}

export async function newLink(email: string, ipHash: string): Promise<string> {
	await init();
	const t = token();
	await db().execute({ sql: "INSERT INTO practice_links (token_hash, email, ip_hash) VALUES (?, ?, ?)", args: [hash(t), email, ipHash] });
	return t;
}

/** Spends a sign-in link. Returns a login token for the cookie, or null. */
export async function useLink(t: string): Promise<{ login: string; email: string } | null> {
	await init();
	const d = db();
	// Marking it used in the same statement that checks it means a link
	// opened twice at once still signs in only once.
	const r = await d.execute({
		sql: `UPDATE practice_links SET used = 1
			WHERE token_hash = ? AND used = 0 AND created_at > datetime('now', ?)
			RETURNING email`,
		args: [hash(t), `-${LINK_MINUTES} minutes`],
	});
	const email = r.rows[0]?.email as string | undefined;
	if (!email) return null;
	const u = await d.execute({
		sql: "INSERT INTO practice_users (email) VALUES (?) ON CONFLICT (email) DO UPDATE SET email = email RETURNING id",
		args: [email],
	});
	const login = token();
	await d.execute({ sql: "INSERT INTO practice_logins (token_hash, user_id) VALUES (?, ?)", args: [hash(login), Number(u.rows[0].id)] });
	return { login, email };
}

export type Learner = { id: number; email: string; sessions: StoredSession[] };

export async function learner(login: string | undefined): Promise<Learner | null> {
	if (!login) return null;
	await init();
	const r = await db().execute({
		sql: `SELECT u.id, u.email, u.sessions FROM practice_logins l JOIN practice_users u ON u.id = l.user_id WHERE l.token_hash = ?`,
		args: [hash(login)],
	});
	const row = r.rows[0];
	if (!row) return null;
	return { id: Number(row.id), email: String(row.email), sessions: JSON.parse(String(row.sessions)) };
}

export async function saveSessions(id: number, sessions: StoredSession[]) {
	await db().execute({
		sql: "UPDATE practice_users SET sessions = ?, updated_at = datetime('now') WHERE id = ?",
		args: [JSON.stringify(sessions), id],
	});
}

export async function signOut(login: string) {
	await init();
	await db().execute({ sql: "DELETE FROM practice_logins WHERE token_hash = ?", args: [hash(login)] });
}

/** Removes the address, its saved runs and every browser signed in with it. */
export async function forget(id: number) {
	await db().batch(
		[
			{ sql: "DELETE FROM practice_logins WHERE user_id = ?", args: [id] },
			{ sql: "DELETE FROM practice_links WHERE email = (SELECT email FROM practice_users WHERE id = ?)", args: [id] },
			{ sql: "DELETE FROM practice_users WHERE id = ?", args: [id] },
		],
		"write",
	);
}

/* ── The runs themselves ─────────────────────────────────────────────── */
type StoredCue = { skill: string; kind?: string; ms: number; wrong: number; keys: number; clicks: number; hinted: boolean };
export type StoredSession = { at: number; drill: string; cues: StoredCue[] };

const num = (v: unknown, max: number) => {
	const n = Number(v);
	return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n))) : 0;
};
const word = (v: unknown) => String(v ?? "").replace(/[^\w-]/g, "").slice(0, 40);

// Whatever the browser sends is rebuilt field by field, so nothing else
// ends up in the database.
export function cleanSessions(raw: unknown): StoredSession[] {
	if (!Array.isArray(raw)) return [];
	return raw
		.slice(-MAX_SESSIONS)
		.filter((s) => s && typeof s === "object" && Array.isArray(s.cues))
		.map((s) => ({
			at: num(s.at, 4e12),
			drill: word(s.drill),
			cues: (s.cues as unknown[]).slice(0, MAX_CUES).map((c) => {
				const x = (c ?? {}) as Record<string, unknown>;
				const cue: StoredCue = {
					skill: word(x.skill),
					ms: num(x.ms, 3_600_000),
					wrong: num(x.wrong, 1000),
					keys: num(x.keys, 10_000),
					clicks: num(x.clicks, 10_000),
					hinted: x.hinted === true,
				};
				if (x.kind) cue.kind = word(x.kind);
				return cue;
			}),
		}))
		.filter((s) => s.at && s.drill);
}

/** Every run from both lists once, oldest first, keeping the newest 200. */
export function merge(a: StoredSession[], b: StoredSession[]): StoredSession[] {
	const seen = new Map<string, StoredSession>();
	for (const s of [...a, ...b]) seen.set(`${s.at}:${s.drill}`, s);
	return [...seen.values()].sort((x, y) => x.at - y.at).slice(-MAX_SESSIONS);
}

/* ── The email ───────────────────────────────────────────────────────── */
export async function sendLink(to: string, url: string): Promise<boolean> {
	const key = process.env.RESEND_API_KEY;
	if (!key) {
		// No mail service on a local copy of the site, so the link goes to
		// the terminal instead.
		if (import.meta.env.DEV) {
			console.log(`[progress] sign-in link for ${to}: ${url}`);
			return true;
		}
		console.error("[progress] RESEND_API_KEY is not set");
		return false;
	}
	const text = [
		"Here is your link to save your Crater practice progress:",
		"",
		url,
		"",
		`It works once, for the next ${LINK_MINUTES} minutes. Open it in the browser you practise in, and your runs will be kept with this address from then on.`,
		"",
		"If you didn't ask for this, you can ignore this email. Nothing is saved until the link is opened.",
		"",
		"Crater",
		"https://getcrater.org",
	].join("\n");
	const html = `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#121416;max-width:520px">
<p>Here is your link to save your Crater practice progress.</p>
<p style="margin:28px 0"><a href="${url}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#087785;color:#fff;text-decoration:none;font-weight:600">Save my progress</a></p>
<p>It works once, for the next ${LINK_MINUTES} minutes. Open it in the browser you practise in, and your runs will be kept with this address from then on.</p>
<p style="color:#5f686c">If you didn't ask for this, you can ignore this email. Nothing is saved until the link is opened.</p>
<p style="color:#5f686c">Crater<br><a href="https://getcrater.org" style="color:#087785">getcrater.org</a></p>
</div>`;
	try {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				from: process.env.MAIL_FROM ?? "Crater <practice@getcrater.org>",
				to: [to],
				subject: "Your link to save your Crater progress",
				text,
				html,
			}),
		});
		if (!res.ok) throw new Error(`Resend said ${res.status}: ${(await res.text()).slice(0, 200)}`);
		return true;
	} catch (e) {
		console.error(`[progress] ${(e as Error).message}`);
		return false;
	}
}
