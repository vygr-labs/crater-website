// The latest release, read from GitHub once at build time so every download
// button points straight at its file. If GitHub can't be reached the buttons
// fall back to the releases page, which always has the files.
import { LATEST } from "./site";

export type Asset = { url: string; size: string };
export type Release = {
	version: string | null;
	date: string | null;
	notes: string;
	assets: Record<"winSetup" | "winZip" | "macDmg" | "macZip" | "linux" | "sums", Asset | null>;
};

const patterns = {
	winSetup: /^Crater-Setup-.*\.exe$/,
	winZip: /-win64\.zip$/,
	macDmg: /-macos\.dmg$/,
	macZip: /-macos\.zip$/,
	linux: /\.AppImage$/,
	sums: /^SHA256SUMS\.txt$/,
};

const mb = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

let cached: Promise<Release> | null = null;

export function getRelease(): Promise<Release> {
	cached ??= load();
	return cached;
}

async function load(): Promise<Release> {
	const empty: Release = { version: null, date: null, notes: LATEST, assets: { winSetup: null, winZip: null, macDmg: null, macZip: null, linux: null, sums: null } };
	try {
		const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
		if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
		const res = await fetch("https://api.github.com/repos/vygr-labs/crater-v2/releases/latest", { headers });
		if (!res.ok) throw new Error(`GitHub said ${res.status}`);
		const r = (await res.json()) as {
			tag_name: string;
			html_url: string;
			published_at: string;
			assets: { name: string; size: number; browser_download_url: string }[];
		};
		const assets = { ...empty.assets };
		for (const [key, re] of Object.entries(patterns) as [keyof typeof patterns, RegExp][]) {
			const a = r.assets.find((x) => re.test(x.name));
			if (a) assets[key] = { url: a.browser_download_url, size: mb(a.size) };
		}
		const date = new Date(r.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
		return { version: r.tag_name, date, notes: r.html_url, assets };
	} catch (e) {
		console.warn(`[release] using the releases page for downloads: ${(e as Error).message}`);
		return empty;
	}
}

/** The file's link, or the latest release page when it isn't known. */
export const href = (a: Asset | null) => a?.url ?? LATEST;
