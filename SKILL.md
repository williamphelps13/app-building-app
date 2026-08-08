---
name: iOS-style web prototypes
description: Build React PWA prototypes in Apple's pre-Liquid-Glass iOS style with Tailwind v4 tokens, shipping a source zip plus a single-file HTML preview. Use when building or revising a prototype UI.
---

# iOS-style web prototypes

Conventions for building prototypes with me. If a project ships an ABA app,
its Decisions tab overrides anything here.

## Output

**Hand over both files after any change to the app**

The zip is for working on, the HTML file is what I open on my phone. Do not weigh up whether a change is worth packaging: once the build has run — which it had to, to know the change works — the zip takes 14ms and the copy 7ms. Skip them only when nothing changed, such as a question or an explanation.

**Put the files at the end of the turn, with nothing after them**

The card renders where it is called, so files followed by an explanation means scrolling back up past the explanation to reach the preview. Prose first, files last, and never a summary afterwards. On a phone the bottom of the message is where my thumb already is.

**Where there is a build, make the preview by inlining its output**

A script swaps each asset tag for the asset itself, and throws if any reference survives, because a silent failure produces a file that opens blank. If the project is already a single page with no build step, that page is the preview.

**Make it installable only when it is meant to be installed**

A manifest and service worker are right for something that lives on a home screen. On a throwaway they cost time and cause the worst prototype bug there is: a stale cached bundle that makes a fix look like it did not work.

## Styling

**Tailwind v4 through @tailwindcss/vite, with no tailwind.config.js**

Configuration moved into CSS in v4. A config file means you are working from v3 habits.

**One @theme block holds every colour, size, and radius**

Components use semantic names — bg-canvas, text-muted, border-line — never bg-zinc-900. Changing the palette should be one file, and nothing outside it should name a hue or a pixel.

**Reach for a token, not an arbitrary value**

An arbitrary value is an escape hatch, and needing one usually means a token is missing. Reach for the nearest existing token first — a theme full of single-use tokens is the same problem wearing better clothes. Add one when the value recurs or carries meaning: min-h-[57px] became min-h-sheet-row because every action sheet row uses it.

**The exception is values the device supplies, not values you chose**

env(safe-area-inset-*), viewport units, and calc() combining them cannot be tokens because they are not design decisions. This codebase has nine arbitrary values and every one is of that kind. Anything else is a missing token.

**Use a real build for anything meant to grow**

An artifact is a single file against a prebuilt stylesheet, so arbitrary values and opacity modifiers silently do not exist and you end up hand-writing CSS around them. That workaround is the tell. Artifacts are still the right tool for something disposable that should render inline; the rule is about anything that will be iterated on.

## Interaction

**Follow the Human Interface Guidelines, and do not restate them here**

developer.apple.com/design/human-interface-guidelines. This applies to phone-first prototypes, which is nearly everything I ask for. A wide dashboard or a dense data table is not an iPhone screen, and forcing inset grouped lists onto one makes it worse. Do not retype the guidelines into these conventions: Apple maintains them and our copy would rot.

## Where we depart from the guidelines

_One deliberate exception. Anything else is a mistake, not a house style._

**Deviation: no Liquid Glass, no blur materials**

This is a deliberate departure from the current HIG, not an oversight. Glass depends on the system compositor sampling what is behind it, which a browser cannot do convincingly, and a bad imitation reads as a web app pretending to be native. Use opaque elevated greys on black. If you read the live HIG and conclude this brief is out of date, this is why it is not.

## What the guidelines do not cover

_Apple never documents these because Apple is not building web apps, which is why they are written down rather than linked._

**Press feedback: 60ms delay, cancelled by 8px of movement, instant in, 300ms fade out**

UIKit delays the highlight and drops it the moment a gesture becomes a scroll. Plain :active does neither, so every scroll lights up whatever your finger landed on. Rows highlight their background; buttons dim their content to about 30%.

**touch-action: pan-y on anything with a horizontal gesture, and lock direction before acting**

Otherwise a vertical scroll starting on a control is captured as a drag. Require more sideways travel than downward before committing, and move by delta from the grab point rather than jumping to the finger.

**Type ramp in rem, and no focusable text under 16px**

17pt body is 1.0625rem; fixed pixels ignore the system text size setting. Separately, Safari zooms the page when you focus an input smaller than 16px, so no input, textarea or select goes below it.

**Separators inset from the leading edge, suppressed on the last row**

A list row draws its own border, and one CSS rule removes it from the final child. This is the detail that most reliably separates a convincing grouped list from an approximate one.

**Measured values the HIG does not state: 32pt segmented control, 57pt action sheet row, 88px swipe action**

Taken from the system controls rather than the documentation. Treat them as fixed. Adjusting a platform metric because something feels small is how an app drifts off-platform one decision at a time.

**Chevron for navigation, info button for detail**

A disclosure indicator means the row leads to the next level of a hierarchy. An info button means the row explains itself. They are not interchangeable, and a chevron on a row that opens an explanation is a promise the row does not keep.

## Making it installable

_Only when it is meant to live on a home screen. Then do it properly._

**Three meta tags get you full screen, and nothing else**

apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style and apple-mobile-web-app-title make a pinned site open without Safari chrome. They do not give you an icon and they do not give you offline. Claiming otherwise is the mistake I made: ABA shipped with those three tags and I called it a PWA that works offline, when its home screen icon was a screenshot of the page.

**iOS ignores the manifest and reads apple-touch-icon**

A 180 by 180 PNG at the site root, declared with link rel=apple-touch-icon. Manifest icons are for Android and for Chrome's install prompt. Ship both or iOS gets nothing.

**No transparency and no rounded corners on the icon**

iOS applies its own mask. Pre-rounding gives a double-rounded icon with dark corners, and transparency shows as black. Draw to the square edges and let the system cut it.

**The manifest needs 192, 512, and a 512 marked maskable**

Chrome will not offer to install without the 512. The maskable one is separate artwork, not the same file relabelled: Android crops aggressively, so keep everything inside the centre 80 percent and let the outer ring be background.

**Design it at 512 and judge it at 60**

The home screen renders it small. Anything with more than a few elements turns to mush, and text below about four characters wide stops being readable. Check the small size before the large one.

**A service worker is what makes it work offline, and what makes a fix look broken**

Without one there is no offline, whatever the meta tags say. With one, a stale cache serves the old bundle after a redeploy and the fix appears not to have worked. Version the cache name and claim clients on activate, or do not add it at all.

## Deploying

_Vercel is the host. Size decides how the files get there, not where they go._

**Vercel hosts everything, whatever the size**

It is paid for and it runs the functions. Never migrate a project to another host because it outgrew the chat connector: that is a delivery problem, not a hosting one, and switching loses the URL, the environment variables and the deployment history.

**Deploy through the chat connector only when the site is a few small files**

The connector sends every file inline in one message. Three files at 26KB went through immediately; eleven files at 45KB hung twice with no error. Above that, hand over the zip and I deploy with npx vercel --prod from a computer, to the same project.

**Do not distort the architecture to stay under the limit**

The limit is a property of one delivery route, not a design goal. Inlining everything into one file to keep a deploy possible buys a live URL at the cost of the codebase. If a prototype genuinely needs a URL early, that is a reason to keep it a small no-build page from the start — decided up front, not discovered by cramming.

**Every deploy replaces the entire tree**

There is no merge with what is already there. Sending only the changed file publishes a site consisting of that file. Send every file, every time.

**New projects are protected by default**

A fresh Vercel project has Vercel Authentication on, so the URL bounces to a login and looks broken on a phone. Turn it off under Deployment Protection.

**Environment variables cannot be set from chat, and secrets must not be pasted into it**

There is no tool for writing them, and a token in a transcript can deploy, delete projects and buy domains. Build the function to degrade without the secret: ours falls back to a keyless lookup and simply shows no prices.

## Mock data

_Mirror the shape and scale of the real thing, not its volume._

**Record the real scale in the data contract, separately from the fixture**

Write down that photos will number in the thousands over eighteen years, even when the fixture holds four. The number in the contract is what design decisions are made against.

**Never let fixture volume drive a product decision**

Four images in the mock is not a reason to skip the carousel. If you find yourself arguing against a feature because the sample is small, you are reading the fixture as the requirement.

**Keep a note of what is fake and in what way**

Which fields are real shapes with placeholder values, which are invented entirely, and which are real data. This becomes the migration checklist when the prototype turns into the tool.
