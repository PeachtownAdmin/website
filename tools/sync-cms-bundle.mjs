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

// Decap has no way to sort the media library, and no hook for it either.
// Reordering the rendered cards was tried and does not hold, so the file list
// is sorted at the source instead: the one method every backend funnels media
// through. This is a data-level change, so it does not care how the library is
// laid out or when React re-renders it.
//
// The anchor is checked below and the build fails if it is ever missing, so a
// Decap upgrade cannot quietly drop the ordering.
const MEDIA_ANCHOR = "getMedia(){return this.implementation.getMedia()}";
const MEDIA_PATCHED =
  "getMedia(){return Promise.resolve(this.implementation.getMedia())" +
  ".then(window.__ptSortMedia)}";

// Newest first, undated last. The date comes from the filename, which
// tools/date-media.mjs stamps with the date of the post the photo first
// appeared in.
const MEDIA_SORTER = `window.__ptSortMedia=function(files){
if(!Array.isArray(files))return files;
var re=/(\\d{4})-(\\d{2})-(\\d{2})-/;
var key=function(f){
var m=re.exec((f&&(f.name||f.path))||"");
return m&&m[1]!=="0000"?Number(m[1]+m[2]+m[3]):-1;
};
return files.slice().sort(function(a,b){
var d=key(b)-key(a);
if(d)return d;
return String((a&&(a.name||a.path))||"").localeCompare(String((b&&(b.name||b.path))||""));
});
};
`;

if (!fs.existsSync(FROM)) {
  console.error("decap-cms bundle not found. Run npm install first.");
  process.exit(1);
}

// Deliberately not a delete-then-recreate. This runs on every `npm run dev`,
// and wiping the directory under a dev server that is already serving those
// files makes the admin panel 404 until the server is restarted.
fs.mkdirSync(TO, { recursive: true });

const wanted = new Set();
let count = 0;
let written = 0;
let bytes = 0;
let patched = false;

for (const name of fs.readdirSync(FROM)) {
  if (!include(name)) continue;
  wanted.add(name);
  const dest = path.join(TO, name);
  let code = fs.readFileSync(path.join(FROM, name), "utf8").replace(SOURCE_MAP_REF, "\n");

  if (name === "decap-cms.js") {
    if (!code.includes(MEDIA_ANCHOR)) {
      console.error(
        "decap-cms no longer contains the media sort anchor.\n" +
          "Media would silently fall back to alphabetical order.\n" +
          "See docs/cms-choice.md and re-find the getMedia method."
      );
      process.exit(1);
    }
    code = MEDIA_SORTER + code.replace(MEDIA_ANCHOR, MEDIA_PATCHED);
    patched = true;
  }
  count += 1;
  bytes += Buffer.byteLength(code);

  const current = fs.existsSync(dest) ? fs.readFileSync(dest, "utf8") : null;
  if (current !== code) {
    fs.writeFileSync(dest, code);
    written += 1;
  }
}

// Drop chunks left behind by an older version of the bundle.
for (const name of fs.readdirSync(TO)) {
  if (!wanted.has(name)) fs.rmSync(path.join(TO, name), { force: true });
}

if (count === 0) {
  console.error("no files matched, check the decap-cms dist layout");
  process.exit(1);
}

console.log(
  `decap synced (${count} files, ${(bytes / 1024 / 1024).toFixed(1)} MB, ` +
    `${written === 0 ? "already current" : `${written} updated`}` +
    `${patched ? ", media sort patched" : ""})`
);
