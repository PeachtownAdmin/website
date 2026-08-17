// One-off: builds content/pages from the scraped Blogger pages, rewriting old
// absolute links to the new site structure. Re-running overwrites the ported
// pages, so hand edits belong in content/pages after this has been run.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "scrape", "content", "pages");
const OUT = path.join(ROOT, "content", "pages");

// Old page -> new path. Subject pages fold into Academics for now.
const LINKS = {
  "p/about-peachtown.html": "/about/",
  "p/academics.html": "/academics/",
  "p/admissions.html": "/admissions/",
  "p/scholarships.html": "/admissions/#tuition-and-scholarships",
  "p/payments-gifts.html": "/give/",
  "p/forms.html": "/forms/",
  "p/calendar.html": "/calendar/",
  "p/faqs.html": "/faqs/",
  "p/meet-teachers.html": "/about/",
  "p/foreign-languages.html": "/world-languages/",
  "p/lower-level-main-lesson.html": "/main-lesson/",
  "p/blog-page_9013.html": "/language-arts/",
  "p/blog-page_6562.html": "/math/",
  "p/blog-page_6796.html": "/science/",
  "p/blog-page_3337.html": "/music/",
  "p/blog-page_5573.html": "/fine-arts/",
  "p/blog-page_7582.html": "/drama/",
  "p/blog-page_8588.html": "/technology/",
  "p/blog-page_4358.html": "/physical-education/",
  "p/blog-page_25.html": "/press/",
};

function body(slug) {
  const raw = fs.readFileSync(path.join(SRC, `${slug}.md`), "utf8");
  const end = raw.indexOf("---", 3);
  return raw.slice(raw.indexOf("\n", end) + 1).trim();
}

function rewrite(md) {
  let out = md;
  for (const [oldPath, newPath] of Object.entries(LINKS)) {
    out = out.replaceAll(`http://www.peachtownschool.com/${oldPath}`, newPath);
  }
  // Any remaining subject page links point at Academics.
  out = out.replace(/http:\/\/www\.peachtownschool\.com\/p\/blog-page_\d+\.html/g, "/academics/");
  // Anything else on the old domain becomes a site relative path.
  out = out.replace(/https?:\/\/www\.peachtownschool\.com\/?/g, "/");
  // Strip Blogger's indentation first, so the emphasis rules below can match.
  out = out.replace(/^[ \t]+(?=\S)/gm, "");

  // Blogger left bold markers inside heading text.
  out = out.replace(/^(#{1,6})\s*\*\*(.+?)\*\*\s*$/gm, "$1 $2");

  // Staff used bold paragraphs where headings belonged, which is why the
  // ported pages had no hierarchy. A short line that is entirely bold becomes
  // an h2. Run-in bold at the start of a paragraph is left alone.
  out = out.replace(/^[ \t]*\*\*([^*\n]{2,80}?):?\*\*[ \t]*$/gm, (_m, text) => `## ${text.trim()}`);

  // A whole paragraph in bold is emphasis abuse, not a heading. Unbold it.
  out = out.replace(/^[ \t]*\*\*(.{81,}?)\*\*[ \t]*$/gm, "$1");

  // The daily timetable came through as a run of bold lines, which the rule
  // above turned into headings. A schedule is a list.
  out = out.replace(/^## (\d{1,2}:\d{2}\s+.*)$/gm, (_m, line) => {
    const [, time, rest] = line.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
    return `- **${time}** ${rest}`;
  });
  // Collapse the blank lines between consecutive schedule rows.
  out = out.replace(/(^- \*\*\d{1,2}:\d{2}\*\*.*$)\n\n(?=- \*\*\d)/gm, "$1\n");

  // Morning and Afternoon sit under A Typical Day, so they are one level down.
  out = out.replace(/^## (Morning|Afternoon)\s*$/gm, "### $1");

  // Blogger left empty links wrapping nothing, which render as stray marks.
  // The lookbehind keeps this off images, whose ![](url) would otherwise lose
  // its bracket half and leave a bare exclamation mark behind.
  out = out.replace(/(?<!!)\[[ \t\n]*\]\([^)]*\)/g, "");

  // A heading whose whole content is one link is a list item dressed as a
  // heading. The Press page used those for every article, which produced a
  // column of display type instead of a readable list.
  out = out.replace(/^#{1,6}[ \t]+(\[[^\]]+\]\([^)]+\))[ \t]*$/gm, "$1");

  // Empty headings left behind by Blogger's editor.
  out = out.replace(/^#{1,6}\s*$/gm, "");

  // Blogger indented with runs of non-breaking spaces. Four or more leading
  // spaces make Markdown treat the line as a code block, and any leading
  // space stops the bold-to-heading rules matching.
  out = out.replace(/^[ \t]+(?=\S)/gm, "");

  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function page(name, front, md) {
  const fm = Object.entries(front)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? JSON.stringify(v) : v}`)
    .join("\n");
  fs.writeFileSync(path.join(OUT, `${name}.md`), `---\n${fm}\n---\n\n${md}\n`);
  console.log(`  ${name}.md`);
}

fs.mkdirSync(OUT, { recursive: true });
console.log("wrote:");

page(
  "about",
  {
    title: "About Us",
    navLabel: "About",
    description:
      "An independent, non-sectarian day school for Pre-K through grade 8 in Aurora, New York, founded in 1990.",
    navGroup: "main",
    order: 10,
    draft: false,
    legacyUrl: "http://www.peachtownschool.com/p/about-peachtown.html",
  },
  rewrite(body("about-peachtown"))
);

page(
  "academics",
  {
    title: "Academics",
    description:
      "The Peachtown curriculum: multi-age classrooms, interdisciplinary Main Lesson study, world languages, and no standardised testing.",
    navGroup: "main",
    order: 20,
    draft: false,
    legacyUrl: "http://www.peachtownschool.com/p/academics.html",
  },
  rewrite(body("academics"))
);

page(
  "admissions",
  {
    title: "Admissions",
    description:
      "How to apply to Peachtown, what it costs, and how to arrange a visit.",
    navGroup: "main",
    order: 30,
    draft: false,
    legacyUrl: "http://www.peachtownschool.com/p/admissions.html",
  },
  // Tuition was a separate page. It is one decision for a parent, so it is
  // merged in here under an anchor.
  `${rewrite(body("admissions"))}\n\n## Tuition and scholarships\n\n${rewrite(
    body("scholarships")
  )}`
);

page(
  "give",
  {
    title: "Give",
    description: "Support Peachtown Elementary School.",
    navGroup: "main",
    order: 40,
    draft: false,
    legacyUrl: "http://www.peachtownschool.com/p/payments-gifts.html",
  },
  [
    "Peachtown is a small non-profit school. Tuition covers only part of what",
    "it costs to run the program, so gifts from families, alumni and neighbors",
    "make up the difference.",
    "",
    "Every gift stays with the school. There is no endowment and no parent",
    "company, and donations go straight into classroom materials, the arts",
    "program, and scholarships for families who need them.",
    "",
    "Peachtown is a registered non-profit, so gifts are tax deductible.",
  ].join("\n")
);

page(
  "calendar",
  {
    title: "Calendar",
    description: "Term dates, events and performances at Peachtown.",
    navGroup: "utility",
    order: 10,
    draft: false,
    legacyUrl: "http://www.peachtownschool.com/p/calendar.html",
  },
  [
    "Term dates, performances, open houses and closures are all listed here.",
    "",
    "The calendar is kept up to date by the school office. If something looks",
    "wrong, or you are not sure whether school is running, contact the office.",
  ].join("\n")
);

page(
  "forms",
  {
    title: "Forms",
    description: "Application, registration, financial aid and required medical forms.",
    navGroup: "utility",
    parent: "admissions",
    order: 20,
    draft: false,
    legacyUrl: "http://www.peachtownschool.com/p/forms.html",
  },
  rewrite(body("forms"))
);

page(
  "contact",
  {
    title: "Contact",
    description: "Reach the Peachtown office, or arrange a visit to the school.",
    navGroup: "utility",
    order: 30,
    draft: false,
  },
  [
    "To arrange a visit or ask about the program, contact the",
    "[Head of School](/staff/).",
    "",
    "Peachtown Elementary School  ",
    "22 Dean's Rd.  ",
    "Aurora, NY 13026",
    "",
    "School runs Monday to Thursday, 8:45 am to 4:15 pm, with after school care",
    "until 4:30 pm.",
  ].join("\n")
);

// The rest of the old site. Subject pages sit under Academics, and Staff and
// Press are linked from About. All editable, none in the top menu.
const EXTRA = [
  ["main-lesson", "Main Lesson", "lower-level-main-lesson", 10, "academics"],
  ["language-arts", "Language Arts", "blog-page_9013", 20, "academics"],
  ["math", "Math", "blog-page_6562", 30, "academics"],
  ["science", "Science", "blog-page_6796", 40, "academics"],
  ["fine-arts", "Fine Arts", "blog-page_5573", 50, "academics"],
  ["music", "Music", "blog-page_3337", 60, "academics"],
  ["drama", "Drama", "blog-page_7582", 70, "academics"],
  ["world-languages", "World Languages", "foreign-languages", 80, "academics"],
  ["technology", "Technology", "blog-page_8588", 90, "academics"],
  ["physical-education", "Physical Education", "blog-page_4358", 100, "academics"],
  ["press", "Press", "blog-page_25", 120, "about"],
];

for (const [slug, title, source, order, parent] of EXTRA) {
  const md = rewrite(body(source));
  page(
    slug,
    {
      title,
      description: `${title} at Peachtown Elementary School.`,
      navGroup: "none",
      parent,
      order,
      // The old Science page was empty, so it starts hidden rather than
      // shipping a blank page as the live site does today.
      draft: md.length < 40,
      legacyUrl: `http://www.peachtownschool.com/p/${source}.html`,
    },
    md || "This page has not been written yet."
  );
}

page(
  "staff",
  {
    title: "Our Staff",
    description: "The teachers and administrators at Peachtown Elementary School.",
    navGroup: "none",
    parent: "about",
    order: 20,
    draft: false,
    legacyUrl: "http://www.peachtownschool.com/p/meet-teachers.html",
  },
  [
    "Peachtown encourages cooperative learning for its students and cooperative",
    "teaching for its teachers and administrators. We work as a team and often",
    "pull from each other's experience and expertise. The result is a tight knit",
    "and highly cooperative community of learners.",
    "",
    "Peachtown also employs adjunct teachers in Art, Music, World Languages and",
    "other subjects as needed.",
  ].join("\n")
);

page(
  "faqs",
  {
    title: "FAQs",
    description: "Common questions about Peachtown Elementary School.",
    navGroup: "none",
    parent: "about",
    order: 50,
    draft: false,
    legacyUrl: "http://www.peachtownschool.com/p/faqs.html",
  },
  rewrite(body("faqs"))
);
