// Prints the stay-in-touch list as CSV: everyone who confirmed and hasn't
// unsubscribed, each with their own unsubscribe link to put at the foot of
// the email. Reads the live database, so pull the production settings first:
//
//   npx vercel env pull .env.production.local --environment=production
//   npm run mailing-list > mailing-list.csv
import { mailingList } from "../src/lib/db.ts";

// Without these the site's code falls back to a local database file, and
// the list would come out empty instead of failing.
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
	console.error("TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing. Pull the production settings first (see the top of this file).");
	process.exit(1);
}

const cell = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
// Names, churches and countries are typed by anyone. One starting with = or
// + would run as a formula when the file opens in a spreadsheet, so it gets
// a ' first. Not the email or the link, which a mail tool reads as they are
// (an address can start with + or -).
const text = (s: string) => cell(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

const rows = await mailingList();
console.log("email,name,church,country,unsubscribe");
for (const r of rows) console.log([cell(r.email), text(r.name), text(r.church), text(r.country), cell(r.unsubscribe)].join(","));
console.error(`${rows.length} on the list`);
