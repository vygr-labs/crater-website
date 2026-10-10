import type { APIRoute } from "astro";
import { useLink } from "../../../lib/progress";
import { COOKIE, json, sameSite } from "./_shared";

export const prerender = false;

// Spends the link from the email and signs this browser in for a year.
export const POST: APIRoute = async ({ request, cookies, url }) => {
	if (!sameSite(request)) return json(403, { ok: false });
	let token = "";
	try {
		token = String(((await request.json()) as { token?: unknown }).token ?? "").slice(0, 100);
	} catch {}
	if (!token) return json(400, { ok: false });
	const done = await useLink(token);
	if (!done) return json(410, { ok: false, error: "expired" });
	cookies.set(COOKIE, done.login, {
		path: "/",
		httpOnly: true,
		sameSite: "lax",
		secure: url.protocol === "https:",
		maxAge: 60 * 60 * 24 * 365,
	});
	return json(200, { ok: true, email: done.email });
};
