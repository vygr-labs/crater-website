// The latest release from GitHub. Pages read it once at build time for their
// first paint, /api/release serves it fresh for the browser to update with,
// and /get/<file> redirects to the newest file. If GitHub can't be reached
// everything falls back to the releases page, which always has the files.
import { LATEST } from "./site";

export type Asset = { url: string; size: string };
export type AssetKey = "windows" | "windows-zip" | "mac" | "mac-zip" | "linux" | "checksums";
export type Release = {
	version: string | null;
	date: string | null;
	notes: string;
	assets: Record<AssetKey, Asset | null>;
};

export const patterns: Record<AssetKey, RegExp> = {
	windows: /^Crater-Setup-.*\.exe$/,
	"windows-zip": /-win64\.zip$/,
	mac: /-macos\.dmg$/,
	"mac-zip": /-macos\.zip$/,
	linux: /\.AppImage$/,
	checksums: /^SHA256SUMS\.txt$/,
};

const mb = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

const empty = (): Release => ({
	version: null,
	date: null,
	notes: LATEST,
	assets: { windows: null, "windows-zip": null, mac: null, "mac-zip": null, linux: null, checksums: null },
});

/** Asks GitHub for the latest release. Never throws. */
export async function fetchRelease(): Promise<Release> {
	const out = empty();
	try {
		const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "crater-website" };
		const token = process.env.GITHUB_RELEASES_TOKEN;
		if (token) headers.Authorization = `Bearer ${token}`;
		const res = await fetch("https://api.github.com/repos/vygr-labs/crater-v2/releases/latest", { headers });
		if (!res.ok) throw new Error(`GitHub said ${res.status}`);
		const r = (await res.json()) as {
			tag_name: string;
			html_url: string;
			published_at: string;
			assets: { name: string; size: number; browser_download_url: string }[];
		};
		for (const [key, re] of Object.entries(patterns) as [AssetKey, RegExp][]) {
			const a = r.assets.find((x) => re.test(x.name));
			if (a) out.assets[key] = { url: a.browser_download_url, size: mb(a.size) };
		}
		out.version = r.tag_name;
		out.date = new Date(r.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
		out.notes = r.html_url;
	} catch (e) {
		console.warn(`[release] falling back to the releases page: ${(e as Error).message}`);
	}
	return out;
}

let cached: Promise<Release> | null = null;

/** The release as of this build, fetched once and shared by every page. */
export function getRelease(): Promise<Release> {
	cached ??= fetchRelease();
	return cached;
}

/** A stable link that always redirects to the newest file of this kind. */
export const getHref = (key: AssetKey) => `/get/${key}`;
