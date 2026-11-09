// Who sent a request, as far as the forms and the app need to know. The IP
// address itself is never stored, only a salted hash for rate limits.
import { createHash } from "node:crypto";

export function senderHash(request: Request, clientAddress: string | undefined): string {
	const ip = clientAddress || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
	return createHash("sha256").update(`${process.env.REPORT_SALT ?? "crater"}:${ip}`).digest("hex");
}

// Vercel's two-letter guess at the sender's country. Empty in development.
export function senderCountry(request: Request): string {
	const c = request.headers.get("x-vercel-ip-country") ?? "";
	return /^[A-Z]{2}$/.test(c) ? c : "";
}

// A form post or a JSON body, as plain strings.
export async function readForm(request: Request): Promise<Record<string, string>> {
	const type = request.headers.get("content-type") ?? "";
	try {
		if (type.includes("application/json")) {
			const j = (await request.json()) as Record<string, unknown>;
			return Object.fromEntries(Object.entries(j).map(([k, v]) => [k, String(v ?? "")]));
		}
		const fd = await request.formData();
		return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
	} catch {
		return {};
	}
}
