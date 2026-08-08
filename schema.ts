import { z } from "zod";

/* ============================================================
   Vocabulary
   ============================================================ */

export const CADENCE = {
  daily: { label: "Daily", perWeek: 7 },
  weekly: { label: "Weekly", perWeek: 1 },
  monthly: { label: "Monthly", perWeek: 0.23 },
  seasonal: { label: "A few times a year", perWeek: 0.06 },
  yearly: { label: "Once a year", perWeek: 0.02 },
  rare: { label: "Rarely", perWeek: 0.005 },
} as const;
export const CADENCE_KEYS = Object.keys(CADENCE) as CadenceKey[];
export type CadenceKey = keyof typeof CADENCE;

/* Rough megabytes per entry. */
export const WEIGHTS = {
  text: { label: "Text", mb: 0.01 },
  photo: { label: "Photo", mb: 4 },
  audio: { label: "Audio", mb: 1 },
  video: { label: "Video", mb: 60 },
} as const;
export const WEIGHT_KEYS = Object.keys(WEIGHTS) as WeightKey[];
export type WeightKey = keyof typeof WEIGHTS;

export const NEEDS = {
  media: "Media store",
  text: "Text store",
  camera: "Camera",
  mic: "Microphone",
  people: "People list",
  reminders: "Reminders",
  charts: "Charts",
  sync: "Two-account sync",
  print: "Export or print",
} as const;
export const NEED_KEYS = Object.keys(NEEDS) as NeedKey[];
export type NeedKey = keyof typeof NEEDS;

export const FIELD_TYPES = [
  "text", "long text", "number", "date", "photo", "video", "audio", "person", "list",
] as const;

export const ASPECTS = [
  { key: "worth", label: "Worth", full: "Worth having", kind: "good" },
  { key: "loss", label: "Loss", full: "Lost if you skip it", kind: "good" },
  { key: "build", label: "Build", full: "Work to build", kind: "cost" },
  { key: "upkeep", label: "Upkeep", full: "Work to keep up", kind: "cost" },
] as const;
export const ASPECT_KEYS = ASPECTS.map((a) => a.key);
export type AspectKey = (typeof ASPECTS)[number]["key"];
export type Aspect = (typeof ASPECTS)[number];

export const CRITERIA = [
  { key: "life", label: "Readable in 20 years" },
  { key: "port", label: "Easy to leave" },
  { key: "quick", label: "Quick to build" },
  { key: "fast", label: "Fast day to day" },
  { key: "cheap", label: "Cheap to run" },
] as const;
export type CriterionKey = (typeof CRITERIA)[number]["key"];

export const SORTS = [
  { key: "start", label: "Start of range" },
  { key: "handoff", label: "Handover point" },
  { key: "name", label: "Name" },
  ...ASPECTS.map((a) => ({ key: a.key, label: a.full })),
] as const;
export type SortKey = (typeof SORTS)[number]["key"];

/* ============================================================
   Stored shapes
   ============================================================ */

const score = z.number().int().min(0).max(5);

export const FieldSchema = z.object({
  name: z.string(),
  type: z.enum(FIELD_TYPES),
});

export const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  blurb: z.string(),
  start: z.number(),
  handoff: z.number(),
  end: z.number(),
  cadence: z.enum(CADENCE_KEYS as [CadenceKey, ...CadenceKey[]]),
  weight: z.enum(WEIGHT_KEYS as [WeightKey, ...WeightKey[]]),
  ratings: z.object({ worth: score, loss: score, build: score, upkeep: score }),
  needs: z.array(z.enum(NEED_KEYS as [NeedKey, ...NeedKey[]])),
  fields: z.array(FieldSchema),
  note: z.string(),
});

export const PlanSchema = z.object({
  version: z.literal(1),
  features: z.array(FeatureSchema),
});

export const BUCKETS = ["brainstorm", "potential", "rejected"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const BUCKET_LABEL: Record<Bucket, string> = {
  brainstorm: "Brainstorm",
  potential: "Potential",
  rejected: "Rejected",
};

export const AVAILABILITY = ["available", "registered", "unsupported", "invalid", "error"] as const;
export type Availability = (typeof AVAILABILITY)[number];

/* A candidate is one domain: a name plus a suffix. Suffixes of the
   same name are judged separately, because they are separate
   purchases at separate prices. */
export const CandidateSchema = z.object({
  domain: z.string(),
  name: z.string(),
  suffix: z.string(),
  bucket: z.enum(BUCKETS),
  state: z.enum(AVAILABILITY),
  purchase: z.number().nullable(),
  renewal: z.number().nullable(),
  /* Whatever you were actually quoted, when that differs. */
  price: z.string(),
  note: z.string(),
  /* True when a check filed it rather than you. */
  auto: z.boolean(),
  checkedAt: z.number(),
});

export const NamesStateSchema = z.object({
  version: z.literal(2),
  /* Words still being considered, with no suffix attached yet. */
  names: z.array(z.string()),
  suffixes: z.array(z.string()),
  candidates: z.array(CandidateSchema),
});

export const StackStateSchema = z.object({
  version: z.literal(1),
  choices: z.record(z.string(), z.string().nullable()),
  weights: z.object({
    life: score, port: score, quick: score, fast: score, cheap: score,
  }),
});

export type Field = z.infer<typeof FieldSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type Candidate = z.infer<typeof CandidateSchema>;
export type NamesState = z.infer<typeof NamesStateSchema>;
export type StackState = z.infer<typeof StackStateSchema>;
export type Weights = StackState["weights"];

/* ============================================================
   Stack content, validated at load so a bad edit to the JSON
   fails loudly instead of rendering blank cards.
   ============================================================ */

export const StackOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  tech: z.array(z.string()),
  build: z.string(),
  desc: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  scores: z.object({
    life: score, port: score, quick: score, fast: score, cheap: score,
  }),
});

export const StackLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  question: z.string(),
  options: z.array(StackOptionSchema).min(2).max(3),
});

export type StackOption = z.infer<typeof StackOptionSchema>;
export type StackLayer = z.infer<typeof StackLayerSchema>;

export const DEFAULT_WEIGHTS: Weights = { life: 3, port: 3, quick: 2, fast: 2, cheap: 1 };

/* Suffixes worth checking, and the ones checked by default. */
export const SUFFIXES = ["com", "app", "page", "day", "ink", "family", "studio"] as const;
export const DEFAULT_SUFFIXES = ["com", "app"];


/* Standing defaults, read by whoever picks this up next. */
export const ConventionRuleSchema = z.object({
  rule: z.string(),
  why: z.string(),
});

export const ConventionSectionSchema = z.object({
  id: z.string(),
  header: z.string(),
  /* Only where it says something the rules cannot. */
  summary: z.string().optional(),
  /* skill: task-triggered, packaged for Customize > Skills.
     profile: always-on behaviour, pasted into profile settings. */
  audience: z.enum(["skill", "profile"]),
  rules: z.array(ConventionRuleSchema),
});

export const ConventionsSchema = z.object({
  title: z.string(),
  intro: z.string(),
  sections: z.array(ConventionSectionSchema),
});

export type ConventionSection = z.infer<typeof ConventionSectionSchema>;
export type Conventions = z.infer<typeof ConventionsSchema>;

export const DeployGuideSchema = z.object({
  title: z.string(),
  intro: z.string(),
  steps: z.array(z.object({ step: z.string(), detail: z.string() })),
  notes: z.array(z.object({ note: z.string(), detail: z.string() })),
});
export type DeployGuide = z.infer<typeof DeployGuideSchema>;

export const DEFAULT_NAMES = [
  // With her name in it
  "dearmaya", "formaya", "keptformaya", "mayasdaybook", "mayasyears",
  "onedaymaya", "hellomaya", "allofmaya", "everydaymaya",
  "mayasfirsteighteen", "mayasownwords", "formayatokeep",
  // Without
  "keptforyou", "thesmallyears", "beforeyouremember", "onedayyours",
  "thefirsteighteen", "whileyouweresmall", "howyoubegan", "thestoryofyou",
  "forwhenyouareolder", "everylittleday", "keptsafeforyou", "thedayswehad",
];

