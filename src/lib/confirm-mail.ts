// The email the stay-in-touch form sends, so an address only goes on the
// list when its owner says so.
import { mailHtml, sendMail } from "./mail";

export function sendConfirmation(to: string, url: string): Promise<boolean> {
	const intro = "Someone, hopefully you, asked to hear from the Crater team at this address.";
	const after = "Confirm it and we'll write when there's a new version or something your church should know. Not often, and every email has a link to stop them.";
	const quiet = "If you didn't ask for this, ignore this email and we won't write to you.";
	const text = [intro, "", "Confirm your email:", url, "", after, "", quiet, "", "Crater", "https://getcrater.org"].join("\n");
	const html = mailHtml([intro, after], { href: url, label: "Confirm my email" }, quiet);
	return sendMail({ to, subject: "Confirm you'd like to hear from Crater", text, html }, "contact");
}
