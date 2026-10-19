import { DEMO_TENANT_ID, GREECON_COMPANY, GREECON_DOMAIN, GREECON_PUBLIC_EMAILS } from "@greecon/shared";
import { ChangePasswordForm } from "../../components/ChangePasswordForm";
import { Section } from "../../components/Section";
import { Shell } from "../../components/Shell";
import { apiGet } from "../../lib/api";
import { getSession } from "../../lib/session";
import { cycleWidgetSizeAction, loadWidgetPreferences, moveWidgetAction, toggleWidgetVisibilityAction } from "./actions";

// This page is only ever used for the SSR build (Railway/GCP) — see page.static.tsx for the
// static GitHub Pages twin, and build-static.sh for why the swap exists (the dashboard
// customization controls below bind real Server Actions).
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [widgets, session, tenants] = await Promise.all([loadWidgetPreferences(), getSession(), apiGet<Array<{ name: string; domain: string }>>("/tenants")]);
  // The organisation this account belongs to: the customer's own, not Greecon's.
  const tenant = tenants[0];
  // The demo tenant's logins are shared by everyone viewing the live demo — letting one visitor
  // change the password would lock out every other visitor using those same published
  // credentials. The API refuses this too (apps/api/src/modules/auth/auth.service.ts); this just
  // keeps the control from being offered in the first place.
  const isDemoTenant = session?.user.tenantId === DEMO_TENANT_ID;

  return (
    <Shell title="Settings" subtitle="Organization profile, dashboard customization, and future billing.">
      <Section title="Organization Profile">
        <div className="panel stack">
          <label>
            Organization
            <input value={tenant?.name ?? GREECON_COMPANY} readOnly />
          </label>
          <label>
            Identifier
            <input value={tenant?.domain ?? GREECON_DOMAIN} readOnly />
          </label>
          <p className="muted">
            To change the organization&apos;s name, or for anything about the account, write to <strong>{GREECON_PUBLIC_EMAILS[0]}</strong>. Who is told when
            something needs attention is under <a href="/settings/people">Who is told</a>.
          </p>
        </div>
      </Section>
      <div id="dashboard" />
      <Section title="Dashboard" aside={<span className="muted">Which cards show on your Overview page, their order, and size — this is your own view, not shared with teammates</span>}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Widget</th>
                <th>Visible</th>
                <th>Size</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {widgets.map((widget) => (
                <tr key={widget.key}>
                  <td>{widget.key}</td>
                  <td>
                    <form action={toggleWidgetVisibilityAction.bind(null, widget.key)}>
                      <button type="submit" className="button-ghost">
                        {widget.visible ? "Visible" : "Hidden"}
                      </button>
                    </form>
                  </td>
                  <td>
                    <form action={cycleWidgetSizeAction.bind(null, widget.key)}>
                      <button type="submit" className="button-ghost">
                        {widget.size.charAt(0).toUpperCase() + widget.size.slice(1)}
                      </button>
                    </form>
                  </td>
                  <td>
                    <div className="dashboard-order-controls">
                      <form action={moveWidgetAction.bind(null, widget.key, "up")}>
                        <button type="submit" className="button-ghost" aria-label={`Move ${widget.key} up`}>
                          ↑
                        </button>
                      </form>
                      <form action={moveWidgetAction.bind(null, widget.key, "down")}>
                        <button type="submit" className="button-ghost" aria-label={`Move ${widget.key} down`}>
                          ↓
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      {isDemoTenant ? null : (
        <Section title="Account Security" aside={<span className="muted">Changes only your own login</span>}>
          <ChangePasswordForm />
        </Section>
      )}
      <Section title="Operational Settings">
        <div className="metric-grid">
          <div className="panel">
            <h3>Notifications</h3>
            <p className="muted">Alert routing placeholder.</p>
          </div>
          <div className="panel">
            <h3>Billing</h3>
            <p className="muted">Stripe planned as a later module.</p>
          </div>
        </div>
      </Section>
    </Shell>
  );
}
