// Copies the Decap CMS bundle out of node_modules into public/admin so the
// admin panel loads from our own origin. No CDN, works offline, and keeps the
// Cloudflare CSP simple. Runs automatically before dev and build.
//
// Use the decap-cms package, not decap-cms-app. The latter expects the host
// page to supply React and dies under a plain script tag.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FROM = path.join(ROOT, "node_modules", "decap-cms", "dist");
const TO = path.join(ROOT, "public", "admin", "decap");

// Decap is code split. Chunks are named <id>.decap-cms.js, and the dist also
// ships a parallel <id>.cms.js set that is not needed.
const include = (name) => name.endsWith("decap-cms.js");

// Source maps are not copied, so the trailing reference has to go too or the
// browser logs a 404 for every chunk.
const SOURCE_MAP_REF = /\n?\/\/# sourceMappingURL=.*$/;

if (!fs.existsSync(FROM)) {
  console.error("decap-cms bundle not found. Run npm install first.");
  process.exit(1);
}

fs.rmSync(TO, { recursive: true, force: true });
fs.mkdirSync(TO, { recursive: true });

let count = 0;
let bytes = 0;
for (const name of fs.readdirSync(FROM)) {
  if (!include(name)) continue;
  const code = fs.readFileSync(path.join(FROM, name), "utf8").replace(SOURCE_MAP_REF, "\n");
  fs.writeFileSync(path.join(TO, name), code);
  count += 1;
  bytes += Buffer.byteLength(code);
}

if (count === 0) {
  console.error("no files matched, check the decap-cms dist layout");
  process.exit(1);
}

console.log(`decap synced (${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB)`);
