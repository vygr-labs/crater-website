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
				// How often each kind of thing went live, per install per day.
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
		.then(() => undefined);
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

// Sending the form again with the same email updates the row. A field left
// empty the second time keeps what was there.
export async function saveContact(c: Contact) {
	await init();
	const v = (s: string) => s || null;
	await db().execute({
		sql: `INSERT INTO contacts (email, name, church, role, size, city, country, phone, ip_country, ip_hash)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (email) DO UPDATE SET
				name = COALESCE(excluded.name, name),
				church = COALESCE(excluded.church, church),
				role = COALESCE(excluded.role, role),
				size = COALESCE(excluded.size, size),
				city = COALESCE(excluded.city, city),
				country = COALESCE(excluded.country, country),
				phone = COALESCE(excluded.phone, phone),
				ip_country = COALESCE(excluded.ip_country, ip_country),
				ip_hash = excluded.ip_hash,
				updated_at = datetime('now')`,
		args: [c.email, v(c.name), v(c.church), v(c.role), v(c.size), v(c.city), v(c.country), v(c.phone), v(c.ipCountry), c.ipHash],
	});
}

export type UsageReport = {
	id: string;
	version: string;
	os: string;
	osVersion: string;
	arch: string;
	locale: string;
	country: string;
	launches: number;
	events: Record<string, number>;
};

// One report: refresh the install's row and add its counts to today's.
export async function recordUsage(u: UsageReport) {
	await init();
	const v = (s: string) => s || null;
	const stmts = [
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
			args: [u.id, u.version, u.os, v(u.osVersion), v(u.arch), v(u.locale), v(u.country), u.launches],
		},
		...Object.entries(u.events).map(([event, n]) => ({
			sql: `INSERT INTO usage (install_id, day, event, n) VALUES (?, date('now'), ?, ?)
				ON CONFLICT (install_id, day, event) DO UPDATE SET n = n + excluded.n`,
			args: [u.id, event, n],
		})),
	];
	await db().batch(stmts, "write");
}
