import { defaultProfile } from "@/data/database";
import { Reading } from "@/types/domain";
import {
  buildReportModel,
  createReportCsv,
  createReportHistoryItems,
  planReportExport,
  reportFileName,
} from "@/utils/reports";

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
    expect(csv).toContain("Within your target range");
  });

  it("filters day, week, and month report ranges", () => {
    const readings = [
      { ...baseReading, id: "today", recordedAt: "2026-06-07T12:00:00.000Z" },
      { ...baseReading, id: "week", recordedAt: "2026-06-03T12:00:00.000Z" },
      { ...baseReading, id: "month", recordedAt: "2026-06-01T12:00:00.000Z" },
      { ...baseReading, id: "old", recordedAt: "2026-05-20T12:00:00.000Z" },
    ];

    expect(buildReportModel(readings, defaultProfile, "day", new Date("2026-06-07T13:00:00Z")).readingCount).toBe(1);
    expect(buildReportModel(readings, defaultProfile, "week", new Date("2026-06-07T13:00:00Z")).readingCount).toBe(3);
    expect(buildReportModel(readings, defaultProfile, "month", new Date("2026-06-07T13:00:00Z")).readingCount).toBe(3);
  });

  it("plans oversized month PDFs as split files", () => {
    const readings = Array.from({ length: 130 }, (_, index) => ({
      ...baseReading,
      id: `r-${index}`,
      recordedAt: `2026-06-${String((index % 28) + 1).padStart(2, "0")}T12:00:00.000Z`,
    }));
    const report = buildReportModel(readings, defaultProfile, "month", new Date("2026-06-28T13:00:00Z"));
    const plan = planReportExport(report, "pdf");

    expect(plan.shouldSplit).toBe(true);
    expect(plan.parts.length).toBeGreaterThan(1);
    expect(plan.parts[0].fileName).toContain("part-1.pdf");
  });

  it("generates predictable file names and report history metadata", () => {
    const report = buildReportModel([baseReading], defaultProfile, "day", new Date("2026-06-07T13:00:00Z"));
    const fileName = reportFileName(report, "pdf");
    const history = createReportHistoryItems(
      [
        {
          fileName,
          rangeType: report.rangeType,
          startDate: report.startDate,
          endDate: report.endDate,
          readingCount: report.readingCount,
          partIndex: 1,
          partCount: 1,
        },
      ],
      "web",
      "2026-06-07T14:00:00.000Z"
    );

    expect(fileName).toBe("dayrange-day-2026-06-07.pdf");
    expect(history[0]).toEqual(expect.objectContaining({ fileName, platform: "web", readingCount: 1 }));
  });
});
