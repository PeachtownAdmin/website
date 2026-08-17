// Renames media files so the library reads chronologically.
//
// Decap's media library has no sort control and no date display: it lists
// files in the order the backend returns them, which is alphabetical. The only
// lever is the filename, so each photo is prefixed with the date of the post
// it first appeared in. Files then group by year and month on their own.
//
// Idempotent: anything already carrying a date prefix is left alone.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MEDIA = path.join(ROOT, "public", "images", "uploads");
const CONTENT = [path.join(ROOT, "content", "news"), path.join(ROOT, "content", "pages")];
const SETTINGS = path.join(ROOT, "content", "settings");
const STAFF = path.join(ROOT, "content", "staff");

const DATED = /^\d{4}-\d{2}-\d{2}-/;

function contentFiles() {
  const files = [];
  for (const dir of [...CONTENT, SETTINGS, STAFF]) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (/\.(md|json)$/.test(name)) files.push(path.join(dir, name));
    }
  }
  return files;
}

// Earliest post that references each image wins, so a photo reused later keeps
// the date it was actually taken for.
const firstUse = new Map();
for (const file of contentFiles()) {
  const text = fs.readFileSync(file, "utf8");
  const date = path.basename(file).match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  for (const m of text.matchAll(/\/images\/uploads\/([^)"'\s]+)/g)) {
    const name = m[1];
    const known = firstUse.get(name);
    if (!date) {
      if (!known) firstUse.set(name, null);
    } else if (!known || date < known) {
      firstUse.set(name, date);
    }
  }
}

// Anything not referenced by a dated post sorts to the end under a fixed date.
const FALLBACK = "0000-00-00";

const renames = new Map();
for (const name of fs.readdirSync(MEDIA)) {
  if (DATED.test(name)) continue;
  const date = firstUse.get(name) ?? FALLBACK;
  const next = `${date}-${name}`;
  if (fs.existsSync(path.join(MEDIA, next))) continue;
  renames.set(name, next);
}

for (const [from, to] of renames) {
  fs.renameSync(path.join(MEDIA, from), path.join(MEDIA, to));
}

// Longest names first, so a short filename cannot corrupt a longer one that
// contains it.
const ordered = [...renames.entries()].sort((a, b) => b[0].length - a[0].length);

let touched = 0;
for (const file of contentFiles()) {
  const text = fs.readFileSync(file, "utf8");
  let next = text;
  for (const [from, to] of ordered) {
    next = next.replaceAll(`/images/uploads/${from}`, `/images/uploads/${to}`);
  }
  if (next !== text) {
    fs.writeFileSync(file, next);
    touched += 1;
  }
}

console.log(`renamed ${renames.size} files, updated ${touched} content files`);
