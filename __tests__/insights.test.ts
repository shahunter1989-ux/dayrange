import { defaultProfile } from "@/data/database";
import { Reading } from "@/types/domain";
import { buildInsights } from "@/utils/insights";

function reading(partial: Partial<Reading>): Reading {
  return {
    id: partial.id ?? Math.random().toString(),
    glucoseMgdl: partial.glucoseMgdl ?? 130,
    displayValue: partial.displayValue ?? 130,
    displayUnit: partial.displayUnit ?? "mg/dL",
    recordedAt: partial.recordedAt ?? "2026-06-07T12:00:00.000Z",
    timing: partial.timing ?? "fasting",
    mealLabel: partial.mealLabel ?? "",
    carbsGrams: partial.carbsGrams ?? null,
    medicationNote: "",
    activityNote: "",
    notes: "",
    tags: partial.tags ?? [],
    symptoms: partial.symptoms ?? ["normal"],
    mood: partial.mood ?? null,
    source: "manual",
    createdAt: partial.createdAt ?? "2026-06-07T12:00:00.000Z",
  };
}

describe("insights", () => {
  it("returns no insights when there is too little data", () => {
    expect(buildInsights([reading({})], defaultProfile, new Date("2026-06-07T12:00:00Z"))).toEqual([]);
  });

  it("uses neutral pattern wording and avoids treatment advice", () => {
    const insights = buildInsights(
      [
        reading({ glucoseMgdl: 145, timing: "fasting" }),
        reading({ glucoseMgdl: 190, timing: "after_meal", tags: ["high_carb_meal"], mealLabel: "dinner" }),
        reading({ glucoseMgdl: 118, timing: "bedtime", tags: ["walked"] }),
      ],
      defaultProfile,
      new Date("2026-06-07T12:00:00Z")
    );
    const text = insights.map((insight) => `${insight.title} ${insight.body}`).join(" ");
    expect(text).toContain("pattern");
    expect(text.toLowerCase()).not.toContain("take ");
    expect(text.toLowerCase()).not.toContain("dose");
    expect(text.toLowerCase()).not.toContain("treat");
  });
});
