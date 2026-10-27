// Measures the platform against the standards in docs/29-apple-notion-standards.md, page by page, as each kind of person sees it:
//
//   axe          WCAG 2.2 AA and best practice, by axe-core, in the light scheme and in the dark one
//   keyboard     a Tab walk: a skip link first, a visible mark on every stop (measured as a picture, with and without focus), nothing
//                hidden under a fixed bar, the person's menu closing on Escape, quick find opening from the keyboard
//   text size    the text at 200 % (what Dynamic Type and the browser's font setting do): sideways scrolling, clipped text, text that
//                is set in a fixed size and so does not follow the person's setting, text that lands on other text
//   reflow       the page at 320 px wide (400 % zoom on a desk): nothing wider than the screen outside a table or a code block
//   motion       what is still moving when the person has asked for less motion
//   appearance   the page follows the system's dark setting; it keeps working under "increase contrast" and forced colours
//   touch        controls smaller than 44 px on a phone (Apple's minimum; WCAG's own floor is 24 px)
//   names        controls and links named "here", "more", "view", and the same words going to different places
//   feedback     the source: a timer that is not one of the three known ones (search debounce, "5 minutes ago" refresh, page refresh) could
//                be closing a message by itself, which the standard forbids (S10)
//
// It reports; it changes nothing. Exit code 1 only with A11Y_STRICT=1 and at least one finding, so it can be a gate once clean.
//
//   bash scripts/e2e/live-up.sh && node scripts/e2e/pm-e2e.cjs        (leaves a client with a site and a box, to look at)
//   node scripts/e2e/a11y-audit.cjs [output directory]
//
// Needs Playwright with a Chromium (PLAYWRIGHT_MODULE) and axe-core (AXE_MODULE, the folder of the package): neither is a
// dependency of the repository (npm i -g playwright axe-core).
//   A11Y_ONLY=axe,keyboard      run only those checks (axe, keyboard, text, reflow, motion, appearance, touch, names, feedback)
//   A11Y_PAGES=sites            only the pages whose address matches this expression
//   A11Y_SHOTS=1                also keep a picture of every page in each appearance (light, dark, increase contrast, forced colours)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const { mkdirSync, writeFileSync, readFileSync, readdirSync } = require("fs");
const { join, relative } = require("path");
const { tmpdir } = require("os");
const { base, SIZES, PUBLIC_PATHS, PLANS, signIn } = require("./lib/tour.cjs");

const OUT = process.argv[2] ?? join(process.env.E2E_DIR ?? join(tmpdir(), "greecon-e2e"), "a11y");
mkdirSync(OUT, { recursive: true });
const AXE = readFileSync(require.resolve(`${process.env.AXE_MODULE ?? "axe-core"}/axe.min.js`), "utf8");
const ONLY = process.env.A11Y_ONLY ? new Set(process.env.A11Y_ONLY.split(",")) : null;
const PAGES = process.env.A11Y_PAGES ? new RegExp(process.env.A11Y_PAGES) : null;
const SHOTS = process.env.A11Y_SHOTS === "1";
const wants = (check) => !ONLY || ONLY.has(check);
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const MAX_TABS = 90;

// ---- What is found ------------------------------------------------------------------------------------------------------------
const found = new Map(); // "check | detail" -> { check, detail, where: Set }
const reviewed = new Set(); // contrast that axe could not measure: what it was, for a person to look at
function note(check, detail, where) {
  const key = `${check} | ${detail}`;
  if (!found.has(key)) found.set(key, { check, detail, where: new Set() });
  found.get(key).where.add(where);
}

// ---- In the source ------------------------------------------------------------------------------------------------------------
// S10: nothing is dismissed by a timer. A browser cannot show that a message that is not there was once there, so the source is read:
// every timer in the web app is one of these, each for a reason that is not closing a message.
const TIMERS_ALLOWED = new Map([
  ["components/QuickFind.tsx", "waits a moment after a key before asking the server what matches"],
  ["components/Ago.tsx", "re-draws '5 minutes ago' as time passes"],
  ["components/LiveRefresh.tsx", "fetches the page again so that status is never left out of date"]
]);

function sourceScan() {
  const root = join(__dirname, "..", "..", "apps", "web", "src");
  const walk = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    });
  let timers = 0;
  for (const file of walk(root)) {
    const name = relative(root, file).split("\\").join("/");
    const count = (readFileSync(file, "utf8").match(/\b(setTimeout|setInterval)\s*\(/g) ?? []).length;
    timers += count;
    if (count && !TIMERS_ALLOWED.has(name)) note("feedback", `a timer in ${name}: if it closes a message, nothing may (S10); add it to TIMERS_ALLOWED with its reason if it does not`, "source");
  }
  return timers;
}

// ---- In the page --------------------------------------------------------------------------------------------------------------
// Each of these runs inside the page (they are serialised, so they may use nothing from outside).

function inPageDescribe() {
  window.__describe = (el) => {
    if (!el || !el.tagName) return "";
    const name = (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.textContent || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 28);
    const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return `${el.tagName.toLowerCase()}${cls}${name ? ` "${name}"` : ""}`;
  };
}

// Things that have a box but are not on the screen: what a closed disclosure holds (except its own summary), what sits in a box clipped
// to nothing (a table's header row on a phone, text kept for a screen reader), and anything marked visually hidden.
function inPageHidden() {
  window.__hidden = (el) => {
    if (el.classList && el.classList.contains("visually-hidden")) return true;
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (parent.classList && parent.classList.contains("visually-hidden")) return true;
      // Any closed disclosure above it hides it, unless it is that disclosure's own summary (or inside it).
      if (parent.tagName === "DETAILS" && !parent.open) {
        const summary = parent.querySelector(":scope > summary");
        if (!summary || !summary.contains(el)) return true;
      }
      const rect = parent.getBoundingClientRect();
      if (rect.width <= 2 && rect.height <= 2) return true;
    }
    return false;
  };
}

function measureTouch(phone) {
  const out = [];
  const selector = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"]';
  for (const el of document.querySelectorAll(selector)) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || el.closest("[hidden], [inert]") || window.__hidden(el)) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    // A link inside a sentence is a target by its words (WCAG 2.5.8 exempts it); a visually hidden control is not on screen at all.
    const inSentence = el.tagName === "A" && [...(el.parentElement?.childNodes ?? [])].some((node) => node.nodeType === 3 && node.textContent.trim());
    if (inSentence || (rect.width <= 1 && rect.height <= 1)) continue;
    // A checkbox or radio is drawn small and answered through its label: the label is the target.
    const label = el.labels && el.labels[0];
    const box = (el.type === "checkbox" || el.type === "radio") && label ? label.getBoundingClientRect() : rect;
    out.push({ what: window.__describe(el), width: Math.round(box.width), height: Math.round(box.height) });
  }
  return out;
}

function measureNames() {
  const generic = /^(here|more|view|open|details|go|link|click here|read more|learn more|see more|info|click)$/i;
  const out = { generic: [], clash: [] };
  const byName = new Map();
  for (const el of document.querySelectorAll("a[href], button")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const name = (el.getAttribute("aria-label") || el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (generic.test(name)) out.generic.push(window.__describe(el));
    if (el.tagName === "A") {
      const where = new URL(el.href, location.href).pathname;
      if (!byName.has(name)) byName.set(name, new Set());
      byName.get(name).add(where);
    }
  }
  for (const [name, places] of byName) if (places.size > 1 && name.length < 24 && !/^(Open for setup|Set up|Edit|Details|Open)$/.test(name)) out.clash.push(`"${name}" goes to ${[...places].slice(0, 3).join(", ")}${places.size > 3 ? "…" : ""}`);
  return out;
}

function measureText() {
  // Every element that holds its own words, in document order, with its size and where it sits.
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let el = walker.nextNode(); el; el = walker.nextNode()) {
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName) || el.closest("svg")) continue; // a drawing scales with its box, and says nothing its text beside it does not
    const own = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    if (!own) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || window.__hidden(el)) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    // Text that is only for a screen reader is clipped to 1 px on purpose.
    if (rect.width <= 1 || rect.height <= 1) continue;
    out.push({ size: parseFloat(style.fontSize), what: window.__describe(el), text: el.textContent.trim().slice(0, 24) });
  }
  return out;
}

function measureLayout() {
  const out = { overflow: document.documentElement.scrollWidth - window.innerWidth, clipped: [], overlapping: [], spilling: [], wide: [] };
  // Where each line of an element's own words is drawn. An element's box is not that: a phrase that wraps has a box that takes in the whole
  // block, and so "overlaps" the words beside it that it does not touch.
  const linesOf = (el) => {
    const lines = [];
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const line of range.getClientRects()) if (line.width > 2 && line.height > 2) lines.push(line);
    }
    return lines;
  };
  const inScroller = (el) => {
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const overflowX = getComputedStyle(parent).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
    return false;
  };
  const boxes = [];
  for (const el of document.querySelectorAll("body *")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName) || el.closest("svg")) continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || window.__hidden(el)) continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.width <= 1 || rect.height <= 1) continue;
    const own = [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    // Words that are cut off: a box that hides what overflows it, and has more inside than it shows.
    if (own && (style.overflow !== "visible" || style.textOverflow === "ellipsis") && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && style.overflowX !== "auto" && style.overflowX !== "scroll") {
      out.clipped.push(`${window.__describe(el)} ${el.clientWidth}x${el.clientHeight} of ${el.scrollWidth}x${el.scrollHeight}`);
    }
    if (rect.right > window.innerWidth + 1 && !inScroller(el) && style.position !== "fixed" && !el.closest(".visually-hidden") && !el.classList.contains("visually-hidden") && rect.width > 1) out.wide.push(`${window.__describe(el)} ends at ${Math.round(rect.right)}px`);
    if (own && rect.width > 4 && rect.height > 4 && style.position !== "absolute" && !el.classList.contains("visually-hidden")) {
      const lines = linesOf(el);
      boxes.push({ el, rect, lines, what: window.__describe(el) });
      // Words that spill out of their own box (an initials circle, a chip, a fixed-width cell) without being cut off: a box that is
      // laid out as a block or a flexible box, with a width of its own, and a line of words that goes past its side.
      if (!style.display.startsWith("inline") && style.display !== "contents" && style.overflow === "visible" && !inScroller(el)) {
        const spill = lines.reduce((worst, line) => Math.max(worst, rect.left - line.left, line.right - rect.right), 0);
        if (spill > 2) out.spilling.push(`${window.__describe(el)} by ${Math.round(spill)}px`);
      }
    }
  }
  // Words on top of other words: two lines of text that share more than a fifth of the smaller one, from elements that do not hold each other.
  for (let a = 0; a < boxes.length && out.overlapping.length < 8; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      if (boxes[a].el.contains(boxes[b].el) || boxes[b].el.contains(boxes[a].el)) continue;
      if (Math.min(boxes[a].rect.right, boxes[b].rect.right) - Math.max(boxes[a].rect.left, boxes[b].rect.left) <= 2) continue;
      if (Math.min(boxes[a].rect.bottom, boxes[b].rect.bottom) - Math.max(boxes[a].rect.top, boxes[b].rect.top) <= 2) continue;
      const hit = boxes[a].lines.some((one) =>
        boxes[b].lines.some((two) => {
          const x = Math.min(one.right, two.right) - Math.max(one.left, two.left);
          const y = Math.min(one.bottom, two.bottom) - Math.max(one.top, two.top);
          if (x <= 2 || y <= 2) return false;
          return (x * y) / Math.min(one.width * one.height, two.width * two.height) > 0.2;
        })
      );
      if (hit) out.overlapping.push(`${boxes[a].what} over ${boxes[b].what}`);
    }
  }
  return out;
}

function measureMotion() {
  return document
    .getAnimations()
    .filter((animation) => animation.playState === "running")
    .map((animation) => {
      const timing = animation.effect && animation.effect.getComputedTiming ? animation.effect.getComputedTiming() : {};
      const target = animation.effect && animation.effect.target;
      return { name: animation.animationName || animation.transitionProperty || "", infinite: timing.iterations === Infinity, duration: timing.duration, target: window.__describe(target && target.closest ? target : null) };
    });
}

function measureAppearance() {
  const rgb = (value) => (value.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
  const lum = (channels) => {
    const [r, g, b] = channels.slice(0, 3).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const bodyColour = rgb(getComputedStyle(document.body).backgroundColor);
  const htmlColour = rgb(getComputedStyle(document.documentElement).backgroundColor);
  const background = bodyColour[3] === 0 ? htmlColour : bodyColour;
  return { luminance: lum(background), colorScheme: getComputedStyle(document.documentElement).colorScheme, lang: document.documentElement.lang, title: document.title, headings: document.querySelectorAll("h1").length };
}

// ---- Checks -------------------------------------------------------------------------------------------------------------------

async function runAxe(page, where) {
  await page.addScriptTag({ content: AXE });
  const result = await page.evaluate(async (tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags }, resultTypes: ["violations", "incomplete"] }), AXE_TAGS);
  for (const violation of result.violations) {
    const sample = violation.nodes.slice(0, 3).map((node) => node.target.join(" ").slice(0, 70)).join(" | ");
    note(`axe ${violation.id} (${violation.impact})`, `${violation.help}: ${violation.nodes.length} element${violation.nodes.length === 1 ? "" : "s"}, e.g. ${sample}`, where);
  }
  // "Could not be decided" matters for contrast: axe could not read a background (a picture drawn in SVG, text made by CSS). Those are
  // listed apart, as what a person must look at, and not counted as findings; docs/29 says how each kind was measured another way.
  for (const item of result.incomplete) {
    if (item.id !== "color-contrast") continue;
    for (const node of item.nodes) reviewed.add(`${node.target.join(" ").replace(/:nth-child\(\d+\)/g, "").replace(/\[y="[^"]*"\]/g, "").slice(0, 60)}`);
  }
}

async function appearance(page, where, scheme) {
  const result = await page.evaluate(measureAppearance);
  if (!result.lang) note("page", "the page has no language (html lang)", where);
  if (!result.title || result.title.length < 3) note("page", "the page has no title", where);
  if (scheme === "dark" && result.luminance > 0.4) note("appearance", "the page stays light when the system is set to dark", where);
  if (scheme === "dark" && !/dark/.test(result.colorScheme)) note("appearance", `the page does not say it supports a dark scheme (color-scheme is "${result.colorScheme}"), so scrollbars and form controls stay light`, where);
  return result;
}

async function touch(page, where) {
  const targets = await page.evaluate(measureTouch, true);
  for (const target of targets) {
    if (Math.min(target.width, target.height) < 24) note("touch", `control under 24 px (WCAG 2.5.8): ${target.what} ${target.width}x${target.height}`, where);
    else if (Math.min(target.width, target.height) < 44) note("touch", `control under 44 px on a phone: ${target.what.split(" ")[0]} ${target.width}x${target.height}`, where);
  }
}

async function names(page, where) {
  const result = await page.evaluate(measureNames);
  for (const item of result.generic) note("names", `a control named only "here", "more" or "view": ${item}`, where);
  for (const item of result.clash) note("names", `the same words go to different places: ${item}`, where);
}

async function textSize(page, where, size) {
  const before = await page.evaluate(measureText);
  const style = await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.waitForTimeout(150);
  const after = await page.evaluate(measureText);
  const layout = await page.evaluate(measureLayout);
  // The same words, in the same order, before and after: those that did not grow are set in a size that ignores the person's setting.
  if (before.length === after.length) {
    const fixed = [];
    before.forEach((item, index) => {
      if (item.size >= 8 && after[index].size / item.size < 1.4) fixed.push(`${item.what.split(" ")[0]} ${item.size}px`);
    });
    if (fixed.length) note("text size", `${fixed.length} text element${fixed.length === 1 ? "" : "s"} do not follow the person's text size (set in px): ${[...new Set(fixed)].slice(0, 5).join(", ")}`, where);
  }
  if (layout.overflow > 1) note("text size", `at 200 % the page scrolls sideways by ${layout.overflow}px`, `${where}`);
  for (const item of [...new Set(layout.clipped)].slice(0, 5)) note("text size", `at 200 % words are cut off: ${item}`, where);
  for (const item of [...new Set(layout.overlapping)].slice(0, 5)) note("text size", `at 200 % text lands on text: ${item}`, where);
  for (const item of [...new Set(layout.spilling)].slice(0, 5)) note("text size", `at 200 % words spill out of their box: ${item}`, where);
  await style.evaluate((node) => node.remove());
  void size;
}

async function reflow(browser, storageState, url, where) {
  // 320 px wide is 400 % zoom on a 1280 px screen (WCAG 1.4.10).
  const context = await browser.newContext({ viewport: { width: 320, height: 568 }, storageState, bypassCSP: true });
  const page = await context.newPage();
  await page.goto(base + url, { waitUntil: "networkidle" });
  await page.evaluate(inPageDescribe);
  await page.evaluate(inPageHidden);
  await page.waitForTimeout(400);
  const layout = await page.evaluate(measureLayout);
  if (layout.overflow > 1) note("reflow", `at 320 px the page scrolls sideways by ${layout.overflow}px`, where);
  for (const item of [...new Set(layout.wide)].slice(0, 4)) note("reflow", `at 320 px content is wider than the screen: ${item}`, where);
  for (const item of [...new Set(layout.clipped)].slice(0, 4)) note("reflow", `at 320 px words are cut off: ${item}`, where);
  for (const item of [...new Set(layout.overlapping)].slice(0, 4)) note("reflow", `at 320 px text lands on text: ${item}`, where);
  for (const item of [...new Set(layout.spilling)].slice(0, 4)) note("reflow", `at 320 px words spill out of their box: ${item}`, where);
  await context.close();
}

async function motion(page, where, reduced) {
  const running = await page.evaluate(measureMotion);
  if (!reduced) return running;
  for (const item of running) {
    // A very short transition is a change of state, not motion; an animation that repeats, or runs for long, is motion.
    if (item.infinite || (typeof item.duration === "number" && item.duration > 300)) note("motion", `still moving when the person asked for less motion: ${item.name || "animation"} on ${item.target}`, where);
  }
  return running;
}

// Tab through the page. `rings` remembers what each kind of control looks like when focused, so a stylesheet rule is measured once.
const rings = new Map();
async function keyboard(page, where, size) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  const seen = new Set();
  let stops = 0;
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press("Tab");
    if (i <= 1) await page.waitForTimeout(240); // the skip link slides into view, and out again at the next stop: each is measured once it has settled
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const all = document.getElementsByTagName("*");
      const index = Array.prototype.indexOf.call(all, el);
      const rect = el.getBoundingClientRect();
      const cx = Math.min(Math.max(rect.left + rect.width / 2, 0), window.innerWidth - 1);
      const cy = Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1);
      const top = document.elementFromPoint(cx, cy);
      const covered = top && !(el.contains(top) || top.contains(el)) ? window.__describe(top) : "";
      const parent = el.parentElement;
      const signature = `${el.tagName}.${typeof el.className === "string" ? el.className : ""}|${el.getAttribute("role") || ""}|${el.getAttribute("type") || ""}|${parent && typeof parent.className === "string" ? parent.className : ""}`;
      return { index, what: window.__describe(el), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, covered, signature, inMain: !!el.closest("main"), href: el.getAttribute("href") || "", offscreen: rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth, tabindex: el.getAttribute("tabindex") };
    });
    if (!stop) break; // focus has left the page
    if (seen.has(stop.index)) break; // and come round again
    seen.add(stop.index);
    stops++;
    // A page whose first stop is already inside <main> (a sign-in form, a notice) has nothing to skip; any other must open with the skip link.
    if (stops === 1 && !stop.inMain && !(stop.href === "#main" && /skip/i.test(stop.what))) note("keyboard", `the first stop of the Tab key is not a link that skips to the page (it is ${stop.what})`, where);
    if (stop.offscreen) note("keyboard", `focus moves to something that is not on the screen: ${stop.what}`, where);
    if (stop.covered) note("keyboard", `the focused control is covered by ${stop.covered} (WCAG 2.4.11): ${stop.what}`, where);
    if (stop.tabindex && Number(stop.tabindex) > 0) note("keyboard", `a positive tabindex puts ${stop.what} out of order`, where);
    // Is it visible that this is where the keyboard is? The picture around the control, with and without the focus.
    if (size === "desktop" && !rings.has(stop.signature) && stop.rect.width > 0 && stop.rect.height > 0 && !stop.offscreen) {
      const clip = {
        x: Math.max(0, stop.rect.x - 8),
        y: Math.max(0, stop.rect.y - 8),
        width: Math.min(SIZES.desktop.width - Math.max(0, stop.rect.x - 8), stop.rect.width + 16),
        height: Math.min(SIZES.desktop.height - Math.max(0, stop.rect.y - 8), stop.rect.height + 16)
      };
      if (clip.width > 1 && clip.height > 1) {
        await page.waitForTimeout(160);
        const focused = await page.screenshot({ clip });
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.waitForTimeout(160);
        const blurred = await page.screenshot({ clip });
        await page.evaluate((index) => {
          const el = document.getElementsByTagName("*")[index];
          if (el) el.focus({ preventScroll: true });
        }, stop.index);
        rings.set(stop.signature, !focused.equals(blurred));
        if (focused.equals(blurred)) note("keyboard", `no visible mark shows where the keyboard is on ${stop.what}`, where);
      }
    } else if (size === "desktop" && rings.get(stop.signature) === false) {
      note("keyboard", `no visible mark shows where the keyboard is on ${stop.what}`, where);
    }
  }
  if (stops >= MAX_TABS) note("keyboard", `more than ${MAX_TABS} Tab stops on one page`, where);
  return stops;
}

// The skip link must work, not only exist.
async function skipLink(page, where) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  await page.keyboard.press("Tab");
  const first = await page.evaluate(() => (document.activeElement && document.activeElement.getAttribute("href")) || "");
  if (first !== "#main") return; // reported by the walk
  await page.keyboard.press("Enter");
  const landed = await page.evaluate(() => (document.activeElement && (document.activeElement.id || document.activeElement.tagName)) || "");
  if (landed !== "main") note("keyboard", `the skip link does not move focus to the page (focus is on ${landed})`, where);
}

// The person's menu: it must open from the keyboard, say so, and close on Escape with the focus back where it was.
async function menu(page, where) {
  const summary = page.locator(".user-menu summary").first();
  if (!(await summary.count())) return;
  if (!(await summary.isVisible())) return;
  await summary.focus();
  await page.keyboard.press("Enter");
  const opened = await page.evaluate(() => !!document.querySelector(".user-menu[open]"));
  if (!opened) {
    note("keyboard", "the person's menu does not open from the keyboard", where);
    return;
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  const state = await page.evaluate(() => ({ open: !!document.querySelector(".user-menu[open]"), onSummary: !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(".user-menu summary")) }));
  if (state.open) note("keyboard", "Escape does not close the person's menu", where);
  else if (!state.onSummary) note("keyboard", "after Escape closes the person's menu the focus is not back on its button", where);
}

// Quick find (Notion's search, Apple's Spotlight): Control+K or Command+K opens a dialog with a field that has the focus; Escape closes it.
async function quickFind(page, where) {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  await page.keyboard.press("Control+K");
  await page.waitForTimeout(250);
  const state = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][open], dialog[open], [role="dialog"]:not([hidden])');
    const field = document.activeElement;
    return { open: !!dialog, named: !!(dialog && (dialog.getAttribute("aria-label") || dialog.getAttribute("aria-labelledby"))), modal: !!(dialog && (dialog.getAttribute("aria-modal") === "true" || dialog.tagName === "DIALOG")), onField: !!(field && dialog && dialog.contains(field) && (field.tagName === "INPUT" || field.getAttribute("role") === "combobox")) };
  });
  if (!state.open) {
    note("quick find", "Control+K does not open a search from anywhere", where);
    return;
  }
  if (!state.named) note("quick find", "the search dialog has no name for a screen reader", where);
  if (!state.modal) note("quick find", "the search dialog is not modal (aria-modal or a dialog element)", where);
  if (!state.onField) note("quick find", "the search dialog does not put the focus in its field", where);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const closed = await page.evaluate(() => !document.querySelector('[role="dialog"][open], dialog[open]') && !document.querySelector('[role="dialog"]:not([hidden])'));
  if (!closed) note("quick find", "Escape does not close the search", where);
}

// ---- The walk -----------------------------------------------------------------------------------------------------------------

async function resolvePaths(page, paths) {
  const out = [];
  for (const path of paths) {
    const resolved = typeof path === "function" ? await path(page) : path;
    if (resolved && (!PAGES || PAGES.test(resolved))) out.push(resolved);
  }
  return out;
}

async function visit(page, url, label, size, scheme, checks) {
  const where = `${label} ${url} [${size}${scheme === "light" ? "" : `, ${scheme}`}]`;
  const response = await page.goto(base + url, { waitUntil: "networkidle" }).catch(() => undefined);
  if (response && response.status() >= 400) note("page", `answered ${response.status()}`, where);
  await page.evaluate(inPageDescribe);
  await page.evaluate(inPageHidden);
  await page.waitForTimeout(700); // the energy picture and the charts settle
  const slug = url.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-") || "home";
  if (checks.shots && SHOTS) await page.screenshot({ path: join(OUT, `${label}-${size}-${scheme}-${slug}.png`), fullPage: true });
  if (checks.axe && wants("axe")) await runAxe(page, where);
  if (checks.appearance && wants("appearance")) await appearance(page, where, scheme);
  if (checks.touch && wants("touch") && size === "phone") await touch(page, where);
  if (checks.names && wants("names")) await names(page, where);
  if (checks.motion && wants("motion")) await motion(page, where, checks.reduced);
  if (checks.keyboard && wants("keyboard")) {
    await keyboard(page, where, size);
    await skipLink(page, where);
  }
  if (checks.text && wants("text")) await textSize(page, where, size);
  return where;
}

async function session(browser, label, who, team, paths, after, options, checks, size, scheme) {
  const context = await browser.newContext({ viewport: SIZES[size], deviceScaleFactor: 1, bypassCSP: true, ...options });
  const page = await context.newPage();
  page.on("pageerror", (error) => note("page", `page error: ${String(error).slice(0, 140)}`, `${label} [${size}]`));
  if (who) {
    await signIn(page, who, team);
    if (after) await after(page);
  }
  const resolved = await resolvePaths(page, paths);
  let first;
  for (const url of resolved) {
    const where = await visit(page, url, label, size, scheme, checks);
    first ??= url;
    if (checks.menu && wants("keyboard") && url === resolved[0]) await menu(page, where);
    if (checks.menu && wants("keyboard")) await quickFind(page, where);
  }
  const state = who ? await context.storageState() : undefined;
  await context.close();
  return { resolved, state };
}

(async () => {
  const timers = wants("feedback") ? sourceScan() : 0;
  const browser = await chromium.launch();
  let reflowed = 0;
  for (const plan of PLANS) {
    if (plan.before) await plan.before();
    // The light scheme is the full set of checks, on a desk and on a phone.
    let resolved = [];
    let state;
    for (const size of ["desktop", "phone"]) {
      const full = { axe: true, appearance: true, touch: true, names: true, motion: true, keyboard: true, text: size === "desktop", menu: size === "desktop", shots: true };
      const result = await session(browser, plan.name, plan.who, plan.team, plan.paths, plan.after, {}, full, size, "light");
      if (size === "desktop") ({ resolved, state } = result);
    }
    // The dark scheme: it must exist, and keep the contrast.
    for (const size of ["desktop", "phone"]) await session(browser, plan.name, plan.who, plan.team, plan.paths, plan.after, { colorScheme: "dark" }, { axe: true, appearance: true, shots: true }, size, "dark");
    // Less motion, more contrast, forced colours: what the person has asked of their device.
    await session(browser, plan.name, plan.who, plan.team, plan.paths, plan.after, { reducedMotion: "reduce" }, { motion: true, reduced: true }, "desktop", "reduced");
    await session(browser, plan.name, plan.who, plan.team, plan.paths, plan.after, { contrast: "more" }, { axe: true, shots: true }, "desktop", "contrast");
    if (SHOTS) await session(browser, plan.name, plan.who, plan.team, plan.paths, plan.after, { forcedColors: "active" }, { shots: true }, "desktop", "forced");
    // Reflow at 320 px, as the same person.
    if (wants("reflow")) {
      for (const url of resolved) await reflow(browser, state, url, `${plan.name} ${url} [320px]`);
      reflowed += resolved.length;
    }
  }

  // The public pages, signed out.
  for (const size of ["desktop", "phone"]) {
    const full = { axe: true, appearance: true, touch: true, names: true, motion: true, keyboard: true, text: size === "desktop", shots: true };
    await session(browser, "public", null, false, PUBLIC_PATHS, undefined, {}, full, size, "light");
    await session(browser, "public", null, false, PUBLIC_PATHS, undefined, { colorScheme: "dark" }, { axe: true, appearance: true, shots: true }, size, "dark");
  }
  await session(browser, "public", null, false, PUBLIC_PATHS, undefined, { reducedMotion: "reduce" }, { motion: true, reduced: true }, "desktop", "reduced");
  if (wants("reflow")) for (const url of PUBLIC_PATHS) await reflow(browser, undefined, url, `public ${url} [320px]`);
  await browser.close();

  // ---- The report -------------------------------------------------------------------------------------------------------------
  const rows = [...found.values()].sort((a, b) => b.where.size - a.where.size || a.check.localeCompare(b.check));
  const lines = rows.map((row) => `- [${row.check}] ${row.detail}  (${row.where.size} page${row.where.size === 1 ? "" : "s"}: ${[...row.where].slice(0, 3).join("; ")}${row.where.size > 3 ? "; …" : ""})`);
  const summary = new Map();
  for (const row of rows) summary.set(row.check.split(" ")[0], (summary.get(row.check.split(" ")[0]) ?? 0) + 1);
  writeFileSync(join(OUT, "a11y-findings.txt"), lines.join("\n") + "\n");
  writeFileSync(join(OUT, "a11y-findings.json"), JSON.stringify(rows.map((row) => ({ ...row, where: [...row.where] })), null, 2));
  console.log(lines.length ? lines.join("\n") : "No findings.");
  if (reviewed.size) console.log(`\nContrast axe could not measure (measured from the tokens instead, see docs/29): ${[...reviewed].slice(0, 14).join(" | ")}`);
  console.log(`\n${rows.length} distinct finding${rows.length === 1 ? "" : "s"}${rows.length ? ` (${[...summary].map(([check, count]) => `${check} ${count}`).join(", ")})` : ""}. Reflow pages checked: ${reflowed}. Timers in the source: ${timers}. Report and pictures are in ${OUT}`);
  if (process.env.A11Y_STRICT === "1" && rows.length) process.exit(1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
