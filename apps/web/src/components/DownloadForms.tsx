import { hasPermission, UserRole } from "@greecon/shared";

// What the account can take away, as plain forms that ask /export/<kind> for a file (no script needed: the
// browser's own download does the rest). The Reports page and nothing else uses them.

const PERIODS = [
  { days: 7, label: "The last 7 days" },
  { days: 31, label: "The last 31 days" },
  { days: 90, label: "The last 90 days" },
  { days: 366, label: "The last year" }
] as const;

const STYLES = (
  <label>
    For
    <select name="style" defaultValue="standard">
      <option value="standard">Any spreadsheet (commas)</option>
      <option value="eu">Excel with European settings (semicolons and decimal commas)</option>
    </select>
  </label>
);

export function DownloadForms({ sites, role }: { sites: Array<{ id: string; name: string }>; role: UserRole }) {
  return (
    <div className="stack">
      <p className="muted">
        Your data is yours. Everything below downloads as a file you can keep, open in a spreadsheet or hand to your accountant or consultant. Each download is
        written in the audit log with who took it.
      </p>

      <form method="get" action="/export/readings" className="rule-form" aria-label="Download readings">
        <h3>Readings</h3>
        <p className="muted">What each sensor read, one row per reading. Hourly averages go back a year; every reading goes back up to 31 days. Times are given in UTC and on the site&apos;s own clock.</p>
        <div className="rule-form__grid">
          <label>
            Site
            <select name="siteId" required defaultValue={sites[0]?.id}>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Period
            <select name="days" defaultValue="31">
              {PERIODS.map((period) => (
                <option key={period.days} value={period.days}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Detail
            <select name="resolution" defaultValue="hourly">
              <option value="hourly">Hourly averages</option>
              <option value="raw">Every reading (up to 31 days)</option>
            </select>
          </label>
          {STYLES}
        </div>
        <div className="rule-form__footer">
          <button type="submit" disabled={sites.length === 0}>
            Download readings
          </button>
          {sites.length === 0 ? <span className="muted">There is no site yet.</span> : null}
        </div>
      </form>

      <form method="get" action="/export/alerts" className="rule-form" aria-label="Download alerts">
        <h3>Alerts</h3>
        <p className="muted">Every alert: when it was raised, how urgent, what to do first, and what became of it.</p>
        <div className="rule-form__grid">
          <label>
            Period
            <select name="days" defaultValue="90">
              {PERIODS.map((period) => (
                <option key={period.days} value={period.days}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>
          {STYLES}
        </div>
        <div className="rule-form__footer">
          <button type="submit">Download alerts</button>
        </div>
      </form>

      {hasPermission(role, "audit:read") ? (
        <form method="get" action="/export/audit" className="rule-form" aria-label="Download the audit log">
          <h3>Audit log</h3>
          <p className="muted">Who did what, and when: sign-ins, changes to equipment and limits, commands, acknowledgements and downloads.</p>
          <div className="rule-form__grid">{STYLES}</div>
          <div className="rule-form__footer">
            <button type="submit">Download the audit log</button>
          </div>
        </form>
      ) : null}

      {hasPermission(role, "settings:manage") ? (
        <div className="rule-form">
          <h3>Everything about how the account is set up</h3>
          <p className="muted">
            One file with the account&apos;s people, sites, equipment, registers and limits, who is told when something needs attention, and its alerts and tasks.
            Passwords and the boxes&apos; credentials are not in it.
          </p>
          <div className="rule-form__footer">
            <a className="button-ghost" href="/export/account" download>
              Download the account (JSON)
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
