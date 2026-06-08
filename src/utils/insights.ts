import { Insight, Profile, Reading } from "@/types/domain";
import { formatGlucose } from "@/utils/glucose";
import { daysAgo, startOfLocalDay } from "@/utils/reports";

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildInsights(readings: Reading[], profile: Profile, now: Date): Insight[] {
  const recent = readings.filter((reading) => new Date(reading.recordedAt) >= daysAgo(now, 7));
  if (recent.length < 2) {
    return [];
  }

  const insights: Insight[] = [];
  const fasting = recent.filter((reading) => reading.timing === "fasting");
  const afterMeal = recent.filter((reading) => reading.timing === "after_meal");
  const walked = recent.filter((reading) => reading.tags.includes("walked") || reading.tags.includes("exercise"));
  const noWalk = recent.filter((reading) => !reading.tags.includes("walked") && !reading.tags.includes("exercise"));
  const highReadings = recent.filter((reading) => reading.glucoseMgdl > profile.targetHigh);

  const fastingAverage = average(fasting.map((reading) => reading.glucoseMgdl));
  if (fastingAverage !== null) {
    insights.push({
      id: "fasting-average",
      title: "Morning pattern",
      body: `Your logged fasting average this week is ${formatGlucose(fastingAverage, profile.unit)}. Bring repeated changes up with your care team.`,
    });
  }

  const afterMealAverage = average(afterMeal.map((reading) => reading.glucoseMgdl));
  if (afterMealAverage !== null) {
    insights.push({
      id: "after-meal-average",
      title: "After-meal context",
      body: `Your after-meal logs average ${formatGlucose(afterMealAverage, profile.unit)}. Meal notes and carbs make this pattern easier to interpret.`,
    });
  }

  const walkedAverage = average(walked.map((reading) => reading.glucoseMgdl));
  const noWalkAverage = average(noWalk.map((reading) => reading.glucoseMgdl));
  if (walkedAverage !== null && noWalkAverage !== null && walked.length >= 2 && noWalk.length >= 2) {
    const direction = walkedAverage < noWalkAverage ? "lower" : "higher";
    insights.push({
      id: "activity-compare",
      title: "Activity days",
      body: `Readings tagged with walking or exercise are ${direction} on average than other logged readings this week.`,
    });
  }

  if (highReadings.length) {
    const dinnerLike = highReadings.filter((reading) =>
      reading.tags.includes("high_carb_meal") || reading.mealLabel.toLowerCase().includes("dinner")
    );
    insights.push({
      id: "higher-readings",
      title: "Higher readings to review",
      body:
        dinnerLike.length > 0
          ? `${dinnerLike.length} higher readings were linked with dinner or high-carb meal context.`
          : `${highReadings.length} readings were higher than your target range this week.`,
    });
  }

  const bedtimeDays = new Set(
    recent
      .filter((reading) => reading.timing === "bedtime")
      .map((reading) => startOfLocalDay(new Date(reading.recordedAt)).toISOString())
  );
  const missingBedtime = Math.max(0, 7 - bedtimeDays.size);
  if (missingBedtime >= 3) {
    insights.push({
      id: "missing-bedtime",
      title: "Bedtime logging gap",
      body: `You have ${missingBedtime} days without a bedtime reading this week. More complete logs can improve summaries.`,
    });
  }

  return insights.slice(0, 5);
}
