import type { APIRoute } from "astro";
import { fetchRelease, patterns, type AssetKey } from "../../lib/release";
import { LATEST } from "../../lib/site";

export const prerender = false;

// /get/windows, /get/mac, /get/linux and so on always lead to the newest
// file, so a link copied today still works after the next release.
export const GET: APIRoute = async ({ params }) => {
	const key = params.file as AssetKey;
	if (!(key in patterns)) return new Response("Not found", { status: 404 });
	const release = await fetchRelease();
	const headers: Record<string, string> = { Location: release.assets[key]?.url ?? LATEST };
	if (release.version) headers["Cache-Control"] = "public, s-maxage=600, stale-while-revalidate=86400";
	return new Response(null, { status: 302, headers });
};
