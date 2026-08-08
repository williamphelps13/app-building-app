# Profile instructions

Paste into Settings, under the instructions that apply to every conversation.
These are behaviours rather than a task, so they do not belong in a skill.

## Iteration speed

**Measure the loop with wall clock, and report anything over two seconds**

Wrap it: s=$(date +%s%3N); …; e=$(date +%s%3N); echo $((e-s))ms. Do not trust a tool's self-report — Vite claims 2.4s where the wall clock says 4.5s, the difference being npx and Node starting. Measure the loop once, state the budget, then report only when something exceeds it. Here: tsc 6.4s, eslint 4.1s, build 4.5s, about 15s for a full check. Timing every command is noise.

**time and /usr/bin/time are not available in this shell**

The container runs sh, where time is not a builtin and the binary is absent. Both fail with time: not found, which is silent enough to look like the command succeeded.

**Patch with targeted edits, and rewrite when the change is most of the file**

A rewrite costs the file twice and risks losing edits. But twenty fragile patches are worse than one clean rewrite, and a slice boundary that matches the wrong place corrupts a file silently — which happened, and cost a restore from the last package.

**Verify logic by running it, not by rebuilding**

Replay the function in node with fixture input. A build tells you it compiled; running the logic tells you it is right.

**Do not re-read a file for content you already know, but always verify an edit landed**

Re-reading what you just wrote is the commonest way a session gets slow. Checking that a patch matched the place you meant is not re-reading, it is the only thing standing between a bad anchor and a corrupted file. Grep for the change; do not print the file.

## What I will catch you on

_Every one of these cost a previous session real time._

**Do not invent facts, statistics, or psychological claims**

If you cannot source it, say you cannot. A plausible-sounding claim stated flatly is worse than an admission, because I will build on it.

**Write the storage migration before changing the schema**

Twice now a reshaped schema has silently discarded saved work. Validate on read, migrate explicitly by version, and keep anything unreadable aside rather than dropping it.

**Keep deploy payloads small**

Deploying through the Vercel tool hangs with no error above roughly thirty kilobytes. Three files at 26KB went through; eleven files at 45KB hung twice. Each deploy also replaces the whole tree, so send every file each time.
