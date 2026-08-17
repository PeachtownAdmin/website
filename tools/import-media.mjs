// Copies the scraped photographs into the CMS media folder.
//
// Everything the site uses lives in one folder, public/images/uploads, because
// that is the only folder Decap's media library can browse. Editors can then
// reuse any existing school photograph rather than only ones they upload.
//
// Archive images are capped harder than new uploads: they are illustrations
// inside old posts, not hero material, and 350 full size photographs would
// otherwise sit in the repository forever.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const FROM = path.join(ROOT, "scrape", "images");
const TO = path.join(ROOT, "public", "images", "uploads");

const MAX_WIDTH = 1600;
const QUALITY = 80;

if (!fs.existsSync(FROM)) {
  console.error("scrape/images is missing. Run tools/download-images.mjs first.");
  process.exit(1);
}

fs.mkdirSync(TO, { recursive: true });

const files = fs.readdirSync(FROM).filter((f) => /\.(jpe?g|png|gif|webp)$/i.test(f));
let copied = 0;
let skipped = 0;
let bytes = 0;

for (const name of files) {
  const dest = path.join(TO, name);
  if (fs.existsSync(dest)) {
    skipped += 1;
    continue;
  }

  try {
    execFileSync("magick", [
      path.join(FROM, name),
      "-auto-orient",
      "-resize", `${MAX_WIDTH}x${MAX_WIDTH}>`,
      "-quality", String(QUALITY),
      "-strip",
      dest,
    ]);
    copied += 1;
    bytes += fs.statSync(dest).size;
  } catch (err) {
    console.warn(`  failed: ${name}`);
  }

  if (copied % 50 === 0 && copied > 0) console.log(`  ${copied} copied`);
}

const total = fs
  .readdirSync(TO)
  .reduce((n, f) => n + fs.statSync(path.join(TO, f)).size, 0);

console.log(`copied ${copied}, already present ${skipped}`);
console.log(`media folder now ${fs.readdirSync(TO).length} files, ${(total / 1024 / 1024).toFixed(1)} MB`);
