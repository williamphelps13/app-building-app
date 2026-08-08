import { PlanSchema, StackStateSchema } from "./schema";

/* ABA argues that an archive should outlive the app holding it, and
   until now kept everything in localStorage with no way out. This is
   the way out: one JSON blob, readable, restorable, and portable
   between the file on disk and any deployment. */

const KEYS = ["aba-plan", "aba-stack"] as const;

export interface Backup {
  format: "aba-backup";
  version: 1;
  savedAt: string;
  stores: Record<string, unknown>;
}

export function collect(): Backup {
  const stores: Record<string, unknown> = {};
  for (const key of KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) stores[key] = JSON.parse(raw);
    } catch { /* a store that will not read is one we cannot back up */ }
  }
  return {
    format: "aba-backup",
    version: 1,
    savedAt: new Date().toISOString(),
    stores,
  };
}

export interface RestoreResult {
  ok: boolean;
  message: string;
}

/* Validated before anything is written, so a malformed paste cannot
   half-restore and leave the app in a state neither backup nor
   current. */
export function restore(text: string): RestoreResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, message: "That is not JSON." };
  }

  const backup = parsed as Partial<Backup>;
  if (backup.format !== "aba-backup" || !backup.stores) {
    return { ok: false, message: "That is not an ABA backup." };
  }

  const schemas: Record<string, { safeParse: (v: unknown) => { success: boolean } }> = {
    "aba-plan": PlanSchema,
    "aba-stack": StackStateSchema,
  };

  const good: [string, unknown][] = [];
  for (const [key, value] of Object.entries(backup.stores)) {
    const schema = schemas[key];
    if (!schema) continue;
    if (!schema.safeParse(value).success) {
      return { ok: false, message: `The ${key} section does not match this version.` };
    }
    good.push([key, value]);
  }

  if (!good.length) return { ok: false, message: "Nothing in it could be read." };

  for (const [key, value] of good) {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
  return { ok: true, message: `Restored ${good.length} section${good.length === 1 ? "" : "s"}.` };
}
