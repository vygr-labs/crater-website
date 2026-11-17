// The pages behind the links in our emails (/stay-in-touch/confirm and
// /unsubscribe). Opening a link only asks. Mail scanners open the links in
// emails to check them, and that must neither confirm nor unsubscribe
// anyone. The button posts back to the page, which then redirects to the
// link again, so a refresh doesn't post twice.
import { LINK_TOKEN, type LinkContact } from "./db";

export type LinkState = "ask" | "done" | "bad" | "failed";

// What the page shows. `status` is for the page to set on Astro.response.
export type LinkPage = { redirect: string } | { state: LinkState; status: number; contact: LinkContact | null; token: string };

const STATUS: Record<LinkState, number> = { ask: 200, done: 200, bad: 404, failed: 500 };
const show = (state: LinkState, contact: LinkContact | null, token: string): LinkPage => ({ state, status: STATUS[state], contact, token });

export async function handleLink(
	request: Request,
	url: URL,
	tag: string,
	find: (token: string) => Promise<LinkContact | null>,
	act: (token: string) => Promise<boolean>,
	// What a found address's page shows: "done" when the action already
	// happened, "bad" when it can't happen, "ask" otherwise.
	stateOf: (c: LinkContact) => LinkState,
): Promise<LinkPage> {
	const token = url.searchParams.get("t") ?? "";
	try {
		if (request.method === "POST") {
			const form = await request.formData().catch(() => null);
			const posted = String(form?.get("t") ?? "");
			if (LINK_TOKEN.test(posted) && (await act(posted))) return { redirect: `${url.pathname}?t=${encodeURIComponent(posted)}` };
			return show("bad", null, token);
		}
		const c = LINK_TOKEN.test(token) ? await find(token) : null;
		return c ? show(stateOf(c), c, token) : show("bad", null, token);
	} catch (e) {
		console.error(`[${tag}] ${(e as Error).message}`);
		return show("failed", null, token);
	}
}
