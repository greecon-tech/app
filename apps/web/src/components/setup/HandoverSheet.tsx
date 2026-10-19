import type { HandoverView } from "@greecon/shared";
import { CONTACT_WORDS, STEP_STATUS_WORDS } from "../../lib/setup";
import { DataTable } from "../DataTable";
import { StatusBadge } from "../StatusBadge";

/** "2026-10-19 10:42 UTC": the same words on the server and in the browser, and on paper. */
function utc(iso: string | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function money(value: number | undefined, currency: string, per: string): string {
  return value === undefined ? "not set" : `${value} ${currency} per ${per}`;
}

function shown(value: number | boolean | string, unit: string): string {
  if (unit === "state") return value === true || value === 1 || value === "1" || value === "on" ? "On" : "Off";
  const text = typeof value === "number" ? String(Number(value.toFixed(3))) : String(value);
  return unit ? `${text} ${unit}` : text;
}

/** What the customer is given when a site is commissioned, and what the next person to visit it needs: what
 * is installed, where it is on the network, what each reading says now, which limits apply, who confirmed
 * what. Everything is worked out by the platform from the site as it is. */
export function HandoverSheet({ view }: { view: HandoverView }) {
  const open = view.steps.filter((step) => step.status !== "done" && !step.optional).length;
  return (
    <article className="handover">
      <section>
        <h2>{view.site.name}</h2>
        <dl>
          <dt>Customer</dt>
          <dd>{view.customer}</dd>
          <dt>Place</dt>
          <dd>
            {view.site.locationName} ({view.site.type.replace(/_/g, " ")})
          </dd>
          <dt>Status</dt>
          <dd>
            {view.commissioned
              ? `Commissioned${view.commissionedBy ? ` by ${view.commissionedBy}` : ""} on ${utc(view.commissionedAtUtc)}.`
              : `Not commissioned yet: ${open} ${open === 1 ? "step" : "steps"} still open.`}
          </dd>
          <dt>Made</dt>
          <dd>{utc(view.generatedAtUtc)}</dd>
        </dl>
      </section>

      <section>
        <h2>The box</h2>
        <DataTable
          wide={false}
          rows={view.gateways}
          emptyLabel="No box has been installed."
          columns={[
            { key: "name", label: "Name" },
            { key: "contact", label: "Now", render: (row) => <StatusBadge status={CONTACT_WORDS[row.contact]} /> },
            { key: "softwareVersion", label: "Version", render: (row) => row.softwareVersion ?? "—" },
            { key: "lastSeenUtc", label: "Last heard from", render: (row) => utc(row.lastSeenUtc) },
            { key: "enrolledAtUtc", label: "Installed", render: (row) => utc(row.enrolledAtUtc) }
          ]}
        />
      </section>

      <section>
        <h2>Equipment and readings</h2>
        {view.devices.length === 0 ? <div className="empty-state">No equipment has been added.</div> : null}
        {view.devices.map((device) => (
          <div key={device.name} className="setup-device">
            <div className="setup-device__head">
              <strong>{device.name}</strong>
              <span className="muted">{device.deviceType.replace(/_/g, " ")}</span>
            </div>
            <p className="muted">
              {device.address ? `Reached at ${device.address}.` : "No network address entered."}
              {device.placementNote ? ` ${device.placementNote}` : ""}
            </p>
            <DataTable
              wide={false}
              rows={device.readings}
              columns={[
                { key: "label", label: "Reading" },
                { key: "register", label: "Register", render: (row) => row.register ?? "not tied to a register" },
                {
                  key: "latestValue",
                  label: "Now",
                  render: (row) => (row.latestValue === undefined ? "No reading yet" : `${shown(row.latestValue, row.unit)} · ${utc(row.latestAtUtc)}`)
                },
                {
                  key: "current",
                  label: "State",
                  render: (row) => (row.latestValue === undefined ? "—" : row.current ? "Current" : <StatusBadge status="Out of date" />)
                },
                {
                  key: "limits",
                  label: "Limits in force",
                  render: (row) =>
                    row.limits.length === 0 ? (
                      "—"
                    ) : (
                      <ul className="setup-items">
                        {row.limits.map((limit) => (
                          <li key={limit.key}>
                            {limit.label}: {limit.value}
                            {limit.standard ? " (standard)" : ""}
                          </li>
                        ))}
                      </ul>
                    )
                }
              ]}
            />
          </div>
        ))}
      </section>

      <section>
        <h2>Prices and settings</h2>
        <dl>
          <dt>Electricity bought</dt>
          <dd>{money(view.profile.importPricePerKwh, view.profile.currency, "kWh")}</dd>
          <dt>Electricity sold</dt>
          <dd>{money(view.profile.exportPricePerKwh, view.profile.currency, "kWh")}</dd>
          <dt>Water</dt>
          <dd>{money(view.profile.waterPricePerM3, view.profile.currency, "m³")}</dd>
          <dt>Selling to the grid</dt>
          <dd>{view.profile.zeroExport ? "Not allowed: the site must not send energy to the grid." : "Allowed."}</dd>
          <dt>Clock</dt>
          <dd>{view.profile.timezone}</dd>
        </dl>
      </section>

      <section>
        <h2>Setup record</h2>
        <DataTable
          wide={false}
          rows={view.steps}
          columns={[
            { key: "title", label: "Step" },
            { key: "status", label: "State", render: (row) => <StatusBadge status={STEP_STATUS_WORDS[row.status]} /> },
            {
              key: "confirmedBy",
              label: "Confirmed by",
              render: (row) => (row.confirmedBy ? `${row.confirmedBy}, ${utc(row.confirmedAtUtc)}${row.note ? `. “${row.note}”` : ""}` : "—")
            }
          ]}
        />
      </section>

      <section>
        <h2>People with access</h2>
        <DataTable
          wide={false}
          rows={view.people}
          emptyLabel="Nobody else has an account yet."
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "role", label: "Role" }
          ]}
        />
      </section>

      <section>
        <h2>If something looks wrong</h2>
        <p>
          Write to <strong>{view.support.email}</strong> and say which site and what you see. Greecon answers on working days.
        </p>
      </section>

      <div className="handover__sign">
        <div>Installed by (name and date)</div>
        <div>Received by, for {view.customer} (name and date)</div>
      </div>
    </article>
  );
}
