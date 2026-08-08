import { z } from "zod";
import featuresJson from "./data/features.json";
import stackJson from "./data/stack.json";
import conventionsJson from "./data/conventions.json";
import deployJson from "./data/deploy.json";
import { ConventionsSchema, DeployGuideSchema, FeatureSchema, StackLayerSchema } from "./schema";
import type { Conventions, DeployGuide, Feature, StackLayer } from "./schema";

/* Seed content lives in JSON so it can be edited, diffed, and
   swapped without touching the UI. Parsed here so a malformed
   edit fails at startup with a useful message. */

export const DEFAULT_FEATURES: Feature[] = z.array(FeatureSchema).parse(featuresJson);
export const STACK: StackLayer[] = z.array(StackLayerSchema).parse(stackJson);
export const CONVENTIONS: Conventions = ConventionsSchema.parse(conventionsJson);
export const DEPLOY: DeployGuide = DeployGuideSchema.parse(deployJson);
