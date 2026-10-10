// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";
import sitemap from "@astrojs/sitemap";
import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import remarkDirective from "remark-directive";
import { rehypeExternalLinks, rehypeHeadingLinks, remarkDocs } from "./src/lib/markdown.ts";

// The Vercel adapter's server code imports a constant from its own main file,
// which also imports rolldown for build-time bundling. Rolldown loads a native
// binary as soon as it is imported, so it crashed every function on Vercel.
// Nothing calls it at run time, so the server bundle gets a stand-in instead.
/** @type {import("vite").Plugin} */
const rolldownStandIn = {
	name: "crater:rolldown-stand-in",
	enforce: "pre",
	resolveId: (id) => (id === "rolldown" ? "\0rolldown-stand-in" : null),
	load: (id) =>
		id === "\0rolldown-stand-in"
			? 'export function rolldown() { throw new Error("rolldown is only for building, not for running"); }'
			: null,
};

// Every page is built ahead of time. Only the routes that opt out with
// `prerender = false` (requests, bug reports and the latest release) run
// as Vercel functions.
export default defineConfig({
	site: "https://getcrater.org",
	adapter: vercel(),
	server: { port: 4321 },
	// The old docs had their own downloads page. The site has one now.
	redirects: { "/docs/downloads": "/download" },
	// The forms and the 404 page have nothing for search engines.
	integrations: [sitemap({ filter: (page) => !/\/(404|report|request)\/?$/.test(page) })],
	markdown: {
		processor: unified({
			remarkPlugins: [remarkDirective, remarkDocs],
			// Ids first, so the section links can point at them.
			rehypePlugins: [rehypeHeadingIds, rehypeHeadingLinks, rehypeExternalLinks],
		}),
		shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
	},
	vite: { plugins: [rolldownStandIn] },
});
