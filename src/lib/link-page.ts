// The pages behind the links in our emails (/stay-in-touch/confirm and
// /unsubscribe). Opening a link only asks. Mail scanners open the links in
// emails to check them, and that must neither confirm nor unsubscribe
// anyone. The button posts back to the page, which then redirects to the
// link again, so a refresh doesn't post twice.
import { LINK_TOKEN } from "./db";

export type LinkState = "ask" | "done" | "bad" | "failed";
type Found = { email: string; confirmed: boolean; unsubscribed: boolean };

export type LinkPage = { redirect: string } | { state: LinkState; email: string; token: string };

export async function handleLink(
	request: Request,
	url: URL,
	tag: string,
	find: (token: string) => Promise<Found | null>,
	act: (token: string) => Promise<boolean>,
	// What a found address's page shows: "done" when the action already
	// happened, "bad" when it can't happen, "ask" otherwise.
	stateOf: (c: Found) => LinkState,
): Promise<LinkPage> {
	const token = url.searchParams.get("t") ?? "";
	try {
		if (request.method === "POST") {
			const form = await request.formData().catch(() => null);
			const posted = String(form?.get("t") ?? "");
			if (LINK_TOKEN.test(posted) && (await act(posted))) return { redirect: `${url.pathname}?t=${encodeURIComponent(posted)}` };
			return { state: "bad", email: "", token };
		}
		const c = LINK_TOKEN.test(token) ? await find(token) : null;
		return c ? { state: stateOf(c), email: c.email, token } : { state: "bad", email: "", token };
	} catch (e) {
		console.error(`[${tag}] ${(e as Error).message}`);
		return { state: "failed", email: "", token };
	}
}
