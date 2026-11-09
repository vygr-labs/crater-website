import type { APIRoute } from "astro";
import { recordUsage } from "../../lib/db";
import { senderCountry } from "../../lib/sender";

export const prerender = false;

// Anonymous usage from installs whose operator switched on "Share anonymous
// usage" (app/src/UsageService.cpp). Only the fields below are kept. Anything
// else in the body is dropped, so a future app can't widen what's stored
// without this file changing too.
const EVENTS = new Set(["live.song", "live.scripture", "live.image", "live.video", "live.pdf", "live.presentation", "live.other"]);
const OSES = new Set(["windows", "macos", "linux"]);
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]{1,30})?$/;
// More than this in one report is a bug or a forgery, not a church.
const MAX_COUNT = 100_000;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_COUNT ? (v as number) : 0);

export const POST: APIRoute = async ({ request }) => {
	const len = Number(request.headers.get("content-length") ?? 0);
	if (len > 8192) return new Response(null, { status: 413 });

	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response(null, { status: 400 });
	}

	const id = clean(body.id, 36).toLowerCase();
	const version = clean(body.version, 40);
	const os = clean(body.os, 20);
	if (!ID.test(id) || !VERSION.test(version) || !OSES.has(os)) return new Response(null, { status: 400 });

	const events: Record<string, number> = {};
	const raw = body.events && typeof body.events === "object" ? (body.events as Record<string, unknown>) : {};
	for (const [k, v] of Object.entries(raw)) {
		const n = count(v);
		if (EVENTS.has(k) && n > 0) events[k] = n;
	}

	try {
		await recordUsage({
			id,
			version,
			os,
			osVersion: clean(body.osVersion, 40),
			arch: clean(body.arch, 20),
			locale: clean(body.locale, 20),
			country: senderCountry(request),
			launches: count(body.launches),
			events,
		});
		return new Response(null, { status: 204 });
	} catch (e) {
		console.error(`[usage] ${(e as Error).message}`);
		return new Response(null, { status: 500 });
	}
};
