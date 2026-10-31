"use client";

import { FormEvent, useState, useTransition } from "react";
import type { DeviceProposal, DiscoveryView } from "@greecon/shared";
import { findEquipmentAction, useFoundAddressesAction } from "../../app/sites/[siteId]/setup/actions";
import { Ago } from "../Ago";
import { StatusBadge } from "../StatusBadge";
import { Disclosure } from "./Disclosure";

/** How each device of the site stands after the box has looked, in the words of the setup list: a word and a shape first. */
const PROPOSAL_WORDS: Record<DeviceProposal["status"], { status: string; label: string }> = {
  already: { status: "Done", label: "Set" },
  found: { status: "To do", label: "Found" },
  missing: { status: "Needs attention", label: "Not found" },
  unsure: { status: "Needs attention", label: "Not sure which" },
  "by-hand": { status: "To do", label: "Enter by hand" }
};

/** "Find equipment": the person presses one button, the box looks at the site's network, and the addresses are filled in. What the box
 * saw is listed line by line in plain words, with what to check where something was not found. Nobody types an address unless the
 * equipment is something Greecon cannot recognise on a network. */
export function FindEquipmentPanel({ siteId, view, boxOnline, hasDevices }: { siteId: string; view: DiscoveryView; boxOnline: boolean; hasDevices: boolean }) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("502");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const waiting = view.state === "waiting";

  function find(event?: FormEvent<HTMLFormElement>, at?: { host: string; port: number }) {
    event?.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await findEquipmentAction(siteId, at?.host, at?.port);
      if (result.error) setError(result.error);
    });
  }

  function useAddresses() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await useFoundAddressesAction(siteId);
      if (result.error) setError(result.error);
      else setMessage(result.applied && result.applied.length > 0 ? `Done: ${result.applied.join(", ")}.` : "Nothing needed changing.");
    });
  }

  return (
    <div className="setup-find">
      <div className="setup-find__ask">
        <button type="button" className={view.allSet ? "button-ghost" : "button-primary"} onClick={() => find()} disabled={isPending || waiting || !boxOnline || !hasDevices}>
          {waiting ? "The box is looking…" : view.state === "done" ? "Look again" : "Find equipment"}
        </button>
        <p className="muted">
          {!hasDevices
            ? "Add the equipment the site has first (below). Then the box finds it."
            : boxOnline
              ? "The box looks at the site's network for the converter and what is on it, and the addresses are filled in. It only reads: it changes nothing on the equipment. It takes up to a minute."
              : "The box has to be online first: it is the one that looks. Do the step above, then come back."}
        </p>
      </div>

      {waiting ? (
        <p role="status" className="setup-find__status">
          The box is looking at the network now. This page updates by itself when it has the answer.
        </p>
      ) : null}
      {view.state === "expired" ? (
        <p role="alert" className="rule-actions__error">
          The box did not pick this up. Check that it shows as online in the step above, then press Find equipment again.
        </p>
      ) : null}

      {view.state === "done" || view.proposals.length > 0 ? (
        <div className="setup-find__result">
          {view.boxes.map((box) => (
            <p key={box.name} className="muted">
              {box.name} looked at {box.looked}, <Ago iso={box.finishedAtUtc} />.
            </p>
          ))}
          {view.proposals.length > 0 ? (
            <ul className="setup-items">
              {view.proposals.map((proposal) => {
                const words = PROPOSAL_WORDS[proposal.status];
                return (
                  <li key={proposal.deviceId} className="setup-item">
                    <StatusBadge status={words.status} label={words.label} />
                    <span>
                      <strong>{proposal.name}</strong>
                      <span className="setup-item__detail">{proposal.message}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {view.toApply > 0 ? (
            <p>
              <button type="button" className="button-primary" onClick={useAddresses} disabled={isPending}>
                {view.toApply === 1 ? "Use this address" : `Use these ${view.toApply} addresses`}
              </button>{" "}
              <span className="muted">These were found somewhere other than where they are set now.</span>
            </p>
          ) : null}
          {view.allSet ? (
            <p role="status" className="form-success">
              Every device has the address it was found at. The box picks them up within a minute.
            </p>
          ) : null}
          {view.unclaimed.length > 0 ? (
            <div className="setup-guidance">
              <p>
                <strong>Also answering, and not part of this site&apos;s equipment:</strong>
              </p>
              <ul>
                {view.unclaimed.map((found) => (
                  <li key={`${found.host}-${found.port}-${found.unit}`}>
                    {found.host}, unit {found.unit}: {found.seen}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {view.notes.map((note) => (
            <p key={note} className="muted">
              {note}
            </p>
          ))}
        </div>
      ) : null}

      <Disclosure summary="I know the converter's address">
        <form onSubmit={(event) => find(event, { host, port: Number(port) })} className="setup-inline-form" aria-label="Look at one address">
          <label>
            Converter&apos;s IP address
            <input value={host} onChange={(event) => setHost(event.target.value)} placeholder="192.168.1.50" inputMode="decimal" required />
          </label>
          <label>
            Port
            <input value={port} onChange={(event) => setPort(event.target.value)} inputMode="numeric" size={5} />
          </label>
          <button type="submit" disabled={isPending || waiting || !boxOnline || !hasDevices}>
            Look at this address
          </button>
        </form>
      </Disclosure>

      {message ? (
        <p role="status" className="form-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rule-actions__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
