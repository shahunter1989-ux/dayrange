import { formatGlucose, fromMgdl, isValidGlucose, readingRangeLabel, toMgdl } from "@/utils/glucose";

describe("glucose utilities", () => {
  it("converts mmol/L and mg/dL consistently", () => {
    expect(toMgdl(7.2, "mmol/L")).toBe(130);
    expect(fromMgdl(126, "mmol/L")).toBe(7);
    expect(formatGlucose(132, "mg/dL")).toBe("132 mg/dL");
  });

  it("classifies values against user target range", () => {
    expect(readingRangeLabel(68, 70, 180)).toBe("Below your target range");
    expect(readingRangeLabel(120, 70, 180)).toBe("Within your target range");
    expect(readingRangeLabel(205, 70, 180)).toBe("Higher than your target range");
  });

  it("validates plausible glucose values by unit", () => {
    expect(isValidGlucose(132, "mg/dL")).toBe(true);
    expect(isValidGlucose(7.3, "mmol/L")).toBe(true);
    expect(isValidGlucose(900, "mg/dL")).toBe(false);
    expect(isValidGlucose(0.2, "mmol/L")).toBe(false);
  });
});
