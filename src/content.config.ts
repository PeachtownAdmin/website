import { defineCollection, z } from "astro:content";
import { glob, file } from "astro/loaders";

// Content lives in /content at the repo root rather than under src, so the
// CMS paths stay short and readable for non-technical editors.

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/pages" }),
  schema: z.object({
    title: z.string(),
    navLabel: z.string().optional(),
    description: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    order: z.number().default(0),
    // main is the primary menu, utility is the small strip above it for
    // families who already attend.
    navGroup: z.enum(["none", "main", "utility"]).default("none"),
    // Slug of the page this one sits under. Drives the menu dropdowns and the
    // sidebar on interior pages.
    parent: z.string().optional(),
    draft: z.boolean().default(false),
    legacyUrl: z.string().optional(),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string().optional(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    draft: z.boolean().default(true),
    legacyUrl: z.string().optional(),
    legacyLabels: z.array(z.string()).optional(),
  }),
});

const staff = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/staff" }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    credentials: z.string().optional(),
    email: z.string().optional(),
    photo: z.string().optional(),
    photoAlt: z.string().optional(),
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

const settings = defineCollection({
  loader: file("./content/settings/site.json", { parser: (text) => [{ id: "site", ...JSON.parse(text) }] }),
  schema: z.object({
    id: z.string(),
    schoolName: z.string(),
    shortName: z.string(),
    tagline: z.string().optional(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string(),
    }),
    phone: z.string().optional(),
    email: z.string().optional(),
    officeHours: z.string().optional(),
    facebookUrl: z.string().optional(),
    googleCalendarId: z.string().optional(),
    paypalTuitionButtonId: z.string().optional(),
    paypalDonationButtonId: z.string().optional(),
  }),
});

// A photo plus the point that stays centred when it is cropped. x and y are
// percentages, chosen with the crop widget, and map onto CSS object-position.
const focalImage = z.object({
  src: z.string(),
  x: z.number().default(50),
  y: z.number().default(50),
});

const homepage = defineCollection({
  loader: file("./content/settings/home.json", {
    parser: (text) => [{ id: "home", ...JSON.parse(text) }],
  }),
  schema: z.object({
    id: z.string(),
    heroEyebrow: z.string().optional(),
    heroHeading: z.string(),
    heroLede: z.string().optional(),
    heroSlides: z.array(z.object({ image: focalImage, alt: z.string() })).min(1),
    highlightsEyebrow: z.string().optional(),
    highlightsHeading: z.string(),
    highlightsLede: z.string().optional(),
    highlights: z
      .array(
        z.object({
          image: focalImage,
          alt: z.string(),
          tag: z.string(),
          title: z.string(),
          note: z.string(),
        })
      )
      .default([]),
    missionEyebrow: z.string().optional(),
    missionQuote: z.string(),
    heroPrimaryLabel: z.string().default("Schedule a visit"),
    heroPrimaryHref: z.string().default("/admissions/"),
    heroSecondaryLabel: z.string().optional(),
    heroSecondaryHref: z.string().optional(),
    newsEyebrow: z.string().default("From the school"),
    facts: z
      .array(z.object({ figure: z.string(), label: z.string() }))
      .default([]),
    quickLinks: z
      .array(
        z.object({
          label: z.string(),
          note: z.string().optional(),
          href: z.string(),
          icon: z.enum(["calendar", "form", "megaphone", "envelope"]).default("calendar"),
        })
      )
      .default([]),
  }),
});

export const collections = { pages, news, staff, settings, homepage };
