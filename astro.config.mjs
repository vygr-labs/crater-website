// @ts-check
import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

// Every page is built ahead of time. Only the routes that opt out with
// `prerender = false` (requests, bug reports and the latest release) run
// as Vercel functions.
export default defineConfig({
	site: "https://crater.voyagerlabs.tech",
	adapter: vercel(),
	server: { port: 4321 },
});
