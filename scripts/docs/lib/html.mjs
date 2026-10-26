// Markdown to HTML (with pandoc), and the pages around it: the cover, the contents, the part openers, the running header.

import { spawnSync } from "node:child_process";
import { escapeHtml, stripTags } from "./util.mjs";
import { expand, restoreHtml } from "./macros.mjs";
import { normalizeHeadings } from "./sources.mjs";

const PANDOC_FROM = [
  "markdown",
  "+smart",
  "+fenced_divs",
  "+bracketed_spans",
  "+task_lists",
  "+pipe_tables",
  "+raw_html",
  "+definition_lists",
  "+header_attributes",
  "-citations",
  "-implicit_figures",
  "-auto_identifiers",
  "-raw_tex",
  "-tex_math_dollars",
  "-tex_math_single_backslash",
  "-superscript",
  "-subscript"
].join("");

export function runPandoc(markdown) {
  const result = spawnSync("pandoc", [`--from=${PANDOC_FROM}`, "--to=html5", "--wrap=none", "--no-highlight"], { input: markdown, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`pandoc failed: ${result.stderr}`);
  return result.stdout;
}

/**
 * Expands the macros in a Markdown text, gives every heading its role and a unique id, makes it HTML and puts the held HTML
 * (figures) back. `usedIds` is shared by everything in one document so that no two headings have the same id.
 */
export function renderMarkdown(markdown, ctx, { file, usedIds, notes }) {
  const expanded = expand(markdown, ctx, file);
  const normalized = normalizeHeadings(expanded, { shift: 0, usedIds, notes, file });
  return { expanded: normalized, html: postprocess(restoreHtml(runPandoc(normalized), ctx)) };
}

function postprocess(html) {
  let out = html;
  // check boxes of task lists: a drawn square, never a glyph
  out = out.replace(/<label><input type="checkbox"(?: checked="")? \/>/g, '<span class="cb"></span>').replace(/<\/label>(?=<\/li>|<\/p>)/g, "");
  out = out.replace(/<li>(\s*<p>)?<span class="cb"><\/span>/g, '<li class="task">$1<span class="cb"></span>');
  out = out.replace(/<ul class="task-list">/g, '<ul class="tasks">');
  // arrows are set in the sans face (the serif has none, and the browser's fallback draws a tiny one)
  out = out
    .split(/(<[^>]+>)/)
    .map((piece) => (piece.startsWith("<") ? piece : piece.replace(/→/g, '<span class="arr">→</span>')))
    .join("");
  // the tables of steps and tests are sized by the stylesheet, not by the dashes of their Markdown
  out = out.replace(/<div class="(?:[^"]*\s)?(?:steps|tests)(?:\s[^"]*)?">[\s\S]*?<\/div>/g, (block) => block.replace(/<colgroup>[\s\S]*?<\/colgroup>/g, ""));
  // short tables stay in one piece
  out = out.replace(/<table>([\s\S]*?)<\/table>/g, (whole) => {
    const rows = (whole.match(/<tr\b/g) ?? []).length - 1;
    return rows <= 9 ? whole.replace("<table>", '<table class="keep">') : whole;
  });
  // in a table of steps, the row takes the colour of who does it
  out = out.replace(/<div class="(?:[^"]*\s)?steps(?:\s[^"]*)?">([\s\S]*?)<\/div>/g, (whole, inner) => {
    const marked = inner.replace(/<tr class="(odd|even)">([\s\S]*?)<\/tr>/g, (row, parity, content) => {
      const kinds = new Set([...content.matchAll(/class="who (e|pm|c)"/g)].map((match) => match[1]));
      const cls = kinds.size === 1 ? [...kinds][0] : kinds.size > 1 ? "mix" : "";
      return cls ? `<tr class="${cls}">${content}</tr>` : row;
    });
    return whole.replace(inner, marked);
  });
  return out;
}

/** The headings that belong in the contents, in order. */
export function collectHeadings(html) {
  const entries = [];
  const pattern = /<h([1-4])\b([^>]*)>([\s\S]*?)<\/h\1>/g;
  let match;
  while ((match = pattern.exec(html))) {
    const attributes = match[2];
    const id = attributes.match(/\bid="([^"]+)"/)?.[1];
    if (!id) continue;
    const classes = (attributes.match(/\bclass="([^"]*)"/)?.[1] ?? "").split(/\s+/);
    const role = Number(classes.find((name) => /^lv\d$/.test(name))?.slice(2) ?? match[1]);
    const inner = match[3];
    const number = inner.match(/<span class="num">([\s\S]*?)<\/span>/)?.[1] ?? "";
    const label = inner.match(/<span class="part-label">([\s\S]*?)<\/span>/)?.[1] ?? "";
    const title = stripTags(inner.replace(/<span class="num">[\s\S]*?<\/span>/, "").replace(/<span class="part-label">[\s\S]*?<\/span>/, ""));
    entries.push({ id, role, number: stripTags(number), label: stripTags(label), title, classes, toc: classes.includes("intoc"), toc2: classes.includes("toc2"), noToc: classes.includes("notoc") });
  }
  return entries;
}

// ---------------------------------------------------------------------------------------------------------------------------
// The wordmark and the cover
// ---------------------------------------------------------------------------------------------------------------------------

export function logoSvg(size = 48) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true"><rect width="48" height="48" rx="11" fill="#2f6b4a"/><path d="M32.8 16.6A11.5 11.5 0 1 0 35.5 24H25" fill="none" stroke="#f7f1e9" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function coverArt(letter) {
  const mark = letter
    ? `<text x="200" y="228" font-family="Inter, sans-serif" font-weight="800" font-size="170" fill="#2f3d35" fill-opacity="0.07" text-anchor="middle">${escapeHtml(letter)}</text>`
    : "";
  return `<svg class="cover-art" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<rect x="150" y="150" width="230" height="230" rx="52" fill="#448561" fill-opacity="0.13"/>
<rect x="96" y="96" width="284" height="284" rx="64" fill="none" stroke="#448561" stroke-width="2" stroke-opacity="0.55"/>
<rect x="48" y="48" width="332" height="332" rx="76" fill="none" stroke="#2f6b4a" stroke-width="1.5" stroke-opacity="0.38"/>
<rect x="0" y="0" width="380" height="380" rx="88" fill="none" stroke="#2f3d35" stroke-width="1.2" stroke-opacity="0.22"/>
<path d="M60 340 C140 300 200 330 270 250 S360 150 380 120" fill="none" stroke="#448561" stroke-width="2.4" stroke-opacity="0.5" stroke-linecap="round"/>
<circle cx="270" cy="250" r="6" fill="#2f6b4a"/>
<circle cx="150" cy="318" r="4" fill="#448561"/>
${mark}
</svg>`;
}

export function coverHtml(doc) {
  const rows = [
    ["For", doc.cover.forWho],
    ["Print", doc.cover.print],
    ["Covers", doc.cover.covers]
  ]
    .filter(([, value]) => value)
    .map(([term, value]) => `<dt>${escapeHtml(term)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
  return `<section class="cover">
${coverArt(doc.cover.badge ?? null)}
<div class="cover-top">${logoSvg(46)}<div class="wordmark">greecon<small>Sh.p.k</small></div></div>
${doc.cover.badge ? `<div class="cover-badge" aria-hidden="true">${escapeHtml(doc.cover.badge)}</div>` : ""}
<div class="cover-body">
<p class="cover-kicker">${escapeHtml(doc.cover.kicker)}</p>
<p class="cover-title">${escapeHtml(doc.cover.title)}</p>
<p class="cover-sub">${escapeHtml(doc.cover.subtitle)}</p>
<dl class="cover-meta">${rows}</dl>
</div>
<div class="cover-foot"><span><b>Version ${escapeHtml(doc.version)}</b> · ${escapeHtml(doc.dateLong)}</span><span>Greecon Sh.p.k · Durana Tech Park · info@greecon.earth</span></div>
</section>`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Contents, part openers
// ---------------------------------------------------------------------------------------------------------------------------

export function tocHtml(entries, pages, { note } = {}) {
  const items = entries
    .map((entry) => {
      const page = pages.get(entry.id) ?? "";
      const level = entry.role <= 1 ? "l1" : entry.role === 2 ? "l2" : "l3";
      const label = entry.label ? `<span class="n">${escapeHtml(entry.label)}</span>` : entry.number ? `<span class="n">${escapeHtml(entry.number)}</span>` : "";
      return `<li class="${level}"><a href="#${entry.id}">${level === "l1" ? "" : label}<span class="t">${level === "l1" && entry.label ? `<span class="n">${escapeHtml(entry.label)}</span> ` : ""}${escapeHtml(entry.title)}</span><span class="dots"></span><span class="p">${page}</span></a></li>`;
    })
    .join("\n");
  return `<nav class="toc" aria-label="Contents"><h1 class="lv1 notoc" id="contents">Contents</h1><ol>\n${items}\n</ol>${note ? `<p class="toc-note">${escapeHtml(note)}</p>` : ""}</nav>`;
}

export function partHtml(part, bodyHtml, leadHtml) {
  const label = part.label ? `<span class="part-label">${escapeHtml(part.label)}</span>` : "";
  return `<section class="part ${part.cssClass}" id="${part.sectionId}">
<header class="part-head">
<h1 class="lv1" id="${part.id}">${label}${escapeHtml(part.title)}</h1>
${leadHtml ? `<div class="part-lead">${leadHtml}</div>` : ""}
</header>
${bodyHtml}
</section>`;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Page furniture: running header and footer, one named page for each part
// ---------------------------------------------------------------------------------------------------------------------------

function cssString(text) {
  return JSON.stringify(text).replace(/\u2028|\u2029/g, " ");
}

export function pageCss(doc, parts) {
  const box = (name, content, { top = true, align = "left" } = {}) => `  @${name} { content: ${content}; ${top ? "vertical-align: bottom; padding-bottom: 3mm; border-bottom: .5pt solid #b9b2a2;" : "vertical-align: top; padding-top: 3mm; border-top: .5pt solid #b9b2a2;"} ${align === "right" ? "text-align: right;" : ""} }`;
  const headerLeft = `${doc.runningTitle}`.toUpperCase();
  const css = [
    "@page {",
    "  size: A4;",
    "  margin: 24mm 20mm 22mm 20mm;",
    `  @top-left { content: ${cssString(`GREECON  ·  ${headerLeft}`)}; font: 600 7pt Inter, sans-serif; letter-spacing: .08em; color: #2f3d35; vertical-align: bottom; padding-bottom: 3mm; border-bottom: .5pt solid #b9b2a2; }`,
    `  @top-center { content: ""; vertical-align: bottom; padding-bottom: 3mm; border-bottom: .5pt solid #b9b2a2; }`,
    `  @top-right { content: ""; font: 500 7pt Inter, sans-serif; color: #4a524d; vertical-align: bottom; padding-bottom: 3mm; border-bottom: .5pt solid #b9b2a2; text-align: right; }`,
    `  @bottom-left { content: "Greecon Sh.p.k"; font: 500 7pt Inter, sans-serif; color: #4a524d; vertical-align: top; padding-top: 3mm; border-top: .5pt solid #b9b2a2; }`,
    `  @bottom-center { content: ${cssString(`Version ${doc.version} · ${doc.dateLong}`)}; font: 400 6.6pt Inter, sans-serif; color: #6b726d; vertical-align: top; padding-top: 3mm; border-top: .5pt solid #b9b2a2; text-align: center; }`,
    `  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 600 7pt Inter, sans-serif; color: #2f3d35; vertical-align: top; padding-top: 3mm; border-top: .5pt solid #b9b2a2; text-align: right; font-variant-numeric: tabular-nums; }`,
    "}",
    "@page cover { margin: 0; @top-left { content: none; border: 0; } @top-center { content: none; border: 0; } @top-right { content: none; border: 0; } @bottom-left { content: none; border: 0; } @bottom-center { content: none; border: 0; } @bottom-right { content: none; border: 0; } }",
    `@page toc { @top-right { content: "Contents"; } }`
  ];
  for (const part of parts) {
    css.push(`@page ${part.cssClass} { @top-right { content: ${cssString(part.runningHead)}; } }`);
    css.push(`.${part.cssClass} { page: ${part.cssClass}; }`);
  }
  return css.join("\n");
}

export function documentHtml({ doc, fontsCss, baseCss, furnitureCss, cover, toc, parts }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(doc.title)}</title>
<meta name="author" content="Greecon Sh.p.k">
<meta name="description" content="${escapeHtml(doc.cover.subtitle)}">
<style>${fontsCss}</style>
<style>${baseCss}</style>
<style>${furnitureCss}</style>
</head>
<body>
${cover}
${toc}
${parts.join("\n")}
</body>
</html>
`;
}
