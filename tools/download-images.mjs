// Downloads every image in scrape/image-manifest.json at original resolution.
// Idempotent: existing files are skipped, so it is safe to re-run.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "scrape", "images");
const CONCURRENCY = 6;

const manifest = JSON.parse(
  fs.readFileSync(path.join(ROOT, "scrape", "image-manifest.json"), "utf8")
);
fs.mkdirSync(OUT, { recursive: true });

let done = 0;
const failed = [];

async function fetchOne(entry) {
  const dest = path.join(OUT, entry.file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return "skip";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(entry.download, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error("empty body");
      fs.writeFileSync(dest, buf);
      return "ok";
    } catch (err) {
      if (attempt === 3) {
        failed.push({ file: entry.file, url: entry.download, error: String(err) });
        return "fail";
      }
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

const queue = [...manifest];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const entry = queue.shift();
      await fetchOne(entry);
      if (++done % 25 === 0) console.log(`  ${done}/${manifest.length}`);
    }
  })
);

const bytes = fs
  .readdirSync(OUT)
  .reduce((n, f) => n + fs.statSync(path.join(OUT, f)).size, 0);

console.log(`\nfiles on disk: ${fs.readdirSync(OUT).length}`);
console.log(`total size:    ${(bytes / 1024 / 1024).toFixed(1)} MB`);
if (failed.length) {
  console.log(`\nfailed (${failed.length}):`);
  for (const f of failed) console.log("  ", f.file, f.error);
  fs.writeFileSync(
    path.join(ROOT, "scrape", "image-failures.json"),
    JSON.stringify(failed, null, 2)
  );
}
