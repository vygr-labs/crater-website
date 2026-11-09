import type { APIRoute } from "astro";
import { recentContacts, saveContact } from "../../lib/db";
import { readForm, senderCountry, senderHash } from "../../lib/sender";

export const prerender = false;

const PER_HOUR = 5;
// A person takes longer than this to fill in the form. Scripts usually don't.
const MIN_FILL_MS = 3000;

const limits: Record<string, number> = { email: 200, name: 120, church: 160, role: 60, size: 40, city: 80, country: 80, phone: 40 };

// The "Stay in touch" form. Same replies as /api/report: JSON for the page's
// script, a redirect back to the page when JavaScript is off.
export const POST: APIRoute = async ({ request, clientAddress }) => {
	const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");
	const form = await readForm(request);

	const reply = (status: number, body: { ok: boolean; error?: string }) => {
		if (wantsJson) return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
		const q = body.ok ? "sent=1" : `error=${encodeURIComponent(body.error ?? "failed")}`;
		return new Response(null, { status: 303, headers: { Location: `/stay-in-touch?${q}` } });
	};

	const started = Number(form.t);
	if (form.website || (started && Date.now() - started < MIN_FILL_MS)) return reply(200, { ok: true });

	const f: Record<string, string> = {};
	for (const [k, max] of Object.entries(limits)) f[k] = (form[k] ?? "").trim().slice(0, max);
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return reply(400, { ok: false, error: "contact-email" });

	const ipHash = senderHash(request, clientAddress);
	try {
		if ((await recentContacts(ipHash)) >= PER_HOUR) return reply(429, { ok: false, error: "busy" });
		await saveContact({
			email: f.email,
			name: f.name,
			church: f.church,
			role: f.role,
			size: f.size,
			city: f.city,
			country: f.country,
			phone: f.phone,
			ipCountry: senderCountry(request),
			ipHash,
		});
		return reply(200, { ok: true });
	} catch (e) {
		console.error(`[contact] ${(e as Error).message}`);
		return reply(500, { ok: false, error: "failed" });
	}
};
