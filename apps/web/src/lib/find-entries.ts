import { FindEntry, HEALTH_LABELS } from "@greecon/shared";
import type { SiteRowData } from "../components/SiteRows";
import { siteKindWords } from "./equipment";
import { worstFirst } from "./health";

/** A site as quick find lists it: its name, where it is, what kind it is and how it is doing. Worst first, as everywhere. */
export function siteEntries(sites: readonly SiteRowData[]): FindEntry[] {
  return worstFirst(sites).map<FindEntry>((site) => ({
    id: `site:${site.id}`,
    kind: "Site",
    label: site.name,
    detail: [site.locationName, siteKindWords(site.type), HEALTH_LABELS[site.health.state]].filter(Boolean).join(" · "),
    href: `/sites/${site.id}`
  }));
}
