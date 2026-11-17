// Email through Resend. A local copy of the site and a Vercel preview have
// no mail service (the key is set for production only), so there the
// message goes to the log instead, links and all.
export type Mail = { to: string; subject: string; text: string; html: string };

export async function sendMail(m: Mail, tag: string): Promise<boolean> {
	const key = process.env.RESEND_API_KEY;
	if (!key) {
		if (import.meta.env.DEV || process.env.VERCEL_ENV === "preview") {
			console.log(`[${tag}] email to ${m.to}: ${m.subject}\n${m.text}`);
			return true;
		}
		console.error(`[${tag}] RESEND_API_KEY is not set`);
		return false;
	}
	try {
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				from: process.env.MAIL_FROM ?? "Crater <practice@getcrater.org>",
				// The pages tell people to reply to any email from us.
				reply_to: "hello@getcrater.org",
				to: [m.to],
				subject: m.subject,
				text: m.text,
				html: m.html,
			}),
		});
		if (!res.ok) throw new Error(`Resend said ${res.status}: ${(await res.text()).slice(0, 200)}`);
		return true;
	} catch (e) {
		console.error(`[${tag}] ${(e as Error).message}`);
		return false;
	}
}

// The look every Crater email shares: one paragraph per line of `lines`,
// the button after the first.
export function mailHtml(lines: string[], button: { href: string; label: string }, quiet: string): string {
	const p = (s: string, muted = false) => `<p${muted ? ' style="color:#5f686c"' : ""}>${s}</p>`;
	return `<div style="font:16px/1.55 -apple-system,Segoe UI,sans-serif;color:#121416;max-width:520px">
${p(lines[0])}
<p style="margin:28px 0"><a href="${button.href}" style="display:inline-block;padding:14px 24px;border-radius:999px;background:#087785;color:#fff;text-decoration:none;font-weight:600">${button.label}</a></p>
${lines.slice(1).map((l) => p(l)).join("\n")}
${p(quiet, true)}
${p('Crater<br><a href="https://getcrater.org" style="color:#087785">getcrater.org</a>', true)}
</div>`;
}
