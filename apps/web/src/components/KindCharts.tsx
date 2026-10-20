import { TimeSeriesChart, TimeSeriesPoint } from "./TimeSeriesChart";

/** A chart for each point that has this kind of reading (two tanks are two charts, numbered), or one empty chart
 * that says there is nothing yet. Shared by the live Analytics page and its static twin. */
export function kindCharts(metric: { canonicalName: string; label: string; unit: string }, series: TimeSeriesPoint[][] | undefined) {
  const lines = series && series.length > 0 ? series : [[]];
  return lines.map((data, index) => (
    <TimeSeriesChart key={`${metric.canonicalName}-${index}`} title={lines.length > 1 ? `${metric.label} (${index + 1})` : metric.label} unit={metric.unit} data={data} />
  ));
}
