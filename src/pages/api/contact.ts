import type { APIRoute } from "astro";
import { claimConfirmation, recentContacts, releaseConfirmation, saveContact } from "../../lib/db";
import { sendConfirmation } from "../../lib/confirm-mail";
import { EMAIL, formReply, looksLikeBot, pick, readForm, senderCountry, senderHash } from "../../lib/sender";

export const prerender = false;

const PER_HOUR = 5;

const limits: Record<string, number> = { email: 200, name: 120, church: 160, role: 60, size: 40, city: 80, country: 80, phone: 40 };

// The "Stay in touch" form. Same replies as /api/report.
export const POST: APIRoute = async ({ request, clientAddress }) => {
	const form = await readForm(request);
	const reply = formReply(request, "/stay-in-touch");
	if (looksLikeBot(form)) return reply(200, { ok: true });

	const f = pick(form, limits);
	if (!EMAIL.test(f.email)) return reply(400, { ok: false, error: "contact-email" });

	const ipHash = senderHash(request, clientAddress);
	try {
		if ((await recentContacts(ipHash)) >= PER_HOUR) return reply(429, { ok: false, error: "busy" });
		const { email, name, church, role, size, city, country, phone } = f;
		await saveContact({ email, name, church, role, size, city, country, phone, ipCountry: senderCountry(request), ipHash });
		// Nothing is written to the address until its owner confirms it. The
		// reply is the same whether or not an email went out (already on the
		// list, one sent minutes ago, or the most we send to one address), so
		// the form can't be used to find out who is on the list.
		const token = await claimConfirmation(email);
		if (token && !(await sendConfirmation(email, `${new URL(request.url).origin}/stay-in-touch/confirm?t=${token}`))) {
			await releaseConfirmation(email);
			return reply(502, { ok: false, error: "failed" });
		}
		return reply(200, { ok: true });
	} catch (e) {
		console.error(`[contact] ${(e as Error).message}`);
		return reply(500, { ok: false, error: "failed" });
	}
};
