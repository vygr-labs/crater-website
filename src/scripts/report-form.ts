// Sends the request, bug report and stay-in-touch forms without leaving the page. Without
// JavaScript the form posts normally and the endpoint sends the browser
// back here with ?sent=1 or ?error=, which this script also reads.
const messages: Record<string, string> = {
	what: "Tell us a little more in the first box, then send it again.",
	email: "That email address doesn't look right. Check it, or leave it empty.",
	"contact-email": "Add an email address we can write to, then send it again.",
	busy: "That's a lot from one place in an hour. Please try again a bit later.",
	failed: "Something went wrong on our side. Please try again in a minute.",
	offline: "We couldn't reach the server. Check your connection and try again.",
};

for (const form of document.querySelectorAll<HTMLFormElement>("[data-report-form]")) {
	const card = form.closest<HTMLElement>("[data-report-card]")!;
	const done = card.querySelector<HTMLElement>("[data-report-done]")!;
	const err = form.querySelector<HTMLElement>("[data-report-error]")!;
	const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
	const issueLink = done.querySelector<HTMLAnchorElement>("[data-report-issue]");
	const started = form.querySelector<HTMLInputElement>('[name="t"]');
	if (started) started.value = String(Date.now());

	const showError = (code: string) => {
		err.textContent = messages[code] ?? messages.failed;
		err.hidden = false;
		const name = ({ what: "what", email: "email", "contact-email": "email" } as Record<string, string>)[code];
		const field = name ? form.querySelector<HTMLElement>(`[name="${name}"]`) : null;
		field?.setAttribute("aria-invalid", "true");
		field?.focus();
	};
	const showDone = (issue?: string | null) => {
		form.hidden = true;
		done.hidden = false;
		if (issueLink && issue) {
			issueLink.href = issue;
			issueLink.hidden = false;
		}
		done.querySelector<HTMLElement>("h2")?.focus();
	};

	const q = new URLSearchParams(location.search);
	if (q.get("sent")) showDone();
	else if (q.get("error")) showError(q.get("error")!);

	form.addEventListener("input", (e) => (e.target as HTMLElement).removeAttribute("aria-invalid"));
	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		err.hidden = true;
		btn.setAttribute("aria-busy", "true");
		try {
			const res = await fetch(form.action, {
				method: "POST",
				headers: { Accept: "application/json" },
				body: new FormData(form),
			});
			const body = (await res.json().catch(() => ({ ok: false, error: "failed" }))) as { ok: boolean; error?: string; issue?: string | null };
			if (body.ok) showDone(body.issue);
			else showError(body.error ?? "failed");
		} catch {
			showError("offline");
		} finally {
			btn.removeAttribute("aria-busy");
		}
	});
}
