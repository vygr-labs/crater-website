// Feature requests and bug reports, kept in Turso. Anything people would
// rather not have on a public issue, like an email address, lives only here.
import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;
let ready: Promise<void> | null = null;

function db(): Client {
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
