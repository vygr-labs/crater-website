// The docs sidebar, in reading order. Ids are file paths under
// src/content/docs without the extension. Prev and next follow this order.
export const docsNav = [
	{ label: "Start here", items: ["index", "getting-started/installation", "getting-started/first-launch", "getting-started/interface-overview"] },
	{
		label: "Features",
		items: [
			"features/scriptures",
			"features/strongs",
			"features/songs",
			"features/media",
			"features/presentations",
			"features/themes",
			"features/schedules",
			"features/outputs",
			"features/ndi-streaming",
		],
	},
	{
		label: "Guides",
		items: [
			"guides/displaying-content",
			"guides/quick-search",
			"guides/managing-songs",
			"guides/importing-songs",
			"guides/importing-media",
			"guides/creating-themes",
		],
	},
	{ label: "Reference", items: ["reference/keyboard-shortcuts", "reference/settings", "reference/troubleshooting", "faq"] },
];

export const docsOrder = docsNav.flatMap((g) => g.items);

export const docHref = (id: string) => (id === "index" ? "/docs" : `/docs/${id}`);

// Shorter names for the sidebar where the page title is long.
export const sideLabel: Record<string, string> = {
	index: "Overview",
	"features/scriptures": "Scripture",
	"features/outputs": "Outputs and Stage Display",
	"guides/importing-songs": "Importing EasyWorship Songs",
	"guides/importing-media": "Importing EasyWorship Media",
};
