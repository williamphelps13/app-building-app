/* Folds the built CSS and JS into one self-contained index.html. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
const assets = readdirSync(join(dist, "assets"));
const cssFile = assets.find((f) => f.endsWith(".css"));
const jsFile = assets.find((f) => f.endsWith(".js"));
if (!cssFile || !jsFile) throw new Error("build output not found");

const read = (f) => readFileSync(join(dist, "assets", f), "utf8");

/* Swap each tag that references the asset for the asset itself.
   Matched by filename rather than by attribute order, so a change
   in how Vite emits the tag cannot silently skip the inlining. */
function inline(html, file, wrap) {
  const start = html.lastIndexOf("<", html.indexOf(file));
  if (start < 0) throw new Error(`no tag references ${file}`);
  const closeTag = html.startsWith("<script", start) ? "</script>" : ">";
  const end = html.indexOf(closeTag, html.indexOf(file)) + closeTag.length;
  return html.slice(0, start) + wrap(read(file)) + html.slice(end);
}

let html = readFileSync(join(dist, "index.html"), "utf8");
html = inline(html, cssFile, (css) => `<style>\n${css}\n</style>`);
html = inline(html, jsFile, (js) => `<script type="module">\n${js}\n</script>`);

/* Look for a tag still pointing at an asset, not the bare string:
   inlined code can legitimately contain "/assets/" as text. */
if (/(?:src|href)="\/assets\//.test(html)) {
  throw new Error("an asset reference survived inlining");
}

writeFileSync("aba.html", html);
console.log(`aba.html: ${(html.length / 1024).toFixed(0)} KB, fully self-contained`);
