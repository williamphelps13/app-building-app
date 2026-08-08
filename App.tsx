import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ASPECT_KEYS, DEFAULT_WEIGHTS, PlanSchema, StackStateSchema } from "./schema";
import type { AspectKey, Feature, Weights } from "./schema";
import { CONVENTIONS, DEFAULT_FEATURES, STACK } from "./data";
import {
  applyEdit, conventionsToMarkdown, copyText, rankLayer, sortAndFilter, stackToMarkdown, toMarkdown,
} from "./lib";
import type { Edge } from "./lib";
import { makeStore } from "./storage";
import {
  ActionSheet, Alert, FilledButton, Group, IconDecisions, IconEllipsis, IconEvidence,
  IconList, IconQuestion, IconTools, Row, SegmentedControl, Sheet, TabBar,
  cx, pressDim, usePress,
} from "./components/ios";
import {
  Controls, Dependencies, FeatureList, FeatureSheet,
} from "./components/PlanView";
import type { ControlState } from "./components/PlanView";
import { LoadView } from "./components/LoadView";
import { StackView } from "./components/StackView";
import { Placeholder } from "./components/Placeholder";
import { ConventionsView } from "./components/ConventionsView";
import { DeployView } from "./components/DeployView";
import { collect, restore } from "./backup";

/* Problem space and solution space are the book's top-level
   division, so they are the first two tabs. Everything below the
   pyramid — what you build it with — is a tool. */
const VIEWS = [
  { value: "problem", label: "Problem", icon: <IconQuestion /> },
  { value: "solution", label: "Solution", icon: <IconList /> },
  { value: "evidence", label: "Evidence", icon: <IconEvidence /> },
  { value: "decisions", label: "Decisions", icon: <IconDecisions /> },
  { value: "tools", label: "Tools", icon: <IconTools /> },
] as const;
type ViewKey = (typeof VIEWS)[number]["value"];

const TITLES: Record<ViewKey, string> = {
  problem: "Problem", solution: "Solution",
  evidence: "Evidence", decisions: "Decisions", tools: "Tools",
};

const SOLUTION_SEGMENTS = [
  { value: "features", label: "Features" },
  { value: "load", label: "Load" },
  { value: "requires", label: "Requires" },
] as const;
type SolutionSegment = (typeof SOLUTION_SEGMENTS)[number]["value"];

const TOOL_SEGMENTS = [
  { value: "stack", label: "Stack" },
  { value: "conventions", label: "Conventions" },
  { value: "deploy", label: "Deploy" },
] as const;
type ToolSegment = (typeof TOOL_SEGMENTS)[number]["value"];

const planStore = makeStore({
  key: "aba-plan",
  schema: PlanSchema,
  migrations: {
    // A bare array was the shape before the version field existed.
    0: (input) => ({ version: 1, features: Array.isArray(input) ? input : [] }),
  },
});

const stackStore = makeStore({
  key: "aba-stack",
  schema: StackStateSchema,
  migrations: { 0: (input) => ({ version: 1, ...(input as object) }) },
});

/* Seed values fill any field a stored feature is missing, so
   adding a field to the schema does not strand saved work. */
function merge(saved: Feature[]): Feature[] {
  const byId = new Map(saved.map((s) => [s.id, s]));
  return DEFAULT_FEATURES.map((d) => {
    const s = byId.get(d.id);
    return s ? { ...d, ...s, ratings: { ...d.ratings, ...s.ratings } } : d;
  });
}

export default function App() {
  const [items, setItems] = useState<Feature[]>(DEFAULT_FEATURES);
  const [view, setView] = useState<ViewKey>("solution");
  const [openId, setOpenId] = useState<string | null>(null);
  const [ctl, setCtl] = useState<ControlState>({
    sortA: "start", sortB: "worth", filterKey: "none", filterMin: 4,
  });
  const [exporting, setExporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pasted, setPasted] = useState("");
  const [restoreNote, setRestoreNote] = useState("");
  const [choices, setChoices] = useState<Record<string, string | null>>({});
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS);
  const [segment, setSegment] = useState<SolutionSegment>("features");
  const [tool, setTool] = useState<ToolSegment>("stack");

  const loaded = useRef(false);
  const scrollMemory = useRef<Record<ViewKey, number>>(
    { problem: 0, solution: 0, evidence: 0, decisions: 0, tools: 0 });
  const [collapsed, setCollapsed] = useState(false);
  const more = usePress();

  /* The large title gives way to an inline one, with a hairline
     appearing beneath it, the way a navigation bar does. */
  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 32);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Each tab keeps its own place, and tapping the tab you are
     already on returns you to the top. */
  const changeTab = useCallback((next: ViewKey) => {
    scrollMemory.current[view] = window.scrollY;
    if (next === view) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setView(next);
    requestAnimationFrame(() => window.scrollTo(0, scrollMemory.current[next]));
  }, [view]);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [plan, stack] = await Promise.all([planStore.load(), stackStore.load()]);
      if (!live) return;
      if (plan) setItems(merge(plan.features));
      if (stack) {
        setChoices(stack.choices);
        setWeights({ ...DEFAULT_WEIGHTS, ...stack.weights });
      }
      loaded.current = true;
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => void planStore.save({ version: 1, features: items }), 300);
    return () => clearTimeout(t);
  }, [items]);

  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => void stackStore.save({ version: 1, choices, weights }), 300);
    return () => clearTimeout(t);
  }, [choices, weights]);

  const mutate = useCallback((id: string, fn: (item: Feature) => Feature) => {
    setItems((prev) => prev.map((it) => (it.id === id ? fn(it) : it)));
  }, []);

  const nudgeEdge = useCallback((id: string, which: Edge, delta: number) => {
    mutate(id, (it) => applyEdit(it, which, it[which] + delta));
  }, [mutate]);

  const shown = useMemo(
    () => sortAndFilter(items, ctl.sortA, ctl.sortB, ctl.filterKey, ctl.filterMin),
    [items, ctl],
  );

  const activeKeys = [ctl.sortA, ctl.sortB, ctl.filterKey]
    .filter((k): k is AspectKey => (ASPECT_KEYS as readonly string[]).includes(k));

  const openItem = items.find((it) => it.id === openId) ?? null;

  /* One copy action, which takes whatever tab you are looking at. */
  const copyCurrent = () => {
    const text = view === "tools"
      ? (tool === "conventions"
        ? conventionsToMarkdown(CONVENTIONS)
        : stackToMarkdown(
          STACK, choices, Object.fromEntries(STACK.map((l) => [l.id, rankLayer(l, weights)]))))
      : toMarkdown(items);
    void copyText(text).then((ok) => {
      setCopied(ok);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="min-h-screen bg-grouped text-label antialiased">
      {/* Inline title, revealed once the large one scrolls away. */}
      <div
        className={cx(
          "fixed inset-x-0 top-0 z-40 border-b bg-grouped transition-opacity duration-200",
          collapsed ? "border-separator opacity-100" : "pointer-events-none border-transparent opacity-0",
        )}
      >
        <div className="mx-auto flex h-hit max-w-2xl items-center justify-center px-4">
          <span className="text-headline font-semibold">{TITLES[view]}</span>
        </div>
      </div>

      <header className="mx-auto max-w-2xl px-[max(1rem,env(safe-area-inset-left))] pt-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-large-title font-bold">{TITLES[view]}</h1>
          <button
            type="button"
            aria-label="More"
            onClick={() => setMenuOpen(true)}
            {...more.bind}
            className={cx("-mr-2 flex h-hit w-hit items-center justify-center text-tint", pressDim(more.pressed))}
          >
            <IconEllipsis />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-[max(1rem,env(safe-area-inset-left))] pt-5 pb-[calc(var(--spacing-tabbar)+2rem+env(safe-area-inset-bottom))]">
        {view === "problem" && (
          <Placeholder
            title="Problem"
            summary="Who this is for, what they are not being given, and what already exists. Everything in Solution should trace back to a need recorded here."
            sections={[
              {
                header: "Needs",
                lines: [
                  "A need, whose it is, and when",
                  "How important it is, one to five",
                  "How well the alternatives already serve it",
                  "The features that answer it",
                ],
              },
              {
                header: "Alternatives",
                lines: [
                  "What already exists, and what it covers",
                  "Where each one stops",
                  "Which needs it leaves unserved",
                ],
              },
            ]}
          />
        )}

        {view === "solution" && (
          <>
            <div className="mb-5">
              <SegmentedControl value={segment} options={[...SOLUTION_SEGMENTS]} onChange={setSegment} />
            </div>

            {segment === "features" && (
              <>
                <Controls ctl={ctl} set={(patch) => setCtl({ ...ctl, ...patch })}
                  shownCount={shown.length} total={items.length} />
                <FeatureList shown={shown} onOpen={setOpenId} activeKeys={activeKeys} />
              </>
            )}

            {segment === "load" && <LoadView items={items} mutate={mutate} />}

            {segment === "requires" && <Dependencies items={items} />}
          </>
        )}

        {view === "evidence" && (
          <Placeholder
            title="Evidence"
            summary="What you actually checked, and what it showed. Each record either supports or refutes something in Problem or Solution."
            sections={[
              {
                header: "A record holds",
                lines: [
                  "The question you set out to answer",
                  "What you did, and when",
                  "What it showed",
                  "What it supports or refutes",
                ],
              },
              {
                header: "Already worth entering",
                lines: [
                  "Does any archive app hand over at eighteen?",
                  "Can a browser query a domain registry directly?",
                  "What does an eighteen-year archive actually cost to store?",
                ],
              },
            ]}
          />
        )}

        {view === "decisions" && (
          <Placeholder
            title="Decisions"
            summary="What was settled, why, and what would have to change to reopen it. An open question is a decision that has not happened yet, so both live here."
            sections={[
              {
                header: "A record holds",
                lines: [
                  "The decision, and its status",
                  "Why, in your words",
                  "What was rejected, and on what grounds",
                  "What would reopen it",
                ],
              },
              {
                header: "Already worth entering",
                lines: [
                  "Dragging removed from the timeline",
                  "The domain, not the name, is the unit",
                  "mayaphelps.com over any sentimental name",
                  "No accounts: the handover is a file copy",
                ],
              },
            ]}
          />
        )}

        {view === "tools" && (
          <>
            <div className="mb-5">
              <SegmentedControl value={tool} options={[...TOOL_SEGMENTS]} onChange={setTool} />
            </div>

            {tool === "stack" && (
              <>
                <StackView choices={choices} weights={weights}
                  setChoices={setChoices} setWeights={setWeights} />

                <Group header="Elsewhere" footer="Runs on its own, with its own storage.">
                  <Row label="Domain shortlist"
                    onClick={() => window.open("https://domainshortlist.vercel.app", "_blank", "noopener")} />
                </Group>
              </>
            )}

            {tool === "conventions" && <ConventionsView />}

            {tool === "deploy" && <DeployView />}
          </>
        )}

      </main>

      <FeatureSheet
        item={openItem}
        open={!!openItem}
        onClose={() => setOpenId(null)}
        onNudge={nudgeEdge}
        mutate={mutate}
      />

      <ExportSheet items={items} open={exporting} onClose={() => setExporting(false)} />

      <Sheet title="Restore" open={restoring} onClose={() => setRestoring(false)}>
        <p className="mb-4 text-subheadline leading-relaxed text-label-2">
          Paste a backup. It is checked before anything is written, so a bad paste
          cannot leave you half restored.
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder="Paste the JSON here"
          className="mb-4 h-48 w-full resize-y rounded-group bg-elevated p-3 font-mono text-callout
            leading-relaxed text-label-2 placeholder:text-label-4 focus:outline-none"
        />
        {restoreNote && <p className="mb-4 text-subheadline leading-relaxed text-label-2">{restoreNote}</p>}
        <FilledButton onClick={() => {
          const result = restore(pasted);
          setRestoreNote(result.message);
          if (result.ok) setTimeout(() => window.location.reload(), 600);
        }}>
          Restore
        </FilledButton>
      </Sheet>

      <ActionSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        actions={[
          { label: view === "tools" && tool === "conventions" ? "Copy the conventions" : `Copy ${TITLES[view].toLowerCase()}`,
            onSelect: copyCurrent },
          {
            label: "Back up everything",
            onSelect: () => {
              void copyText(JSON.stringify(collect(), null, 2)).then((ok) => {
                setCopied(ok);
                setTimeout(() => setCopied(false), 1800);
              });
            },
          },
          { label: "Restore from a backup", onSelect: () => { setPasted(""); setRestoreNote(""); setRestoring(true); } },
          { label: "Export plan", onSelect: () => setExporting(true) },
          { label: "Reset to defaults", destructive: true, onSelect: () => setConfirmReset(true) },
        ]}
      />

      <Alert
        open={confirmReset}
        title="Reset to defaults?"
        message="Every rating, range, and note you have changed will be discarded."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setItems(DEFAULT_FEATURES);
          setOpenId(null);
          setConfirmReset(false);
        }}
      />

      {copied && (
        <p className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--spacing-tabbar)+1rem)] z-40
          text-center text-footnote text-label-2">
          Copied
        </p>
      )}

      <TabBar value={view} tabs={[...VIEWS]} onChange={changeTab} />
    </div>
  );
}

function ExportSheet({
  items, open, onClose,
}: { items: Feature[]; open: boolean; onClose: () => void }) {
  const [format, setFormat] = useState<"markdown" | "json">("markdown");
  const [copied, setCopied] = useState(false);
  const text = useMemo(
    () => (format === "json" ? JSON.stringify(items, null, 2) : toMarkdown(items)),
    [format, items],
  );

  return (
    <Sheet title="Export" open={open} onClose={onClose}>
      <div className="mb-4">
        <SegmentedControl
          value={format}
          options={[
            { value: "markdown" as const, label: "Markdown" },
            { value: "json" as const, label: "JSON" },
          ]}
          onChange={setFormat}
        />
      </div>

      <Group>
        <Row label="Lines" trailing={<span className="tabular-nums">{text.split("\n").length}</span>} />
        <Row label="Characters" trailing={<span className="tabular-nums">{text.length}</span>} />
      </Group>

      <textarea
        readOnly
        value={text}
        aria-label="Exported plan"
        /* 16px is the floor below which iOS zooms the page on focus. */
        className="mb-4 h-64 w-full resize-y rounded-group bg-elevated p-3 font-mono text-callout
          leading-relaxed text-label-2 focus:outline-none"
      />

      <FilledButton onClick={() => {
        void copyText(text).then((ok) => {
          setCopied(ok);
          setTimeout(() => setCopied(false), 1800);
        });
      }}>
        {copied ? "Copied" : "Copy to clipboard"}
      </FilledButton>
    </Sheet>
  );
}
