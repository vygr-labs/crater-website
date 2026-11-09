import type { APIRoute } from "astro";
import { recordUsage } from "../../lib/db";
import { senderCountry } from "../../lib/sender";

export const prerender = false;

// Anonymous usage from installs whose operator switched on "Share anonymous
// usage" (app/src/UsageService.cpp in crater-v2). Only the fields below are
// kept. Anything else in the body is dropped, so a future app can't widen
// what's stored without this file changing too.
const EVENTS = new Set([
	"launch",
	"live.song",
	"live.scripture",
	"live.image",
	"live.video",
	"live.pdf",
	"live.presentation",
	"live.other",
]);
const OSES = new Set(["windows", "macos", "linux"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VERSION = /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]{1,30})?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_BYTES = 16 * 1024;
// More than this of one thing on one day is a bug or a forgery, not a church.
const MAX_PER_DAY = 2_000;
// Days the app held while it couldn't send. Older ones are dropped.
const MAX_AGE_DAYS = 400;

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const count = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 && (v as number) <= MAX_PER_DAY ? (v as number) : 0);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// The booth's own dates. A day that isn't a real date, is from the future
// (beyond a timezone's head start) or is too old is dropped.
function validDay(day: string): boolean {
	if (!DAY.test(day)) return false;
	const t = Date.parse(`${day}T00:00:00Z`);
	if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== day) return false;
	const now = Date.now();
	return t <= now + 36 * 3600_000 && t >= now - MAX_AGE_DAYS * 86400_000;
}

export const POST: APIRoute = async ({ request }) => {
	// content-length can be missing (chunked) or wrong, so the body itself
	// is measured.
	const text = await request.text().catch(() => "");
	if (text.length > MAX_BYTES) return new Response(null, { status: 413 });

	let body: unknown;
	try {
		body = JSON.parse(text);
	} catch {
		return new Response(null, { status: 400 });
	}
	if (!isObject(body)) return new Response(null, { status: 400 });

	const id = clean(body.id, 36).toLowerCase();
	const report = clean(body.report, 36).toLowerCase();
	const version = clean(body.version, 40);
	const os = clean(body.os, 20);
	if (!UUID.test(id) || !UUID.test(report) || !VERSION.test(version) || !OSES.has(os)) return new Response(null, { status: 400 });

	const days: Record<string, Record<string, number>> = {};
	if (isObject(body.days)) {
		for (const [day, events] of Object.entries(body.days)) {
			if (!validDay(day) || !isObject(events)) continue;
			for (const [k, v] of Object.entries(events)) {
				const n = count(v);
				if (EVENTS.has(k) && n > 0) (days[day] ??= {})[k] = n;
			}
		}
	}

	try {
		await recordUsage({
			id,
			report,
			version,
			os,
			osVersion: clean(body.osVersion, 40),
			arch: clean(body.arch, 20),
			locale: clean(body.locale, 20),
			country: senderCountry(request),
			days,
		});
		// A resend of a report already stored is also a success to the app.
		return new Response(null, { status: 204 });
	} catch (e) {
		console.error(`[usage] ${(e as Error).message}`);
		return new Response(null, { status: 500 });
	}
};
