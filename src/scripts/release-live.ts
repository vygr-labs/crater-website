// The page ships with the release that was current when it was built. This
// asks for the latest one and updates the version, date and file sizes, so a
// new release shows up without rebuilding the site. The download links
// themselves go through /get/<file>, which always redirects to the newest.
import type { Release } from "../lib/release";

const $$ = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel));

if ($$("[data-rel]").length) {
	fetch("/api/release")
		.then((r) => (r.ok ? (r.json() as Promise<Release>) : null))
		.then((rel) => {
			if (!rel?.version) return;
			$$('[data-rel="version"]').forEach((el) => (el.textContent = rel.version));
			$$('[data-rel="date"]').forEach((el) => (el.textContent = rel.date));
			$$('[data-rel="notes"]').forEach((el) => el.setAttribute("href", rel.notes));
			$$("[data-rel-size]").forEach((el) => {
				const a = rel.assets[el.dataset.relSize as keyof Release["assets"]];
				if (a) el.textContent = a.size;
			});
		})
		.catch(() => {});
}
