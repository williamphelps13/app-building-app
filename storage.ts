import type { ZodType } from "zod";

/* ============================================================
   Persistence

   One adapter, one place that touches storage. Reads are
   validated, so anything unparseable is discarded rather than
   spread into state. Migrations are explicit functions keyed
   by the version they upgrade from.
   ============================================================ */

type Migration = (input: unknown) => unknown;

export interface Store<T> {
  load(): Promise<T | null>;
  save(value: T): Promise<void>;
}

interface Options<T> {
  key: string;
  schema: ZodType<T>;
  /** migrations[n] upgrades a version-n payload to version n+1. */
  migrations?: Record<number, Migration>;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, json: string): void {
  try {
    window.localStorage.setItem(key, json);
  } catch {
    /* quota or a blocked context: keep working in memory */
  }
}

function versionOf(value: unknown): number {
  if (value && typeof value === "object" && "version" in value) {
    const v = (value as { version: unknown }).version;
    if (typeof v === "number") return v;
  }
  return 0;
}

export function makeStore<T>({ key, schema, migrations = {} }: Options<T>): Store<T> {
  return {
    async load() {
      const raw = readRaw(key);
      if (!raw) return null;

      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        return null;
      }

      // Walk the payload forward one version at a time.
      let guard = 0;
      while (migrations[versionOf(value)] && guard++ < 20) {
        const step = migrations[versionOf(value)];
        if (!step) break;
        value = step(value);
      }

      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        /* Keep the original rather than dropping it, so a bad
           migration is recoverable instead of destructive. */
        writeRaw(`${key}-unreadable`, raw);
        console.warn(
          `[aba] "${key}" did not match its schema and was set aside as "${key}-unreadable"`,
          parsed.error.issues,
        );
        return null;
      }
      return parsed.data;
    },

    async save(value) {
      writeRaw(key, JSON.stringify(value));
    },
  };
}
