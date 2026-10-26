import { ReactNode } from "react";
import type { SetupStep } from "@greecon/shared";
import { STEP_STATUS_WORDS } from "../../lib/setup";
import { StatusBadge } from "../StatusBadge";
import { StepDetails } from "./StepDetails";
import { InlineText } from "../InlineText";

/** One step of a site's setup list: what is true now, what to do next, the parts it covers, and (on the live
 * page) the form for doing it. `open` says whether the step should be open now; the reader can still close it. */
export function SetupStepCard({ step, number, open, hideItems = false, children }: { step: SetupStep; number: number; open: boolean; hideItems?: boolean; children?: ReactNode }) {
  return (
    <li>
      <StepDetails
        id={`step-${step.key}`}
        shouldOpen={open}
        summary={
          <>
            <span className="setup-step__number" aria-hidden="true">
              {number}
            </span>
            <span>
              <span className="setup-step__title">
                {step.title}
                {step.optional ? <span className="muted"> (optional)</span> : null}
              </span>
              <span className="setup-step__detail">{step.detail}</span>
            </span>
            <StatusBadge status={STEP_STATUS_WORDS[step.status]} />
          </>
        }
      >
        <div className="setup-step__body">
          {step.nextAction ? (
            <div className="setup-guidance">
              <p>
                <strong>Next:</strong> <InlineText text={step.nextAction} />
              </p>
            </div>
          ) : null}
          {!hideItems && step.items && step.items.length > 0 ? (
            <ul className="setup-items">
              {step.items.map((item, index) => (
                <li key={`${item.label}-${index}`} className="setup-item">
                  <StatusBadge status={STEP_STATUS_WORDS[item.status]} />
                  <span>
                    <strong>{item.label}</strong>
                    {item.detail ? <span className="setup-item__detail">{item.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {children}
        </div>
      </StepDetails>
    </li>
  );
}

export function SetupProgress({ done, total, commissioned }: { done: number; total: number; commissioned: boolean }) {
  return (
    <div className="setup-progress">
      <p className="setup-progress__words">
        {commissioned ? "Commissioned. " : ""}
        {done} of {total} steps done
      </p>
      <progress max={total} value={done} aria-label={`${done} of ${total} steps done`} />
    </div>
  );
}
