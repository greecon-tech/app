import { SiteProfile, SiteValue } from "@greecon/shared";
import { SiteProfileForm } from "./SiteProfileForm";
import { ValueView } from "./ValueView";

/** The value of a site with the form that sets its prices, for people who may change them. Only the
 * live app uses this: the form is a server action, which the static demo cannot contain. */
export function ValueSection({ value, siteId, profile, periodHref }: { value: SiteValue; siteId: string; profile?: SiteProfile; periodHref?: (period: string) => string }) {
  return (
    <ValueView value={value} periodHref={periodHref} canEdit={profile !== undefined}>
      {profile ? <SiteProfileForm siteId={siteId} profile={profile} /> : null}
    </ValueView>
  );
}
