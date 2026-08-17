// Moves the scraped Blogger posts into content/news so they are editable in
// the CMS.
//
// The whole archive is published, because the point is to port the old site
// rather than to start empty. Posts that were empty on the old site, or whose
// only image Google deleted years ago, are skipped entirely.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "scrape", "content", "posts");
const OUT = path.join(ROOT, "content", "news");
const MEDIA = path.join(ROOT, "public", "images", "uploads");

function parse(file) {
  const raw = fs.readFileSync(path.join(SRC, file), "utf8");
  const end = raw.indexOf("\n---", 3);
  const front = raw.slice(4, end);
  const body = raw.slice(raw.indexOf("\n", end + 1) + 1).trim();
  const get = (key) => front.match(new RegExp(`^${key}: "(.*)"$`, "m"))?.[1];
  return { title: get("title"), date: get("date"), legacyUrl: get("legacyUrl"), body };
}

// A post that is only a dead image is worth nothing to anyone.
function usableImages(body) {
  const refs = [...body.matchAll(/!\[[^\]]*\]\(\/images\/uploads\/([^)]+)\)/g)].map((m) => m[1]);
  return refs.filter((f) => fs.existsSync(path.join(MEDIA, f)));
}

function summarise(body) {
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 40) return "";
  const cut = text.slice(0, 180);
  const stop = cut.lastIndexOf(". ");
  return (stop > 60 ? cut.slice(0, stop + 1) : cut.trimEnd() + "...").trim();
}

fs.mkdirSync(OUT, { recursive: true });

let written = 0;
const skipped = [];

for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith(".md"))) {
  const post = parse(file);
  if (!post.date) continue;

  const images = usableImages(post.body);
  const prose = post.body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\s+/g, " ").trim();

  if (prose.length < 40 && images.length === 0) {
    skipped.push(file);
    continue;
  }

  // Drop references to images Google deleted, so the page has no broken frames.
  let body = post.body.replace(
    /!\[[^\]]*\]\(\/images\/uploads\/([^)]+)\)/g,
    (whole, name) => (fs.existsSync(path.join(MEDIA, name)) ? whole : "")
  );
  body = body.replace(/\n{3,}/g, "\n\n").trim();

  const summary = summarise(body);
  const hero = images[0];

  const front = [
    "---",
    `title: ${JSON.stringify(post.title || "Untitled")}`,
    `date: ${JSON.stringify(post.date.slice(0, 10))}`,
    summary ? `summary: ${JSON.stringify(summary)}` : null,
    hero ? `heroImage: ${JSON.stringify(`/images/uploads/${hero}`)}` : null,
    hero ? `heroImageAlt: ""` : null,
    "draft: false",
    post.legacyUrl ? `legacyUrl: ${JSON.stringify(post.legacyUrl)}` : null,
    "---",
    "",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  fs.writeFileSync(path.join(OUT, file), front + body + "\n");
  written += 1;
}

console.log(`wrote ${written} posts to content/news, all as drafts`);
if (skipped.length) {
  console.log(`skipped ${skipped.length} with no text and no surviving image:`);
  for (const s of skipped) console.log("  ", s);
}
