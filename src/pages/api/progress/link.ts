import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { cleanEmail, isEmail, linkCounts, newLink, sendLink } from "../../../lib/progress";
import { json, sameSite } from "./_shared";

export const prerender = false;

const PER_IP = 5;
const PER_EMAIL = 3;

// Emails a sign-in link. The answer is the same whether or not the address
// has saved progress already, so nobody can use this to look addresses up.
export const POST: APIRoute = async ({ request, clientAddress, url }) => {
	if (!sameSite(request)) return json(403, { ok: false });
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json(400, { ok: false });
	}
	if (body.website) return json(200, { ok: true });
	const email = cleanEmail(body.email);
	if (!isEmail(email)) return json(400, { ok: false, error: "email" });

	const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
	const ipHash = createHash("sha256").update(`${process.env.REPORT_SALT ?? "crater"}:${ip}`).digest("hex");
	try {
		const n = await linkCounts(ipHash, email);
		if (n.ip >= PER_IP || n.email >= PER_EMAIL) return json(429, { ok: false, error: "busy" });
		const token = await newLink(email, ipHash);
		const sent = await sendLink(email, `${url.origin}/playground?sign=${token}`);
		return sent ? json(200, { ok: true }) : json(502, { ok: false, error: "mail" });
	} catch (e) {
		console.error(`[progress] ${(e as Error).message}`);
		return json(500, { ok: false, error: "failed" });
	}
};
