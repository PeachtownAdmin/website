// Rebuilds the logo assets from the client JPEG.
//
// The source is flat dark green line art on white, which traces cleanly.
// Region boundaries were measured from the ink profile of the source rather
// than guessed, so the tree is never clipped. Re-measure with
// tools/measure-logo.py if the client ever supplies a new file.
//
// Requires imagemagick and potrace on PATH.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "assets-from-client", "peachtown-logo-fresh.jpg");
// SVGs live in src so they can be inlined and inherit currentColor.
const OUT = path.join(ROOT, "src", "assets", "logo");
const TMP = path.join(ROOT, "node_modules", ".cache", "logo");

// Brand green, sampled from the source.
const INK = "#0B2116";

// Measured ink bounds in the 1563x1563 source. width x height + x + y
const REGIONS = {
  "logo-mark": "805x612+379+263",
  "logo-lockup": "965x863+299+263",
};

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

for (const [name, crop] of Object.entries(REGIONS)) {
  const pbm = path.join(TMP, `${name}.pbm`);
  const svg = path.join(OUT, `${name}.svg`);

  // Upscale before thresholding so potrace sees smooth edges, not JPEG stairs.
  run("magick", [
    SRC,
    "-crop", crop,
    "+repage",
    "-colorspace", "Gray",
    "-resize", "300%",
    "-threshold", "60%",
    pbm,
  ]);

  run("potrace", [
    pbm,
    "--svg",
    "--turdsize", "8",
    "--alphamax", "1.0",
    "--opttolerance", "0.2",
    "--color", INK,
    "-o", svg,
  ]);

  // potrace emits a fixed pt size. Drop it and keep only the viewBox so the
  // SVG scales to whatever the CSS asks for. potrace already sets
  // preserveAspectRatio, so do not add a second one.
  let code = fs
    .readFileSync(svg, "utf8")
    .replace(/\s*width="[\d.]+pt"\s*height="[\d.]+pt"/, "")
    .replace(/<!DOCTYPE[^>]*>/, "")
    .replace(/<metadata>.*?<\/metadata>/gs, "")
    .replace(/<!--.*?-->/gs, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  // Emit with currentColor so one file works on paper and on green. The
  // traced fill is otherwise the near-black logo green, invisible on the dark
  // header.
  code = code.replace(new RegExp(INK, "gi"), "currentColor");

  fs.writeFileSync(svg, code + "\n");

  const kb = (fs.statSync(svg).size / 1024).toFixed(1);
  console.log(`${name}.svg  ${kb} KB  (from ${crop})`);
}

// Favicons rasterise from the source crop rather than the SVG, because
// ImageMagick's default security policy refuses to read SVG.
//
// The mark is near-black green, so it disappears against dark browser chrome.
// It sits on an opaque light circle to stay legible in both themes.
const DISC = "#FDFCF9";

// iOS composites a transparent touch icon onto black, so that one gets a full
// square plate instead of a disc.
for (const [file, size, shape] of [
  ["favicon.png", 64, "disc"],
  ["apple-touch-icon.png", 512, "square"],
]) {
  const inner = Math.round(size * 0.68);
  const r = size / 2;
  const mark = path.join(TMP, `mark-${size}.png`);

  run("magick", [
    SRC,
    "-crop", REGIONS["logo-mark"],
    "+repage",
    "-fuzz", "12%",
    "-transparent", "white",
    "-resize", `${inner}x${inner}`,
    mark,
  ]);

  const plate =
    shape === "disc"
      ? ["-size", `${size}x${size}`, "xc:none", "-fill", DISC, "-draw", `circle ${r},${r} ${r},0`]
      : ["-size", `${size}x${size}`, `xc:${DISC}`];

  run("magick", [
    ...plate,
    mark,
    "-gravity", "center",
    "-composite",
    "-strip",
    path.join(ROOT, "public", file),
  ]);

  console.log(`${file}  ${size}x${size}  ${shape} on ${DISC}`);
}

// SVG favicon, so modern browsers get a sharp icon at any size.
const markSvgCode = fs
  .readFileSync(path.join(OUT, "logo-mark.svg"), "utf8")
  .replace(/currentColor/g, INK);
const vb = markSvgCode.match(/viewBox="([\d. ]+)"/)[1].split(" ").map(Number);
const [, , vw, vh] = vb;
const side = Math.max(vw, vh) / 0.68;
const inner = markSvgCode.slice(markSvgCode.indexOf("<g"), markSvgCode.lastIndexOf("</svg>"));
fs.writeFileSync(
  path.join(ROOT, "public", "favicon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side.toFixed(0)} ${side.toFixed(0)}">
<circle cx="${(side / 2).toFixed(0)}" cy="${(side / 2).toFixed(0)}" r="${(side / 2).toFixed(0)}" fill="${DISC}"/>
<g transform="translate(${((side - vw) / 2).toFixed(0)},${((side - vh) / 2).toFixed(0)})">
${inner}</g>
</svg>
`
);
console.log("favicon.svg  scalable, on disc");
