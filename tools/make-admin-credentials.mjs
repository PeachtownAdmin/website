// Generates the admin credentials for the site editor.
//
//   node tools/make-admin-credentials.mjs user0:somepassword user1:anotherone
//
// Prints the two environment variables the login gate needs. Passwords are
// hashed here and never stored anywhere in plain text; the hash is all the
// server ever sees.
//
// Put the output in .dev.vars for local preview, or in the Cloudflare Pages
// project settings for the real deployment.

import { createHash, randomBytes } from "node:crypto";

const pairs = process.argv.slice(2);

if (pairs.length === 0) {
  console.error("Usage: node tools/make-admin-credentials.mjs user:password [user:password ...]");
  process.exit(1);
}

const users = pairs.map((pair) => {
  const at = pair.indexOf(":");
  if (at < 1 || at === pair.length - 1) {
    console.error(`Not a user:password pair: ${pair}`);
    process.exit(1);
  }
  const user = pair.slice(0, at);
  const password = pair.slice(at + 1);
  if (password.length < 8) {
    console.error(`Password for ${user} is short. Use at least 8 characters.`);
    process.exit(1);
  }
  return `${user}:${createHash("sha256").update(password).digest("hex")}`;
});

console.log(`ADMIN_USERS=${users.join(",")}`);
console.log(`ADMIN_SECRET=${randomBytes(32).toString("hex")}`);
// To stderr, so redirecting stdout into .dev.vars gives a clean file.
console.error("");
console.error("ADMIN_SECRET signs the session cookie. Changing it signs everyone out.");
