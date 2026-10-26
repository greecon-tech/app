// Tables made from docs/launch/packs/kits.json and steps.json, so that the same figure is printed the same way everywhere:
// in a site pack, in the hardware reference, in the shopping lists.

const KIT_ORDER = ["H", "S", "F", "W"];

function cell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

export function listOf(items) {
  return items.map((item) => `- {{cb}} ${item}`).join("\n") + "\n";
}

/** The bill of materials for the kit the context is for. */
export function bomTable(ctx) {
  const kit = ctx.kit;
  if (!kit) throw new Error("{{bom}} needs a kit");
  const rows = kit.bom.map((line) => {
    const part = ctx.kits.parts[line.part];
    if (!part) throw new Error(`kits.json: kit ${kit.letter} lists a part "${line.part}" that does not exist`);
    const name = `**${part.item}**${line.optional ? " *(optional)*" : ""}`;
    const spec = `${part.spec}${line.note ? `. *${line.note[0].toUpperCase()}${line.note.slice(1)}.*` : ""}`;
    return `| {{cb}} | ${cell(name)} | ${cell(spec)} | ${cell(line.qty)} | ${cell(part.estimate)} |`;
  });
  return [
    "| | Item | Specification | Qty | Planning estimate (EUR) |",
    "|--|---------|--------------------------|----|----------|",
    ...rows
  ].join("\n") + "\n";
}

/** Which kits use a part, as "H S W", with brackets round a kit where the part is optional. */
function usedIn(ctx, partId) {
  return KIT_ORDER.map((letter) => {
    const line = ctx.kits.kits[letter].bom.find((entry) => entry.part === partId);
    if (!line) return null;
    return line.optional ? `(${letter})` : letter;
  })
    .filter(Boolean)
    .join(" ");
}

/** Every part, what it does and which kits use it. */
export function partsTable(ctx) {
  const rows = Object.entries(ctx.kits.parts).map(([id, part]) => {
    return `| **${cell(part.item)}** | ${cell(part.does)} | ${cell(usedIn(ctx, id))} | ${cell(part.estimate)} |`;
  });
  return ["| Part | What it does | Kits | Planning estimate (EUR) |", "|-------|-------------------------|----|----------|", ...rows].join("\n") + "\n";
}

/** Which kits use a part, in words. */
function usedInWords(ctx, partId) {
  const required = [];
  const optional = [];
  for (const letter of KIT_ORDER) {
    const line = ctx.kits.kits[letter].bom.find((entry) => entry.part === partId);
    if (!line) continue;
    (line.optional ? optional : required).push(letter);
  }
  const say = (letters) => `kit${letters.length > 1 ? "s" : ""} ${letters.join(", ")}`;
  const bits = [];
  if (required.length > 0) bits.push(say(required).replace(/^kit/, "Kit"));
  if (optional.length > 0) bits.push(`${required.length > 0 ? "optional" : "Optional"} in ${say(optional)}`);
  return bits.join("; ") || "no standard kit";
}

/** What a part is, what it must be, what it costs and where it is used: a small card for the hardware reference. */
export function partCard(ctx, id) {
  const part = ctx.kits.parts[id];
  if (!part) throw new Error(`{{part:${id}}}: kits.json has no part called "${id}"`);
  return [
    "::: speccard",
    "What it does",
    `:   ${part.does}`,
    "",
    "Specification",
    `:   ${part.spec}`,
    "",
    "Planning estimate (EUR)",
    `:   ${part.estimate}. Not a quote.`,
    "",
    "Used in",
    `:   ${usedInWords(ctx, id)}`,
    ":::",
    ""
  ].join("\n");
}

function oneShoppingTable(ctx, letter) {
  const kit = ctx.kits.kits[letter];
  const rows = kit.bom.map((line) => {
    const part = ctx.kits.parts[line.part];
    const name = `**${part.item}**${line.optional ? " *(optional)*" : ""}. ${part.spec}`;
    return `| {{cb}} | ${cell(name)} | ${cell(line.qty)} | ${cell(part.estimate)} | | | |`;
  });
  return [
    `### [${letter}]{.num} ${kit.name} {.lv3 #shopping-${letter.toLowerCase()}}`,
    "",
    "| | Item and specification | Qty | Planning estimate (EUR) | Quote 1 | Quote 2 | Quote 3 |",
    "|--|------------------|---|-------|-----|-----|-----|",
    ...rows,
    "",
    `**Planning total:** ${kit.headline}`,
    ""
  ].join("\n");
}

/** A shopping list with room for three quotes. With no letter, one for every kit. */
export function shoppingTable(ctx, letter) {
  if (letter) return `${oneShoppingTable(ctx, letter)}\n`;
  return KIT_ORDER.map((one) => oneShoppingTable(ctx, one)).join("\n");
}

const WHO_FOR_STEP = { pm: "pm", "pm-e": "pm+e", platform: "platform" };

/** One line for each step that applies to the kit: a box to tick, the step's number and title, and who does it. */
export function stepSummary(ctx) {
  const kit = ctx.kit;
  if (!kit) throw new Error("{{stepsummary}} needs a kit");
  const letter = kit.letter;
  const who = { pm: "Project manager", "pm-e": "Project manager, with the electrician", platform: "The platform, by itself" };
  const rows = [];
  let shown = 0;
  for (const step of ctx.steps) {
    const appliesTo = step.when.split(/\s+/);
    const conditional = appliesTo.includes(`${letter}-battery`);
    if (!appliesTo.includes(letter) && !conditional) continue;
    shown += 1;
    const notes = [step.optional ? "optional" : null, conditional ? "only if the plant has a battery" : null].filter(Boolean).join(", ");
    rows.push(`| {{cb}} | ${step.n} | **${cell(step.title)}** | ${who[step.who] ?? "Project manager"}${notes ? ` (${notes})` : ""} |`);
  }
  return ["| | Step | Title on the setup list | Done by |", "|--|---|----------------------|--------------|", ...rows, ""].join("\n");
}

/** The platform's setup list for the kit: the steps that appear, each with what to do, what you should see and what to do if you do not. */
export function stepCards(ctx) {
  const kit = ctx.kit;
  if (!kit) throw new Error("{{steps}} needs a kit");
  const letter = kit.letter;
  const lower = letter.toLowerCase();
  const total = ctx.steps.length;
  const out = [];
  const left = [];
  for (const step of ctx.steps) {
    const appliesTo = step.when.split(/\s+/);
    const conditional = appliesTo.includes(`${letter}-battery`);
    const applies = appliesTo.includes(letter) || conditional;
    if (!applies) {
      left.push(step);
      continue;
    }
    const who = WHO_FOR_STEP[step.who] ?? "pm";
    const flags = [step.optional ? "*optional*" : null, conditional ? "*only if the plant has a battery*" : null].filter(Boolean).join(", ");
    out.push(`### [Step ${step.n}]{.num} ${step.title} {.lv3 .toc2 #${lower}-step-${step.n}}`);
    out.push("");
    out.push(`{{who:${who}}}${flags ? ` ${flags}` : ""}`);
    out.push("");
    out.push("::: stepcard");
    out.push("Do");
    out.push(`:   ${indentBlock(step.do)}`);
    out.push("");
    out.push("You should see");
    out.push(`:   ${indentBlock(step.see)}`);
    out.push("");
    out.push("If you do not");
    out.push(`:   ${indentBlock(step.ifnot)}`);
    out.push(":::");
    out.push("");
  }
  if (left.length > 0) {
    out.push(
      `**Not on this kit.** The platform leaves out a step that does not apply to the site, so the list for kit ${letter} has no ${left
        .map((step) => `step ${step.n} (${step.title})`)
        .join(" and no ")}. The steps keep their order; the count on the setup page is out of the steps that do apply, not out of ${total}.`
    );
    out.push("");
  }
  return out.join("\n");
}

function indentBlock(text) {
  // a definition's later paragraphs and list items are indented by four spaces
  const lines = text.split("\n");
  return lines.map((line, index) => (index === 0 ? line : `    ${line}`)).join("\n");
}
