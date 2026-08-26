// Writes dist/_headers, which Cloudflare Pages applies to every response.
//
// On a preview build every path gets X-Robots-Tag: noindex, nofollow. That is
// the one instruction that reaches files with no HTML to carry a meta tag:
// photographs, PDFs and anything else in the media library. Google honours the
// header on any file type, and it applies even when the crawler ignores
// robots.txt.
//
// Runs after astro build. In production it writes only the admin rule, so the
// real site can be indexed.

import fs from "node:fs";
import path from "node:path";

const isProduction = process.env.IS_PRODUCTION === "true";
const out = path.resolve("dist/_headers");

const preview = `# Preview build. Nothing here should be indexed.
/*
  X-Robots-Tag: noindex, nofollow
`;

const production = `/admin/*
  X-Robots-Tag: noindex, nofollow
`;

if (!fs.existsSync(path.dirname(out))) {
  console.warn("  [headers] dist does not exist, skipping");
  process.exit(0);
}

fs.writeFileSync(out, isProduction ? production : preview);
console.log(
  isProduction
    ? "  [headers] production: /admin/* is noindex"
    : "  [headers] preview: everything is noindex, nofollow"
);
