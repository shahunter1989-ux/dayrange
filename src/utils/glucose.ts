import { GlucoseUnit } from "@/types/domain";

const MMOL_FACTOR = 18.0182;

export function toMgdl(value: number, unit: GlucoseUnit): number {
  return unit === "mg/dL" ? Math.round(value) : Math.round(value * MMOL_FACTOR);
}

export function fromMgdl(value: number, unit: GlucoseUnit): number {
  return unit === "mg/dL" ? Math.round(value) : Number((value / MMOL_FACTOR).toFixed(1));
}

export function formatGlucose(valueMgdl: number, unit: GlucoseUnit): string {
  return `${fromMgdl(valueMgdl, unit)} ${unit}`;
}

export function readingRangeLabel(valueMgdl: number, targetLow: number, targetHigh: number): string {
  if (valueMgdl < targetLow) {
    return "Below your target range";
  }
  if (valueMgdl > targetHigh) {
    return "Higher than your target range";
  }
  return "Within your target range";
}

export function isValidGlucose(value: number, unit: GlucoseUnit): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }
  return unit === "mg/dL" ? value >= 20 && value <= 600 : value >= 1.1 && value <= 33.3;
}
