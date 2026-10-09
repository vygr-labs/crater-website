// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

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
	site: "https://crater.voyagerlabs.tech",
	adapter: vercel(),
	server: { port: 4321 },
	vite: { plugins: [rolldownStandIn] },
});
