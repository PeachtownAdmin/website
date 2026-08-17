// Builds content/staff from the old Our Staff page.
//
// That page turned out to be current, not stale as first assumed: it lists
// Jackie Schnurr as Head of School with a photograph and bio. Splitting it
// into one record per person means the school can edit or reorder people in
// the CMS without touching a wall of markup.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "content", "staff");

const STAFF = [
  {
    slug: "jackie-schnurr",
    name: "Jackie Schnurr",
    role: "Head of School",
    credentials: "B.S. Cornell University, Natural Resources; PhD Idaho State University, Biology",
    email: "jackie@peachtownschool.com",
    photo: "/images/uploads/frz4ye-Jackie-photo.jpg",
    photoAlt: "Jackie Schnurr, Head of School.",
    order: 10,
    body:
      "Jackie came to Peachtown after a 20 year career teaching plant biology " +
      "and environmental science courses at Wells College. When Wells closed, " +
      "Jackie found that her passion for hands-on, project-based education was " +
      "a great match for the Peachtown model.",
  },
  {
    slug: "sonjia-turner",
    name: "Sonjia Turner",
    role: "Lower Classroom Lead Teacher",
    credentials: "B.A. SUNY New Paltz, MSEd Elementary Education, K-6",
    email: "sonjia@peachtownschool.com",
    photo: "/images/uploads/dd7hmm-Sonjia-003.JPG",
    photoAlt: "Sonjia Turner, Lower Classroom Lead Teacher.",
    order: 20,
    body:
      "Sonjia has been working in child care and early childhood education for " +
      "more than 20 years. She teaches the Pre-K through third grade classroom " +
      "as well as lower level French. Sonjia is passionate about creating a " +
      "classroom full of problem solvers who love to learn.",
  },
  {
    slug: "alexis-shay",
    name: "Alexis (Lexi) Shay",
    role: "Upper Classroom Lead Teacher",
    credentials: "B.A. History, Wells College; M.A. History, SUNY Brockport",
    email: "alexis@peachtownschool.com",
    photo: "/images/uploads/p99mjp-Lexi-Photo.jpg",
    photoAlt: "Alexis Shay, Upper Classroom Lead Teacher.",
    order: 30,
    body:
      "Lexi has taught full time at Peachtown since 2023. She brings a wealth " +
      "of knowledge and an eagerness to give every student an excellent " +
      "education in a supportive environment. She is especially passionate " +
      "about History, Civics and Math.",
  },
  {
    slug: "barbara-post",
    name: "Barbara Post",
    role: "Music, and Vice President of the Board",
    credentials: "",
    email: "",
    photo: "",
    photoAlt: "",
    order: 40,
    body:
      "Barbara founded Peachtown in 1990 and was Head of School for more than " +
      "30 years, teaching several subjects along the way. She now teaches Music " +
      "part time in her retirement, and serves as Vice President on the Board " +
      "of Directors.",
  },
  {
    slug: "laura-evans",
    name: "Laura Evans",
    role: "Art",
    credentials: "",
    email: "",
    photo: "",
    photoAlt: "",
    order: 50,
    body:
      "Laura spent a career in education as a teacher, curriculum designer and " +
      "elementary principal, and now teaches Art in her retirement.",
  },
];

fs.mkdirSync(OUT, { recursive: true });

for (const person of STAFF) {
  const front = [
    "---",
    `name: ${JSON.stringify(person.name)}`,
    `role: ${JSON.stringify(person.role)}`,
    person.credentials ? `credentials: ${JSON.stringify(person.credentials)}` : null,
    person.email ? `email: ${JSON.stringify(person.email)}` : null,
    person.photo ? `photo: ${JSON.stringify(person.photo)}` : null,
    person.photo ? `photoAlt: ${JSON.stringify(person.photoAlt)}` : null,
    `order: ${person.order}`,
    "draft: false",
    "---",
    "",
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");

  fs.writeFileSync(path.join(OUT, `${person.slug}.md`), front + person.body + "\n");
  console.log(`  ${person.slug}.md`);
}

console.log(`wrote ${STAFF.length} staff records`);
