import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { recentCount, saveReport, setIssueUrl } from "../../lib/db";
import { openIssue, quiet } from "../../lib/github";

export const prerender = false;

const PER_HOUR = 5;
// A person takes longer than this to fill in the form. Scripts usually don't.
const MIN_FILL_MS = 3000;

type Kind = "feature" | "bug";
const limits: Record<string, number> = { what: 200, why: 4000, steps: 4000, expected: 4000, area: 60, os: 60, version: 40, log: 20000, name: 120, email: 200 };

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
	const form = await readForm(request);
	const kind: Kind = form.kind === "bug" ? "bug" : "feature";
	const page = kind === "bug" ? "/report" : "/request";

	const reply = (status: number, body: { ok: boolean; error?: string; issue?: string | null }) => {
		if (wantsJson) return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
		const q = body.ok ? "sent=1" : `error=${encodeURIComponent(body.error ?? "failed")}`;
		return new Response(null, { status: 303, headers: { Location: `${page}?${q}` } });
	};

	// Filled-in honeypot or a form sent faster than anyone could type: say
	// thanks and keep nothing, so the sender learns nothing.
	const started = Number(form.t);
	if (form.website || (started && Date.now() - started < MIN_FILL_MS)) return reply(200, { ok: true });

	const f: Record<string, string> = {};
	for (const [k, max] of Object.entries(limits)) f[k] = (form[k] ?? "").trim().slice(0, max);
	if (f.what.length < 4) return reply(400, { ok: false, error: "what" });
	if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return reply(400, { ok: false, error: "email" });

	const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
	const ipHash = createHash("sha256").update(`${process.env.REPORT_SALT ?? "crater"}:${ip}`).digest("hex");

	try {
		if ((await recentCount(ipHash)) >= PER_HOUR) return reply(429, { ok: false, error: "busy" });
		const { email, name, what, area, ...rest } = f;
		const id = await saveReport({ kind, title: what, area, fields: rest, name, email, ipHash });
		const issue = await openIssue(what, issueBody(kind, f), [kind === "bug" ? "bug" : "enhancement"]);
		if (issue) await setIssueUrl(id, issue);
		return reply(200, { ok: true, issue });
	} catch (e) {
		console.error(`[report] ${(e as Error).message}`);
		return reply(500, { ok: false, error: "failed" });
	}
};

async function readForm(request: Request): Promise<Record<string, string>> {
	const type = request.headers.get("content-type") ?? "";
	try {
		if (type.includes("application/json")) {
			const j = (await request.json()) as Record<string, unknown>;
			return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
		}
		const fd = await request.formData();
		return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
	} catch {
		return {};
	}
}

// The public issue. The email address and the log never go on it.
function issueBody(kind: Kind, f: Record<string, string>): string {
	const q = (s: string) => quiet(s);
	const parts: string[] = [];
	if (f.area) parts.push(`**Part of Crater:** ${q(f.area)}`);
	if (kind === "bug") {
		const where = [f.version && `Crater ${q(f.version)}`, f.os && q(f.os)].filter(Boolean).join(" on ");
		if (where) parts.push(`**Running:** ${where}`);
		parts.push(`### What happened\n${q(f.what)}`);
		if (f.steps) parts.push(`### Steps to see it\n${q(f.steps)}`);
		if (f.expected) parts.push(`### What should have happened\n${q(f.expected)}`);
		// Logs name files and folders on the sender's computer, so they stay
		// in the database and the issue only says one came with the report.
		if (f.log) parts.push("_A log came with this report. It's kept private._");
	} else {
		parts.push(`### What would help\n${q(f.what)}`);
		if (f.why) parts.push(`### How we'd use it\n${q(f.why)}`);
	}
	if (f.name) parts.push(`_From ${q(f.name)}_`);
	parts.push(`_Sent from the ${kind === "bug" ? "bug report" : "feature request"} page on the Crater website._`);
	return parts.join("\n\n");
}
