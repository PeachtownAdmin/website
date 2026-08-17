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
    showInNav: z.boolean().default(false),
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

export const collections = { pages, news, staff, settings };
