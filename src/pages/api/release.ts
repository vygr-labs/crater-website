import type { APIRoute } from "astro";
import { fetchRelease } from "../../lib/release";

export const prerender = false;

// Vercel's edge cache holds the answer for ten minutes, so GitHub sees a
// handful of requests an hour however many people open the download page.
export const GET: APIRoute = async () => {
	const release = await fetchRelease();
	return new Response(JSON.stringify(release), {
		headers: {
			"Content-Type": "application/json",
			"Cache-Control": release.version ? "public, s-maxage=600, stale-while-revalidate=86400" : "no-store",
		},
	});
};
