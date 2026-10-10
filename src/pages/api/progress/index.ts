import type { APIRoute, AstroCookies } from "astro";
import { cleanSessions, forget, learner, merge, saveSessions, signOut } from "../../../lib/progress";
import { COOKIE, json, sameSite } from "./_shared";

export const prerender = false;

const who = (cookies: AstroCookies) => learner(cookies.get(COOKIE)?.value);

// The saved runs for this browser's address.
export const GET: APIRoute = async ({ cookies }) => {
	const me = await who(cookies);
	if (!me) return json(401, { ok: false });
	return json(200, { ok: true, email: me.email, sessions: me.sessions });
};

// The browser sends what it has. Runs are added to the saved ones, or
// replace them when the learner cleared their progress.
export const PUT: APIRoute = async ({ request, cookies }) => {
	if (!sameSite(request)) return json(403, { ok: false });
	const me = await who(cookies);
	if (!me) return json(401, { ok: false });
	let body: { sessions?: unknown; replace?: unknown };
	try {
		body = await request.json();
	} catch {
		return json(400, { ok: false });
	}
	const mine = cleanSessions(body.sessions);
	const sessions = body.replace === true ? mine : merge(me.sessions, mine);
	await saveSessions(me.id, sessions);
	return json(200, { ok: true, email: me.email, sessions });
};

// Signs this browser out. With ?forget=1 the address and its runs go too.
export const DELETE: APIRoute = async ({ request, cookies, url }) => {
	if (!sameSite(request)) return json(403, { ok: false });
	const login = cookies.get(COOKIE)?.value;
	const me = await learner(login);
	if (me && url.searchParams.get("forget") === "1") await forget(me.id);
	else if (login) await signOut(login);
	cookies.delete(COOKIE, { path: "/" });
	return json(200, { ok: true });
};
