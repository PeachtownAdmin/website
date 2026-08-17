// Caps the size of images uploaded through the CMS.
//
// Editors upload straight off a phone or camera, and those files land in the
// git repo permanently. Astro's image pipeline cannot help here because CMS
// images live in public/ and are referenced by path at runtime.
//
// Resizes in place, keeps the filename and format so nothing breaks, and only
// touches files that are actually oversized, so re-running is cheap.
//
// Requires imagemagick. Runs automatically before build.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DIRS = ["public/images/uploads", "public/images/hero", "public/images/highlights"];

const MAX_WIDTH = 2000;
const MAX_BYTES = 500 * 1024;
const QUALITY = 82;

const EXT = /\.(jpe?g|png|webp)$/i;

let checked = 0;
let changed = 0;
let saved = 0;

for (const dir of DIRS) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) continue;

  for (const name of fs.readdirSync(full)) {
    if (!EXT.test(name)) continue;
    const file = path.join(full, name);
    const before = fs.statSync(file).size;
    checked += 1;

    let width = 0;
    try {
      width = Number(execFileSync("magick", ["identify", "-format", "%w", file]).toString());
    } catch {
      console.warn(`  could not read ${name}, skipping`);
      continue;
    }

    if (width <= MAX_WIDTH && before <= MAX_BYTES) continue;

    const args = [file, "-auto-orient"];
    if (width > MAX_WIDTH) args.push("-resize", `${MAX_WIDTH}x`);
    args.push("-quality", String(QUALITY), "-strip", file);

    execFileSync("magick", args);

    const after = fs.statSync(file).size;
    changed += 1;
    saved += before - after;
    console.log(
      `  ${name}: ${width}px ${(before / 1024).toFixed(0)}KB -> ` +
        `${Math.min(width, MAX_WIDTH)}px ${(after / 1024).toFixed(0)}KB`
    );
  }
}

const summary =
  changed === 0
    ? `uploads ok (${checked} checked)`
    : `uploads optimized (${changed} of ${checked}, saved ${(saved / 1024 / 1024).toFixed(1)} MB)`;
console.log(summary);
