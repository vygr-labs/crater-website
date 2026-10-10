// Links and facts shared by every page.
export const DOCS = "/docs/";
export const CHANNEL = "https://www.youtube.com/@craterbibleproject";
export const REPO = "https://github.com/vygr-labs/crater-v2";
export const RELEASES = `${REPO}/releases`;
export const LATEST = `${RELEASES}/latest`;
export const ISSUES = `${REPO}/issues`;

// Same ids and order as HelpLinks.cpp in the app.
const yt = (id: string) => `https://www.youtube.com/playlist?list=${id}`;
export const playlists = [
	["Getting started", "PLeTrWoINYOdc", "Install Crater, pick your projection screen and put your first verse up."],
	["Scripture", "PLNO9VmlLIHvc", "Find verses by reference or by the words you remember, and highlight as you preach."],
	["Songs", "PLcyNZxoeJ3Jg", "Add songs, split them into sections and run them verse by verse."],
	["Media and sermon slides", "PLBAJHRdNjqYQ", "Pictures, videos and slides you build right inside Crater."],
	["Planning the service", "PLXZDtD0pzOe0", "Put the whole order of service in one schedule before Sunday."],
	["Themes", "PLdevLN2YWRz4", "Fonts, colours and backgrounds, set once and reused every week."],
	["Screens and streaming", "PLeIJbC4poGcQ", "Projector, stage display, mirror screens and NDI into your stream."],
	["Settings and profiles", "PLegIh7LuDbIU", "Make Crater fit your church, and keep a profile for each team."],
	["Keyboard shortcuts", "PLaRLc4BRkAx0", "Run the whole service without reaching for the mouse."],
].map(([label, id, note], i) => ({ label, note, url: yt(id), n: String(i + 1).padStart(2, "0") }));

// Pages in the nav and the footer. Each one is its own page.
export const nav = [
	{ href: "/features", label: "Features" },
	{ href: "/tutorials", label: "Tutorials" },
	{ href: "/playground", label: "Practice" },
	{ href: "/request", label: "Request a feature" },
	{ href: "/docs", label: "Docs" },
];

// Platform marks, drawn to match the line icons used across the site.
export const osIcon = {
	windows: `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.5 10.5 4.5v7H3zM11.5 4.4 21 3v8.5h-9.5zM3 12.5h7.5v7L3 18.5zM11.5 12.5H21V21l-9.5-1.4z"></path></svg>`,
	mac: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"></rect><path d="M8 21h8M12 17v4"></path></svg>`,
	linux: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 17 6-6-6-6M12 19h8"></path></svg>`,
};
