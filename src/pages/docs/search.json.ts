import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import GithubSlugger from "github-slugger";
import { docHref } from "../../lib/docs";

// The search index: one entry per section of every page, built with the
// site. The whole guide is small enough to search in the browser.
const plain = (md: string) =>
	md
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/^:{3,}.*$/gm, " ")
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/<[^>]+>/g, " ")
		.replace(/[*_`#>|]/g, " ")
		.replace(/-{3,}/g, " ")
		.replace(/\s+/g, " ")
		.trim();

export const GET: APIRoute = async () => {
	const docs = await getCollection("docs");
	const out: { page: string; section: string; url: string; text: string }[] = [];
	for (const d of docs) {
		const slugger = new GithubSlugger();
		const base = docHref(d.id);
		const parts = (d.body ?? "").split(/^(#{2,3} .+)$/m);
		out.push({ page: d.data.title, section: "", url: base, text: `${d.data.description} ${plain(parts[0])}`.slice(0, 600) });
		for (let i = 1; i < parts.length; i += 2) {
			const heading = plain(parts[i].replace(/^#+ /, ""));
			out.push({ page: d.data.title, section: heading, url: `${base}#${slugger.slug(heading)}`, text: plain(parts[i + 1] ?? "").slice(0, 600) });
		}
	}
	return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
};
