"use client";

import { FormEvent, useState, useTransition } from "react";
import { createManualCommandAction } from "../lib/actions/commands";

export interface ManualControlTarget {
  pointId: string;
  deviceId: string;
  deviceName: string;
  siteId: string;
  siteName?: string;
  canonicalName: string;
  label: string;
  unit: string;
}

// The manual path for any command-capable point (irrigation valves, pumps, and any future writable
// actuator): it posts to /commands, the same endpoint and the same operating-limit checks that
// automated rules use. In this build every command is a simulation and the panel says so; rules, not
// AI, decide in automatic mode, and this is the explicit route a farmer or operator uses to ask for
// equipment to run on demand.
export function ManualControlPanel({ targets, emptyMessage }: { targets: ManualControlTarget[]; emptyMessage: string }) {
  const [selectedKey, setSelectedKey] = useState(targets[0] ? targetKey(targets[0]) : "");
  const [value, setValue] = useState("ON");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("30");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (targets.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  // targets.length === 0 already returned above, so targets[0] is guaranteed to exist here.
  const selected = targets.find((target) => targetKey(target) === selectedKey) ?? (targets[0] as ManualControlTarget);
  const isStatePoint = selected.unit === "state";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 8) {
      setResult("Blocked: a reason of at least 8 characters is required before dispatch.");
      return;
    }
    setConfirming(true);
  }

  function confirm() {
    setConfirming(false);
    const target = selected;
    const requestedValue = isStatePoint ? value : Number(value);
    startTransition(async () => {
      const response = await createManualCommandAction({
        siteId: target.siteId,
        targetDeviceId: target.deviceId,
        targetPointId: target.pointId,
        requestedValue,
        reason,
        durationMinutes: Number(duration)
      });
      if (response.error) {
        setResult(response.error);
      } else if (response.dispatchStatus === "blocked") {
        setResult(`Not sent. Blocked by an operating limit: ${response.failureReason ?? "the checks did not pass."}`);
      } else {
        // Every command is a simulation in this build, and the wording must not suggest otherwise:
        // an operator who reads "dispatched" believes the pump was started.
        setResult(`Simulated only. ${target.label} was not changed: nothing is sent to equipment yet. The request, the checks it passed and who made it are recorded.`);
      }
    });
  }

  return (
    <div className="override-panel">
      <form onSubmit={submit}>
        <label>
          Target
          <select value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
            {targets.map((target) => (
              <option key={targetKey(target)} value={targetKey(target)}>
                {target.siteName ? `${target.siteName} — ` : ""}
                {target.deviceName} · {target.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Set value
          {isStatePoint ? (
            <select value={value} onChange={(event) => setValue(event.target.value)}>
              <option value="ON">ON</option>
              <option value="OFF">OFF</option>
            </select>
          ) : (
            <input type="number" value={value} onChange={(event) => setValue(event.target.value)} />
          )}
        </label>
        <label>
          Reason
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this manual action is needed" />
        </label>
        <label>
          Duration
          <select value={duration} onChange={(event) => setDuration(event.target.value)}>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
            <option value="120">120 minutes</option>
          </select>
        </label>
        <button type="submit" disabled={isPending}>
          Run Manually
        </button>
      </form>
      {result ? <p className="muted">{result}</p> : null}
      {confirming ? (
        <div className="dialog" role="dialog" aria-modal="true" aria-label="Confirm manual command">
          <div>
            <strong>Confirm manual command</strong>
            <p>
              {selected.label} on {selected.deviceName} will be set to {isStatePoint ? value : Number(value)} for up to {duration} minutes. Hard
              safety rules (e.g. dry-run protection) still apply and can block this dispatch.
            </p>
            <div className="dialog__actions">
              <button type="button" className="button-ghost" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" onClick={confirm} disabled={isPending}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function targetKey(target: ManualControlTarget): string {
  return `${target.deviceId}::${target.pointId}`;
}
