// Converts the raw Blogger JSON feeds into Markdown + an image manifest.
// See docs/content-migration.md for the full explanation.

import fs from "node:fs";
import path from "node:path";
import TurndownService from "turndown";

const ROOT = path.resolve(import.meta.dirname, "..");
const RAW = path.join(ROOT, "scrape", "raw");
const OUT = path.join(ROOT, "scrape", "content");

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});

// Blogger wraps images in a centering div and a self-link. Unwrap to a plain image.
td.addRule("bloggerImageLink", {
  filter: (node) =>
    node.nodeName === "A" &&
    node.childNodes.length === 1 &&
    node.firstChild.nodeName === "IMG",
  replacement: (_content, node) => td.turndown(node.firstChild.outerHTML),
});

// Drop tracking pixels and spacer images.
td.addRule("dropPixels", {
  filter: (node) =>
    node.nodeName === "IMG" &&
    (node.getAttribute("width") === "1" || node.getAttribute("height") === "1"),
  replacement: () => "",
});

const images = new Map();

// Blogger serves a resized variant. /s0/ returns the stored original.
function originalUrl(url) {
  if (!url.includes("blogger.googleusercontent.com")) return url;
  return url
    .replace(/\/(s|w)\d+(-h\d+)?(-[a-z-]+)?\//, "/s0/")
    .replace(/=[sw]\d+(-h\d+)?(-[a-z-]+)?$/, "=s0");
}

function localName(url) {
  const clean = originalUrl(url).split("?")[0];
  let base = decodeURIComponent(clean.split("/").pop().split("=")[0]);
  base = base.replace(/\+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!/\.(jpe?g|png|gif|webp|bmp)$/i.test(base)) base += ".jpg";
  // Blogger filenames repeat across posts, so prefix with a hash of the full URL.
  let h = 0;
  for (const ch of clean) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${h.toString(36)}-${base}`.slice(0, 90);
}

function collectImages(html) {
  for (const m of html.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    const src = m[1];
    if (src.includes("paypalobjects.com")) continue;
    if (src.includes("badge.facebook.com")) continue;
    if (!images.has(src)) {
      images.set(src, { source: src, download: originalUrl(src), file: localName(src) });
    }
  }
}

function rewriteImages(md) {
  return md.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (whole, alt, url) => {
    const hit = images.get(url);
    return hit ? `![${alt}](/images/legacy/${hit.file})` : whole;
  });
}

function slugFromUrl(url, fallback) {
  const last = url.split("/").pop().replace(/\.html$/, "");
  return last && last !== "blog-post" ? last : fallback;
}

function yamlString(s) {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function convert(entry, kind, index) {
  const title = entry.title.$t.trim();
  const html = entry.content?.$t ?? "";
  const alt = entry.link.find((l) => l.rel === "alternate")?.href ?? "";
  const published = entry.published.$t;
  const updated = entry.updated.$t;

  collectImages(html);

  let md = td.turndown(html);
  md = rewriteImages(md);
  // Blogger bodies are <br> soup, which turndown renders as trailing hard breaks.
  md = md
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const slug = slugFromUrl(alt, `${kind}-${index}`);
  const labels = (entry.category ?? []).map((c) => c.term);

  const fm = [
    "---",
    `title: ${yamlString(title || "Untitled")}`,
    `slug: ${yamlString(slug)}`,
    kind === "post" ? `date: ${yamlString(published)}` : null,
    `updated: ${yamlString(updated)}`,
    `legacyUrl: ${yamlString(alt)}`,
    labels.length ? `legacyLabels: [${labels.map(yamlString).join(", ")}]` : null,
    "draft: true",
    "---",
    "",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { slug, date: published, body: fm + md + "\n", empty: md.length < 20 };
}

function run(file, kind, outDir) {
  const feed = JSON.parse(fs.readFileSync(path.join(RAW, file), "utf8")).feed;
  const entries = feed.entry ?? [];
  fs.mkdirSync(outDir, { recursive: true });

  const report = [];
  entries.forEach((entry, i) => {
    const { slug, date, body, empty } = convert(entry, kind, i);
    const name = kind === "post" ? `${date.slice(0, 10)}-${slug}.md` : `${slug}.md`;
    fs.writeFileSync(path.join(outDir, name), body);
    report.push({ file: name, chars: body.length, empty });
  });
  return report;
}

fs.rmSync(OUT, { recursive: true, force: true });
const pages = run("pages.json", "page", path.join(OUT, "pages"));
const posts = run("posts.json", "post", path.join(OUT, "posts"));

const manifest = [...images.values()];
fs.writeFileSync(
  path.join(ROOT, "scrape", "image-manifest.json"),
  JSON.stringify(manifest, null, 2)
);

console.log(`pages:  ${pages.length}`);
console.log(`posts:  ${posts.length}`);
console.log(`images: ${manifest.length} unique`);
const empties = [...pages, ...posts].filter((r) => r.empty);
if (empties.length) {
  console.log(`\nnear-empty entries (${empties.length}):`);
  for (const e of empties) console.log("  ", e.file);
}
