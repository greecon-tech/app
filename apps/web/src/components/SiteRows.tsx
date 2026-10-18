import Link from "next/link";
import { HEALTH_LABELS, SiteHealth } from "@greecon/shared";
import { worstFirst } from "../lib/health";
import { Ago } from "./Ago";
import { StatusBadge } from "./StatusBadge";

export interface SiteRowData {
  id: string;
  name: string;
  locationName: string;
  type: string;
  edgeStatus: string;
  lastReadingAtUtc?: string;
  health: SiteHealth;
}

/** Every site, worst first: its name, how it is doing in a word and why, and when it last reported.
 * Each row is one link to the site. */
export function SiteRows({ sites }: { sites: readonly SiteRowData[] }) {
  return (
    <div className="site-list">
      {worstFirst(sites).map((site) => {
        const [first, ...others] = site.health.reasons;
        return (
          <Link href={`/sites/${site.id}`} className="site-row" key={site.id}>
            <div>
              <strong>{site.name}</strong>
              <p className="muted">{[site.locationName, site.type.replace(/_/g, " ")].filter(Boolean).join(" · ")}</p>
            </div>
            <div className="site-row__state">
              <StatusBadge status={HEALTH_LABELS[site.health.state]} />
              <p className="muted">{first ? first.message : "All readings current. Nothing open."}</p>
              {others.length > 0 ? <p className="muted">{`and ${others.length} more`}</p> : null}
            </div>
            <div className="site-row__meta muted">
              <span>{site.lastReadingAtUtc ? <>Last reading <Ago iso={site.lastReadingAtUtc} /></> : "No readings yet"}</span>
              {site.edgeStatus === "Simulated" ? <StatusBadge status="Simulated" /> : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
