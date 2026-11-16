// Prints the stay-in-touch list as CSV, with each address's own unsubscribe
// link to put at the foot of the email. Addresses that unsubscribed are left
// out. Reads the live database, so pull the production settings first:
//
//   npx vercel env pull .env.production.local --environment=production
//   npm run mailing-list > mailing-list.csv
import { mailingList } from "../src/lib/db.ts";

// Names and churches are typed by anyone. One starting with = or + would run
// as a formula when the file opens in a spreadsheet, so it gets a ' first.
const cell = (v: string) => {
	const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rows = await mailingList();
console.log("email,name,church,country,unsubscribe");
for (const r of rows) console.log([r.email, r.name, r.church, r.country, r.unsubscribe].map(cell).join(","));
console.error(`${rows.length} on the list`);
