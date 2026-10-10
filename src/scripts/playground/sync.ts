// Keeps the runs in this browser in step with the copy saved against the
// learner's email. The browser stays the working copy: the page draws from
// localStorage, and the saved copy is brought in on load and sent after
// every run.
import { loadSessions, replaceSessions, type Session } from "./stats";

export type SyncState = { email: string | null; busy: boolean; note: string };

const state: SyncState = { email: null, busy: false, note: "" };
let onChange: (all: Session[]) => void = () => {};

async function call(method: string, path: string, body?: unknown) {
	const res = await fetch(path, {
		method,
		headers: body ? { "Content-Type": "application/json" } : undefined,
		body: body ? JSON.stringify(body) : undefined,
		credentials: "same-origin",
	});
	const data = await res.json().catch(() => ({}));
	return { status: res.status, ...data } as { status: number; ok?: boolean; email?: string; sessions?: Session[]; error?: string };
}

export const syncState = () => state;

// Sends what this browser has and takes back the merged list.
async function push(replace = false) {
	const r = await call("PUT", "/api/progress", { sessions: loadSessions(), replace });
	if (r.status === 401) state.email = null;
	if (r.ok && r.sessions) {
		replaceSessions(r.sessions);
		onChange(r.sessions);
	}
	return r;
}

/** Called once when the page opens. Spends a link from the email if there is one. */
export async function startSync(changed: (all: Session[]) => void) {
	onChange = changed;
	const params = new URLSearchParams(location.search);
	const token = params.get("sign");
	if (token) {
		// The link is single use, so it comes out of the address bar straight away.
		params.delete("sign");
		history.replaceState(null, "", location.pathname + (params.size ? `?${params}` : "") + "#progress");
		const r = await call("POST", "/api/progress/sign", { token }).catch(() => null);
		state.note = r?.ok ? "signed-in" : "expired";
	}
	try {
		const r = await call("GET", "/api/progress");
		if (r.ok) {
			state.email = r.email ?? null;
			await push();
		}
	} catch {}
	onChange(loadSessions());
	if (token) document.getElementById("progress")?.scrollIntoView({ block: "start" });
}

/** After a run ends. Quietly does nothing for a learner who hasn't signed in. */
export function saved() {
	if (state.email) push().catch(() => {});
}

/** After the learner clears their progress, the saved copy is cleared too. */
export function cleared() {
	if (state.email) push(true).catch(() => {});
}

export async function requestLink(email: string): Promise<"sent" | "email" | "busy" | "failed"> {
	try {
		const r = await call("POST", "/api/progress/link", { email });
		if (r.ok) return "sent";
		return r.error === "email" || r.error === "busy" ? r.error : "failed";
	} catch {
		return "failed";
	}
}

export async function signOut(forget = false) {
	await call("DELETE", `/api/progress${forget ? "?forget=1" : ""}`).catch(() => {});
	state.email = null;
	state.note = forget ? "forgotten" : "";
	onChange(loadSessions());
}
