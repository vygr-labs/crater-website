// Who sent a request, as far as the forms and the app need to know. The IP
// address itself is never stored, only a salted hash for rate limits.
import { createHash } from "node:crypto";

export function senderHash(request: Request, clientAddress: string | undefined): string {
	const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
	return createHash("sha256").update(`${process.env.REPORT_SALT ?? "crater"}:${ip}`).digest("hex");
}

// Vercel's two-letter guess at the sender's country. Empty in development.
export function senderCountry(request: Request): string {
	const c = request.headers.get("x-vercel-ip-country") ?? "";
	return /^[A-Z]{2}$/.test(c) ? c : "";
}

// A form post or a JSON body, as plain strings.
export async function readForm(request: Request): Promise<Record<string, string>> {
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

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A person takes longer than this to fill in a form. Scripts usually don't.
const MIN_FILL_MS = 3000;

// A filled-in honeypot, or a form sent faster than anyone could type. The
// routes say thanks and keep nothing, so the sender learns nothing. `t`
// comes from the visitor's clock. One running ahead makes the time spent
// look negative, and a real person must not be mistaken for a script
// because of it.
export function looksLikeBot(form: Record<string, string>): boolean {
	const spent = Date.now() - Number(form.t);
	return Boolean(form.website) || (Number(form.t) > 0 && spent >= 0 && spent < MIN_FILL_MS);
}

/** Each known field, trimmed and cut to its limit. */
export function pick(form: Record<string, string>, limits: Record<string, number>): Record<string, string> {
	return Object.fromEntries(Object.entries(limits).map(([k, max]) => [k, (form[k] ?? "").trim().slice(0, max)]));
}

// How the form routes answer: JSON for the page's script, or a redirect
// back to the page with ?sent=1 or ?error= when JavaScript is off.
export function formReply(request: Request, page: string) {
	const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
	return (status: number, body: { ok: boolean; error?: string; [k: string]: unknown }) => {
		if (wantsJson) return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
		const q = body.ok ? "sent=1" : `error=${encodeURIComponent(body.error ?? "failed")}`;
		return new Response(null, { status: 303, headers: { Location: `${page}?${q}` } });
	};
}
