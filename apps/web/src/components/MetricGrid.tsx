import { Metric } from "../lib/types";
import { StatusBadge } from "./StatusBadge";

export function MetricGrid({ metrics }: { metrics: Metric[] }) {
  return (
    <section className="metric-grid" aria-label="Operational metrics">
      {metrics.map((metric, index) => (
        <article className={`metric-card metric-card--${metric.size ?? "medium"}${metric.stale ? " metric-card--stale" : ""}`} key={`${metric.label}-${index}`}>
          <div className="metric-card__header">
            <p>{metric.label}</p>
            {metric.status ? <StatusBadge status={metric.status} /> : null}
          </div>
          <div className="metric-card__value">
            <span>{metric.value}</span>
            {metric.unit ? <small>{metric.unit}</small> : null}
          </div>
          <p className="muted metric-card__note">{metric.note}</p>
        </article>
      ))}
    </section>
  );
}
