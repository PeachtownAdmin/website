import { defineConfig } from "astro/config";
import { rehypeGallery } from "./src/plugins/rehype-gallery.mjs";

// SITE_URL is set per deployment. Nothing else in the project hardcodes a
// domain, so moving between the preview subdomain, .com and .org is one env var.
const site = process.env.SITE_URL || "http://localhost:4321";

// Preview builds must not be indexed. Set IS_PRODUCTION=true only for the
// real public deploy.
const isProduction = process.env.IS_PRODUCTION === "true";

export default defineConfig({
  site,
  trailingSlash: "always",
  build: { format: "directory" },
  // The dev toolbar overlays the bottom of every page during development,
  // which gets in the way of reviewing layout from screenshots.
  devToolbar: { enabled: false },
  markdown: {
    rehypePlugins: [rehypeGallery],
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  vite: {
    define: {
      __IS_PRODUCTION__: JSON.stringify(isProduction),
    },
  },
});
