// Opens an issue on the Crater repository for a request or a report.
const REPO = "vygr-labs/crater-v2";

/** Returns the new issue's link, or null if no token is set or GitHub refused. */
export async function openIssue(title: string, body: string, labels: string[]): Promise<string | null> {
	const token = process.env.GITHUB_ISSUES_TOKEN;
	if (!token) return null;
	try {
		const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
			method: "POST",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"User-Agent": "crater-website",
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ title, body, labels }),
		});
		if (!res.ok) throw new Error(`GitHub said ${res.status}: ${(await res.text()).slice(0, 200)}`);
		return ((await res.json()) as { html_url: string }).html_url;
	} catch (e) {
		console.error(`[issues] ${(e as Error).message}`);
		return null;
	}
}

// Text from the form goes onto a public page, so a zero-width space after
// each @ stops it pinging people.
export const quiet = (s: string) => s.replace(/@(?=\w)/g, "@​");
