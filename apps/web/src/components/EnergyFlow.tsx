import { describeAge, EnergyFlowView, FlowLink, FlowSpoke, formatKw } from "@greecon/shared";
import { StatusBadge } from "./StatusBadge";

// Where the energy at a site is going, drawn as a junction with up to four spokes. Everything on it
// is a measured value with the words beside it: the animation only repeats what the numbers say.
// A spoke is drawn moving only while it is measured, current and flowing; an out-of-date spoke is a
// still, dashed line with its age, and a spoke the site does not measure is not drawn at all.
// The movement stops entirely for people who ask their device for less motion, and the arrowheads
// and words carry the direction without it.

const HUB = { x: 210, y: 150 } as const;
const NODE: Record<FlowSpoke, { x: number; y: number }> = {
  solar: { x: 210, y: 46 },
  grid: { x: 60, y: 150 },
  site: { x: 360, y: 150 },
  battery: { x: 210, y: 254 }
};
const RADIUS = 28;
const HUB_CLEARANCE = 8;

type Point = { x: number; y: number };

// The two ends of a spoke: where it leaves the node and where it meets the junction.
function ends(spoke: FlowSpoke): { node: Point; hub: Point } {
  const n = NODE[spoke];
  switch (spoke) {
    case "solar":
      return { node: { x: n.x, y: n.y + RADIUS }, hub: { x: HUB.x, y: HUB.y - HUB_CLEARANCE } };
    case "battery":
      return { node: { x: n.x, y: n.y - RADIUS }, hub: { x: HUB.x, y: HUB.y + HUB_CLEARANCE } };
    case "grid":
      return { node: { x: n.x + RADIUS, y: n.y }, hub: { x: HUB.x - HUB_CLEARANCE, y: HUB.y } };
    case "site":
      return { node: { x: n.x - RADIUS, y: n.y }, hub: { x: HUB.x + HUB_CLEARANCE, y: HUB.y } };
  }
}

function arrowhead(tip: Point, from: Point): string {
  const dx = Math.sign(tip.x - from.x);
  const dy = Math.sign(tip.y - from.y);
  // Four directions only: the spokes are straight, horizontal or vertical.
  if (dx !== 0) return `${tip.x},${tip.y} ${tip.x - dx * 9},${tip.y - 5} ${tip.x - dx * 9},${tip.y + 5}`;
  return `${tip.x},${tip.y} ${tip.x - 5},${tip.y - dy * 9} ${tip.x + 5},${tip.y - dy * 9}`;
}

/** Faster for a bigger flow, but only ever as a feel: the number beside it is the measurement. */
function secondsPerCycle(kw: number): number {
  return Math.min(2.4, Math.max(0.5, 2.4 / (1 + kw / 3)));
}

function present(link: FlowLink): boolean {
  return link.status !== "not_measured" || link.socPercent !== undefined;
}

const LABEL: Record<FlowSpoke, string> = { solar: "Solar", grid: "Grid", battery: "Battery", site: "Site use" };

function caption(link: FlowLink): string | undefined {
  if (link.status === "out_of_date") return link.ageSeconds !== undefined ? `${describeAge(link.ageSeconds)} old` : "out of date";
  switch (link.spoke) {
    case "solar":
      return link.direction === "to_hub" ? "producing" : undefined;
    case "grid":
      return link.direction === "to_hub" ? "importing" : link.direction === "from_hub" ? "exporting" : undefined;
    case "battery": {
      // With no flow known the level is already the node's value.
      if (link.direction === "unknown") return undefined;
      const level = link.socPercent !== undefined ? `${Math.round(link.socPercent)}%` : undefined;
      const flow = link.direction === "from_hub" ? "charging" : link.direction === "to_hub" ? "discharging" : undefined;
      return [flow, level].filter(Boolean).join(" · ") || undefined;
    }
    case "site":
      return undefined;
  }
}

function valueText(link: FlowLink): string {
  if (link.direction === "unknown") return link.status === "out_of_date" ? "Not known" : link.socPercent !== undefined ? `${Math.round(link.socPercent)}%` : "Not known";
  if (link.direction === "idle") return "Idle";
  return formatKw(link.kw as number);
}

// Small line drawings, centred on the node.
function Glyph({ spoke, x, y }: { spoke: FlowSpoke; x: number; y: number }) {
  switch (spoke) {
    case "solar":
      return (
        <g transform={`translate(${x} ${y})`}>
          <circle r="6" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line key={angle} x1="0" y1="-10" x2="0" y2="-14" transform={`rotate(${angle})`} />
          ))}
        </g>
      );
    case "grid":
      return (
        <g transform={`translate(${x} ${y})`}>
          <path d="M-7 12 L0 -12 L7 12 M-4 3 H4 M-6 8 H6 M-9 -5 H9" />
        </g>
      );
    case "site":
      return (
        <g transform={`translate(${x} ${y})`}>
          <path d="M-12 1 L0 -11 L12 1 M-8 -1 V11 H8 V-1" />
        </g>
      );
    case "battery":
      return (
        <g transform={`translate(${x} ${y})`}>
          <rect x="-11" y="-6" width="20" height="12" rx="2" />
          <path d="M11 -2 V2" />
        </g>
      );
  }
}

function Spoke({ link, animate }: { link: FlowLink; animate: boolean }) {
  const { node, hub } = ends(link.spoke);
  const flowing = link.direction === "to_hub" || link.direction === "from_hub";
  const [from, to] = link.direction === "from_hub" ? [hub, node] : [node, hub];
  const d = `M${from.x} ${from.y} L${to.x} ${to.y}`;

  if (!flowing) {
    const className = link.direction === "idle" ? "ef-line ef-line--idle" : "ef-line ef-line--unknown";
    return <path className={className} d={d} />;
  }
  const duration = `${secondsPerCycle(link.kw as number).toFixed(2)}s`;
  return (
    <g className={`ef-flow ef-${link.spoke}`}>
      <path className="ef-line ef-line--base" d={d} />
      {animate ? <path className="ef-line ef-line--moving" d={d} style={{ ["--flow-duration" as string]: duration }} /> : null}
      <polygon className="ef-arrow" points={arrowhead(to, from)} />
    </g>
  );
}

function Node({ link }: { link: FlowLink }) {
  const n = NODE[link.spoke];
  const side = link.spoke === "grid" || link.spoke === "site";
  const textX = side ? n.x : n.x + RADIUS + 12;
  const labelY = side ? n.y + RADIUS + 18 : n.y - 6;
  const sub = caption(link);
  const anchor = side ? "middle" : "start";
  return (
    <g className={`ef-node ef-${link.spoke}${link.status === "out_of_date" ? " ef-node--quiet" : ""}`}>
      <circle className="ef-node__ring" cx={n.x} cy={n.y} r={RADIUS} />
      <g className="ef-node__glyph">
        <Glyph spoke={link.spoke} x={n.x} y={n.y} />
      </g>
      <text className="ef-label" x={textX} y={labelY} textAnchor={anchor}>
        {LABEL[link.spoke]}
      </text>
      <text className="ef-value" x={textX} y={labelY + 19} textAnchor={anchor}>
        {valueText(link)}
      </text>
      {sub ? (
        <text className="ef-sub" x={textX} y={labelY + 36} textAnchor={anchor}>
          {sub}
        </text>
      ) : null}
    </g>
  );
}

export function EnergyFlow({ flow, siteName }: { flow: EnergyFlowView; siteName?: string }) {
  if (!flow.hasEnergy) return null;
  const spokes = (["solar", "grid", "battery", "site"] as const).filter((spoke) => present(flow.links[spoke]));
  const animate = flow.state !== "unknown";

  return (
    <figure className="energy-flow" aria-label={siteName ? `Energy flow at ${siteName}` : "Energy flow"}>
      <figcaption className="energy-flow__caption">
        <p className="energy-flow__headline">
          {flow.headline}
          {flow.simulated ? <StatusBadge status="Simulated" /> : null}
        </p>
        {flow.detail ? <p className="muted">{flow.detail}</p> : null}
      </figcaption>
      <svg className="energy-flow__diagram" viewBox="0 0 420 300" aria-hidden="true" focusable="false">
        {spokes
          // A battery known only by its level has no line: nothing is measured to say which way it flows.
          .filter((spoke) => !(flow.links[spoke].direction === "unknown" && flow.links[spoke].status === "current"))
          .map((spoke) => (
            <Spoke key={`spoke-${spoke}`} link={flow.links[spoke]} animate={animate} />
          ))}
        <circle className="ef-hub" cx={HUB.x} cy={HUB.y} r="5" />
        {spokes.map((spoke) => (
          <Node key={`node-${spoke}`} link={flow.links[spoke]} />
        ))}
      </svg>
      {flow.notes.length > 0 ? (
        <ul className="energy-flow__notes muted">
          {flow.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </figure>
  );
}

/** One diagram for each site that measures energy, for the Overview. */
export function EnergyFlows({ entries }: { entries: Array<{ siteId: string; siteName: string; flow: EnergyFlowView }> }) {
  if (entries.length === 0) return null;
  const several = entries.length > 1;
  return (
    <div className={several ? "energy-flows energy-flows--several" : "energy-flows"}>
      {entries.map((entry) => (
        <div key={entry.siteId} className="panel energy-flows__item">
          {several ? <h3 className="energy-flows__site">{entry.siteName}</h3> : null}
          <EnergyFlow flow={entry.flow} siteName={entry.siteName} />
        </div>
      ))}
    </div>
  );
}
