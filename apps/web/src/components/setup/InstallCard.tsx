import { GREECON_COMPANY, GREECON_DOMAIN, GREECON_PUBLIC_EMAILS, type InstallCardView } from "@greecon/shared";
import { CopyText } from "./CopyText";

/** The card a project manager takes to the site (and the three messages that go to the customer). Everything on it comes from the site's own
 * equipment, so it lists what the site has and nothing it does not. Printed, it is only the card: the messages stay on the screen. */
export function InstallCard({ view }: { view: InstallCardView }) {
  return (
    <article className="handover install-card">
      <header className="handover__letterhead">
        <img src={`${process.env.NEXT_BASE_PATH ?? ""}/greecon-logo.svg`} alt="Greecon" width="32" height="45" />
        <div>
          <strong>{GREECON_COMPANY}</strong>
          <span>
            {GREECON_DOMAIN} · {GREECON_PUBLIC_EMAILS[0]}
          </span>
        </div>
        <p>Install card</p>
      </header>

      <section>
        <h2>{view.siteName}</h2>
        <dl>
          {view.customer ? (
            <>
              <dt>Customer</dt>
              <dd>{view.customer}</dd>
            </>
          ) : null}
          <dt>Place</dt>
          <dd>{view.locationName}</dd>
          {view.templateName ? (
            <>
              <dt>Kind of site</dt>
              <dd>{view.templateName}</dd>
            </>
          ) : null}
        </dl>
        <p className="muted">
          Greecon only reads. Nothing here switches anything on or off, and Greecon is not a safety system. The electrical work is the licensed electrician&apos;s.
        </p>
      </section>

      {view.ask.length > 0 ? (
        <section>
          <h2>Ask the customer, and look at, before the day</h2>
          <ul>
            {view.ask.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2>Bring</h2>
        <ul>
          {view.bring.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>What each device is set to</h2>
        <p>
          Everything on one cable is set to the same speed: <strong>{view.serial}</strong>. These were set at the office. Check the label on each; do not change them.
        </p>
        {view.devices.length === 0 ? <div className="empty-state">No equipment has been added to this site yet.</div> : null}
        {view.devices.map((device) => (
          <div key={device.name} className="setup-device">
            <div className="setup-device__head">
              <strong>
                {device.name}
                {device.optional ? <span className="muted"> (only if the site has one)</span> : null}
              </strong>
              <span>{device.unit !== undefined ? <>Number on the cable: <strong>{device.unit}</strong></> : null}</span>
            </div>
            <p className="muted">
              {device.model}. {device.purpose}
            </p>
            {device.delivered ? <p className="muted">Delivered at {device.delivered}; set to the speed above at the office.</p> : null}
            {device.wiring.length > 0 ? (
              <ul>
                {device.wiring.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </section>

      <section>
        <h2>The converter</h2>
        <p>Set at the office. If it ever has to be set again:</p>
        <dl>
          {view.converter.map((row) => (
            <div key={row.setting} className="install-card__row">
              <dt>{row.setting}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2>The cable</h2>
        <ul>
          {view.cable.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>What the customer&apos;s network is asked for</h2>
        <ul>
          {view.network.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>The visit, in order</h2>
        <ol>
          {view.visit.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </section>

      <section className="no-print install-card__messages">
        <h2>Messages to the customer</h2>
        <p className="muted">
          The same three for every site, with this site&apos;s name in them. What is in [square brackets] is for you to fill in before you send. The Albanian is a
          draft: have someone who writes Albanian every day read it before you send it.
        </p>
        {view.messages.map((message) => (
          <div key={message.key} className="setup-device">
            <div className="setup-device__head">
              <strong>{message.title}</strong>
            </div>
            <p className="muted">{message.when}</p>
            <CopyText text={message.english} label="Copy the English" name={`${message.title}, English`} />
            <details className="limits">
              <summary>Albanian draft</summary>
              <CopyText text={message.albanian} label="Copy the Albanian" name={`${message.title}, Albanian draft`} />
            </details>
          </div>
        ))}
      </section>
    </article>
  );
}
