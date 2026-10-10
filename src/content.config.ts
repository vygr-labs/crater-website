import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// The user guide. One Markdown file per page, laid out the way the URLs read:
// src/content/docs/guides/importing-songs.md is /docs/guides/importing-songs.
const docs = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/docs" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
	}),
});

// Landing pages and how-to articles at the top level of the site, written
// for people searching for help with church projection.
const articles = defineCollection({
	loader: glob({ pattern: "*.md", base: "./src/content/articles" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		heading: z.string(),
		lede: z.string(),
		related: z.array(z.string()).default([]),
	}),
});

export const collections = { docs, articles };
