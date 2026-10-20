import { CurrencyCode, SiteValue } from "@greecon/shared";
import { Metric } from "./types";

const numbers = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: amount >= 100 ? 0 : 2 }).format(amount);
}

export function formatQuantity(amount: number): string {
  return amount >= 100 ? numbers.format(amount) : oneDecimal.format(amount);
}

/** The answer in one sentence, before any number: what the site's own readings are worth, or what is
 * needed to say. Never a promise about the future, and never a figure the readings do not support. */
export function valueHeadline(value: SiteValue): string {
  const label = value.period.label;
  const { energy, water, prices, currency } = value;

  if (energy?.keptOnSiteKwh !== undefined) {
    const kept = `${formatQuantity(energy.keptOnSiteKwh)} kWh`;
    if (energy.avoidedPurchase !== undefined && prices.importPerKwh !== undefined) {
      return `${label}: your solar kept ${kept} on site, worth about ${formatMoney(energy.avoidedPurchase, currency)} at your price of ${formatMoney(prices.importPerKwh, currency)} per kWh.`;
    }
    return `${label}: your solar kept ${kept} on site. Enter your electricity price to see what that is worth.`;
  }
  if (energy?.producedKwh !== undefined) {
    return `${label}: solar produced ${formatQuantity(energy.producedKwh)} kWh. How much stayed on site is not known, because the grid export is not measured.`;
  }
  if (energy?.importedKwh !== undefined) {
    const cost = energy.boughtCost !== undefined ? `, costing about ${formatMoney(energy.boughtCost, currency)}` : "";
    return `${label}: ${formatQuantity(energy.importedKwh)} kWh bought from the grid${cost}.`;
  }
  if (water?.pumpedM3 !== undefined) {
    const cost = water.cost !== undefined ? `, costing about ${formatMoney(water.cost, currency)}` : "";
    return `${label}: ${formatQuantity(water.pumpedM3)} m³ of water pumped${cost}.`;
  }
  return `${label}: nothing has been counted yet.`;
}

/** The figures as cards, each with the money beside it only when the site has entered a price. */
export function valueMetrics(value: SiteValue): Metric[] {
  const { energy, water, currency } = value;
  const metrics: Metric[] = [];
  const money = (amount: number | undefined, prefix: string): string | undefined => (amount === undefined ? undefined : `${prefix} ${formatMoney(amount, currency)}`);

  if (energy?.producedKwh !== undefined) metrics.push({ label: "Solar produced", value: formatQuantity(energy.producedKwh), unit: "kWh", note: "measured at the inverter" });
  if (energy?.keptOnSiteKwh !== undefined) {
    metrics.push({ label: "Used on site", value: formatQuantity(energy.keptOnSiteKwh), unit: "kWh", note: money(energy.avoidedPurchase, "worth about") ?? "from your own solar" });
  }
  if (energy?.exportedKwh !== undefined) {
    metrics.push({ label: "Sent to the grid", value: formatQuantity(energy.exportedKwh), unit: "kWh", note: money(energy.exportIncome, "earned about") ?? "export price not set" });
  }
  if (energy?.importedKwh !== undefined) {
    metrics.push({ label: "Bought from the grid", value: formatQuantity(energy.importedKwh), unit: "kWh", note: money(energy.boughtCost, "costing about") ?? "electricity price not set" });
  }
  if (energy?.solarShareOfUsePercent !== undefined) {
    metrics.push({ label: "Solar share of use", value: formatQuantity(energy.solarShareOfUsePercent), unit: "%", note: "of the electricity the site used" });
  }
  if (water?.pumpedM3 !== undefined) {
    metrics.push({ label: "Water pumped", value: formatQuantity(water.pumpedM3), unit: "m³", note: money(water.cost, "costing about") ?? "water price not set" });
  }
  return metrics;
}

export const periodOptions: ReadonlyArray<{ key: "day" | "week" | "month" | "last30"; label: string }> = [
  { key: "day", label: "Today" },
  { key: "week", label: "7 days" },
  { key: "month", label: "This month" },
  { key: "last30", label: "30 days" }
];
