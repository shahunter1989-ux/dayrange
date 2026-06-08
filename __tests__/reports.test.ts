import { defaultProfile } from "@/data/database";
import { Reading } from "@/types/domain";
import { buildReportModel, createReportCsv } from "@/utils/reports";

const baseReading: Reading = {
  id: "r1",
  glucoseMgdl: 132,
  displayValue: 132,
  displayUnit: "mg/dL",
  recordedAt: "2026-06-07T12:00:00.000Z",
  timing: "fasting",
  mealLabel: "eggs",
  carbsGrams: 12,
  medicationNote: "Metformin taken",
  activityNote: "",
  notes: "felt normal",
  tags: ["walked"],
  symptoms: ["normal"],
  mood: "calm",
  source: "manual",
  createdAt: "2026-06-07T12:00:00.000Z",
};

describe("reports", () => {
  it("filters readings to the requested date range", () => {
    const report = buildReportModel(
      [
        baseReading,
        { ...baseReading, id: "old", recordedAt: "2026-05-01T12:00:00.000Z" },
      ],
      defaultProfile,
      7,
      new Date("2026-06-07T13:00:00Z")
    );
    expect(report.readingCount).toBe(1);
    expect(report.averageLabel).toBe("132 mg/dL");
  });

  it("generates escaped CSV rows", () => {
    const report = buildReportModel(
      [{ ...baseReading, notes: "coffee, toast" }],
      defaultProfile,
      7,
      new Date("2026-06-07T13:00:00Z")
    );
    const csv = createReportCsv(report);
    expect(csv).toContain("recorded_at,glucose_mgdl");
    expect(csv).toContain('"coffee, toast"');
  });
});
