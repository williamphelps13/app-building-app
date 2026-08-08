/*
 * Generates the uploadable skill and the profile instructions from
 * src/data/brief.json, so the app, the skill and the settings text
 * never drift apart.
 *
 *   node scripts/skill.mjs
 *
 * Output:
 *   skills/ios-web-prototypes/SKILL.md   ready to zip and upload
 *   skills/profile-instructions.md       paste into Settings
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const NAME = "iOS-style web prototypes";
const DESCRIPTION =
  "Build React PWA prototypes in Apple's pre-Liquid-Glass iOS style with Tailwind v4 tokens, "
  + "shipping a source zip plus a single-file HTML preview. Use when building or revising a prototype UI.";

/* Anthropic caps these, and a skill that exceeds them is rejected. */
if (NAME.length > 64) throw new Error(`name is ${NAME.length} chars, limit is 64`);
if (DESCRIPTION.length > 200) throw new Error(`description is ${DESCRIPTION.length} chars, limit is 200`);

const doc = JSON.parse(readFileSync("src/data/conventions.json", "utf8"));
const forAudience = (a) => doc.sections.filter((s) => s.audience === a);

const body = (sections) => sections.flatMap((s) => [
  `## ${s.header}`,
  "",
  ...(s.summary ? [`_${s.summary}_`, ""] : []),
  ...s.rules.flatMap((r) => [`**${r.rule}**`, "", r.why, ""]),
]);

mkdirSync("skills/ios-web-prototypes", { recursive: true });

writeFileSync("skills/ios-web-prototypes/SKILL.md", [
  "---",
  `name: ${NAME}`,
  `description: ${DESCRIPTION}`,
  "---",
  "",
  `# ${NAME}`,
  "",
  "Conventions for building prototypes with me. If a project ships an ABA app,",
  "its Decisions tab overrides anything here.",
  "",
  ...body(forAudience("skill")),
].join("\n"));

writeFileSync("skills/profile-instructions.md", [
  "# Profile instructions",
  "",
  "Paste into Settings, under the instructions that apply to every conversation.",
  "These are behaviours rather than a task, so they do not belong in a skill.",
  "",
  ...body(forAudience("profile")),
].join("\n"));

const count = (a) => forAudience(a).reduce((n, s) => n + s.rules.length, 0);
console.log(`SKILL.md: ${count("skill")} rules · profile: ${count("profile")} rules`);
console.log(`description: ${DESCRIPTION.length}/200 chars`);
