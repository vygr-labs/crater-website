// Feature requests, bug reports, the churches that asked to stay in touch,
// and the usage numbers installs chose to share, kept in Turso. Anything
// people would rather not have on a public issue, like an email address,
// lives only here.
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let ready: Promise<void> | null = null;

export function db(): Client {
	if (!client) {
		const url = process.env.TURSO_DATABASE_URL;
		// Local development writes to a file beside the project.
		client = url ? createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }) : createClient({ url: "file:reports.local.db" });
	}
	return client;
}

// The table is small and only ever grows a column at a time, so it is made
// here on first use instead of through a migration step.
function init() {
	ready ??= db()
		.batch(
			[
				`CREATE TABLE IF NOT EXISTS reports (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					kind TEXT NOT NULL,
					title TEXT NOT NULL,
					area TEXT,
					fields TEXT NOT NULL,
					name TEXT,
					email TEXT,
					ip_hash TEXT NOT NULL,
					issue_url TEXT,
					created_at TEXT NOT NULL DEFAULT (datetime('now'))
				)`,
				"CREATE INDEX IF NOT EXISTS reports_ip_time ON reports (ip_hash, created_at)",
				// One row per email address. Sending the form again updates it.
				`CREATE TABLE IF NOT EXISTS contacts (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					email TEXT NOT NULL UNIQUE COLLATE NOCASE,
					name TEXT,
					church TEXT,
					role TEXT,
					size TEXT,
					city TEXT,
					country TEXT,
					phone TEXT,
					ip_country TEXT,
					ip_hash TEXT NOT NULL,
					created_at TEXT NOT NULL DEFAULT (datetime('now')),
					updated_at TEXT NOT NULL DEFAULT (datetime('now'))
				)`,
				"CREATE INDEX IF NOT EXISTS contacts_ip_time ON contacts (ip_hash, updated_at)",
				// Installs that switched on "Share anonymous usage". The id is a
				// random one the app made, tied to nothing else.
				`CREATE TABLE IF NOT EXISTS installs (
					id TEXT PRIMARY KEY,
					version TEXT NOT NULL,
					os TEXT NOT NULL,
					os_version TEXT,
					arch TEXT,
					locale TEXT,
					country TEXT,
					launches INTEGER NOT NULL DEFAULT 0,
					first_seen TEXT NOT NULL DEFAULT (datetime('now')),
					last_seen TEXT NOT NULL DEFAULT (datetime('now'))
				)`,
				"CREATE INDEX IF NOT EXISTS installs_last_seen ON installs (last_seen)",
				// Every report id an install sent. The app resends a report
				// under the same id when it never heard back, and this key
				// turns the resend into a no-op (see recordUsage).
				`CREATE TABLE IF NOT EXISTS usage_reports (
					install_id TEXT NOT NULL,
					report TEXT NOT NULL,
					at TEXT NOT NULL DEFAULT (datetime('now')),
					PRIMARY KEY (install_id, report)
				)`,
				// How often each kind of thing went live, and how often Crater
				// opened ("launch"), per install per day. The day is the
				// booth's own date, from the app, not the day the report came.
				`CREATE TABLE IF NOT EXISTS usage (
					install_id TEXT NOT NULL,
					day TEXT NOT NULL,
					event TEXT NOT NULL,
					n INTEGER NOT NULL,
					PRIMARY KEY (install_id, day, event)
				)`,
			],
			"write",
		)
		.then(() => undefined)
		// A failed setup (a network blip on a cold start) mustn't stick: the
		// next request tries again instead of every request failing on it.
		.catch((e) => {
			ready = null;
			throw e;
		});
	return ready;
}

export type NewReport = {
	kind: "feature" | "bug";
	title: string;
	area: string;
	fields: Record<string, string>;
	name: string;
	email: string;
	ipHash: string;
};

/** How many reports this sender made in the last hour. */
export async function recentCount(ipHash: string): Promise<number> {
	await init();
	const r = await db().execute({
		sql: "SELECT COUNT(*) AS n FROM reports WHERE ip_hash = ? AND created_at > datetime('now', '-1 hour')",
		args: [ipHash],
	});
	return Number(r.rows[0]?.n ?? 0);
}

export async function saveReport(r: NewReport): Promise<number> {
	await init();
	const res = await db().execute({
		sql: "INSERT INTO reports (kind, title, area, fields, name, email, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
		args: [r.kind, r.title, r.area, JSON.stringify(r.fields), r.name || null, r.email || null, r.ipHash],
	});
	return Number(res.lastInsertRowid);
}

export async function setIssueUrl(id: number, url: string) {
	await db().execute({ sql: "UPDATE reports SET issue_url = ? WHERE id = ?", args: [url, id] });
}

export type Contact = {
	email: string;
	name: string;
	church: string;
	role: string;
	size: string;
	city: string;
	country: string;
	phone: string;
	ipCountry: string;
	ipHash: string;
};

/** How many times this sender used the contact form in the last hour. */
export async function recentContacts(ipHash: string): Promise<number> {
	await init();
	const r = await db().execute({
		sql: "SELECT COUNT(*) AS n FROM contacts WHERE ip_hash = ? AND updated_at > datetime('now', '-1 hour')",
		args: [ipHash],
	});
	return Number(r.rows[0]?.n ?? 0);
}

// Sending the form again with the same email only fills fields that were
// empty. Nothing confirms an address belongs to the sender, so a second
// submission must not be able to replace someone's details, like putting a
// stranger's phone number under a church's email.
export async function saveContact(c: Contact) {
	await init();
	const v = (s: string) => s || null;
	await db().execute({
		sql: `INSERT INTO contacts (email, name, church, role, size, city, country, phone, ip_country, ip_hash)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (email) DO UPDATE SET
				name = COALESCE(name, excluded.name),
				church = COALESCE(church, excluded.church),
				role = COALESCE(role, excluded.role),
				size = COALESCE(size, excluded.size),
				city = COALESCE(city, excluded.city),
				country = COALESCE(country, excluded.country),
				phone = COALESCE(phone, excluded.phone),
				ip_country = COALESCE(ip_country, excluded.ip_country),
				ip_hash = excluded.ip_hash,
				updated_at = datetime('now')`,
		args: [c.email, v(c.name), v(c.church), v(c.role), v(c.size), v(c.city), v(c.country), v(c.phone), v(c.ipCountry), c.ipHash],
	});
}

export type UsageReport = {
	id: string;
	report: string;
	version: string;
	os: string;
	osVersion: string;
	arch: string;
	locale: string;
	country: string;
	// day (YYYY-MM-DD) -> event -> count
	days: Record<string, Record<string, number>>;
};

/**
 * One report: refresh the install's row and add its counts to their days.
 * One batch, so all of it lands or none of it does. Its first statement
 * records the report id, so a report the install already sent fails the
 * batch on the primary key and changes nothing. False then.
 */
export async function recordUsage(u: UsageReport): Promise<boolean> {
	await init();
	const v = (s: string) => s || null;
	let launches = 0;
	for (const ev of Object.values(u.days)) launches += ev.launch ?? 0;

	const stmts = [
		{ sql: "INSERT INTO usage_reports (install_id, report) VALUES (?, ?)", args: [u.id, u.report] },
		{
			sql: `INSERT INTO installs (id, version, os, os_version, arch, locale, country, launches)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT (id) DO UPDATE SET
					version = excluded.version,
					os = excluded.os,
					os_version = COALESCE(excluded.os_version, os_version),
					arch = COALESCE(excluded.arch, arch),
					locale = COALESCE(excluded.locale, locale),
					country = COALESCE(excluded.country, country),
					launches = launches + excluded.launches,
					last_seen = datetime('now')`,
			args: [u.id, u.version, u.os, v(u.osVersion), v(u.arch), v(u.locale), v(u.country), launches],
		},
		...Object.entries(u.days).flatMap(([day, events]) =>
			Object.entries(events).map(([event, n]) => ({
				sql: `INSERT INTO usage (install_id, day, event, n) VALUES (?, ?, ?, ?)
					ON CONFLICT (install_id, day, event) DO UPDATE SET n = n + excluded.n`,
				args: [u.id, day, event, n],
			})),
		),
	];
	try {
		await db().batch(stmts, "write");
		return true;
	} catch (e) {
		if (/UNIQUE constraint failed: usage_reports/.test(String((e as Error).message))) return false;
		throw e;
	}
}
