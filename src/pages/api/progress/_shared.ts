// Bits the progress routes share. The underscore keeps Astro from making
// this file a route of its own.
export const COOKIE = "crater_practice";

export const json = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// Changes only come from the site's own pages. The cookie is SameSite=Lax
// as well, so this is a second lock on the same door.
export function sameSite(request: Request) {
	const origin = request.headers.get("origin");
	return !origin || new URL(origin).host === new URL(request.url).host;
}
