import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { DISCLAIMER } from "@/constants/options";
import { Profile, Reading, ReportRange } from "@/types/domain";
import { formatGlucose } from "@/utils/glucose";

export type ReportModel = {
  title: string;
  rangeDays: ReportRange | 1;
  rangeLabel: string;
  profile: Profile;
  readings: Reading[];
  readingCount: number;
  inRangeCount: number;
  averageMgdl: number | null;
  averageLabel: string;
  highestLabel: string;
  lowestLabel: string;
  fastingTrendLabel: string;
  afterMealTrendLabel: string;
  summaryBullets: string[];
};

export function daysAgo(now: Date, days: number): Date {
  const start = startOfLocalDay(now);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameLocalDay(value: string, date: Date): boolean {
  const source = new Date(value);
  return startOfLocalDay(source).getTime() === startOfLocalDay(date).getTime();
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trendLabel(readings: Reading[], profile: Profile): string {
  if (readings.length < 2) {
    return "Not enough readings yet";
  }
  const sorted = [...readings].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
  );
  const midpoint = Math.floor(sorted.length / 2);
  const first = average(sorted.slice(0, midpoint).map((reading) => reading.glucoseMgdl));
  const second = average(sorted.slice(midpoint).map((reading) => reading.glucoseMgdl));
  if (first === null || second === null) {
    return "Not enough readings yet";
  }
  const difference = second - first;
  if (Math.abs(difference) < 5) {
    return "About the same";
  }
  return difference > 0
    ? `Trending higher by about ${formatGlucose(Math.abs(difference), profile.unit)}`
    : `Trending lower by about ${formatGlucose(Math.abs(difference), profile.unit)}`;
}

export function buildReportModel(
  allReadings: Reading[],
  profile: Profile,
  rangeDays: ReportRange | 1,
  now: Date
): ReportModel {
  const rangeStart = daysAgo(now, rangeDays);
  const readings = allReadings
    .filter((reading) => new Date(reading.recordedAt) >= rangeStart)
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  const glucoseValues = readings.map((reading) => reading.glucoseMgdl);
  const averageMgdl = average(glucoseValues);
  const highest = glucoseValues.length ? Math.max(...glucoseValues) : null;
  const lowest = glucoseValues.length ? Math.min(...glucoseValues) : null;
  const inRangeCount = readings.filter(
    (reading) => reading.glucoseMgdl >= profile.targetLow && reading.glucoseMgdl <= profile.targetHigh
  ).length;
  const fasting = readings.filter((reading) => reading.timing === "fasting");
  const afterMeal = readings.filter((reading) => reading.timing === "after_meal");
  const taggedMeals = readings.filter((reading) => reading.mealLabel || reading.carbsGrams !== null).length;

  const summaryBullets = [
    `${readings.length} readings logged in this range.`,
    `${inRangeCount} readings were within the target range set in the profile.`,
    `Fasting trend: ${trendLabel(fasting, profile)}.`,
    `After-meal trend: ${trendLabel(afterMeal, profile)}.`,
    `${taggedMeals} readings include meal or carbohydrate context.`,
  ];

  return {
    title: "DayRange Glucose Report",
    rangeDays,
    rangeLabel: `${rangeDays}-day report ending ${new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(now)}`,
    profile,
    readings,
    readingCount: readings.length,
    inRangeCount,
    averageMgdl,
    averageLabel: averageMgdl === null ? "--" : formatGlucose(averageMgdl, profile.unit),
    highestLabel: highest === null ? "--" : formatGlucose(highest, profile.unit),
    lowestLabel: lowest === null ? "--" : formatGlucose(lowest, profile.unit),
    fastingTrendLabel: trendLabel(fasting, profile),
    afterMealTrendLabel: trendLabel(afterMeal, profile),
    summaryBullets,
  };
}

export function createReportCsv(report: ReportModel): string {
  const rows = [
    [
      "recorded_at",
      "glucose_mgdl",
      "display_value",
      "display_unit",
      "timing",
      "meal",
      "carbs_grams",
      "medication",
      "activity",
      "tags",
      "symptoms",
      "mood",
      "notes",
    ],
    ...report.readings.map((reading) => [
      reading.recordedAt,
      String(Math.round(reading.glucoseMgdl)),
      String(reading.displayValue),
      reading.displayUnit,
      reading.timing,
      reading.mealLabel,
      reading.carbsGrams === null ? "" : String(reading.carbsGrams),
      reading.medicationNote,
      reading.activityNote,
      reading.tags.join("|"),
      reading.symptoms.join("|"),
      reading.mood ?? "",
      reading.notes,
    ]),
  ];
  return rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function createReportHtml(report: ReportModel): string {
  const readingRows = report.readings
    .map(
      (reading) => `
        <tr>
          <td>${formatDateTime(reading.recordedAt)}</td>
          <td>${formatGlucose(reading.glucoseMgdl, report.profile.unit)}</td>
          <td>${reading.timing.replace("_", " ")}</td>
          <td>${escapeHtml(reading.mealLabel || "-")}</td>
          <td>${escapeHtml(reading.tags.join(", ") || "-")}</td>
          <td>${escapeHtml(reading.notes || "-")}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { color: #172420; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 28px; }
        h1 { font-size: 26px; margin-bottom: 4px; }
        h2 { font-size: 17px; margin-top: 26px; }
        .muted { color: #5A6E67; }
        .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 18px; }
        .metric { border: 1px solid #DCE7E2; border-radius: 10px; padding: 12px; }
        .label { color: #5A6E67; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
        .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
        table { border-collapse: collapse; width: 100%; margin-top: 10px; }
        th, td { border-bottom: 1px solid #DCE7E2; font-size: 11px; padding: 8px; text-align: left; vertical-align: top; }
        th { background: #EEF5F2; }
        .notice { background: #E6EEF9; border-radius: 10px; padding: 12px; margin-top: 22px; }
      </style>
    </head>
    <body>
      <h1>${report.title}</h1>
      <p class="muted">${report.rangeLabel}</p>
      <div class="metrics">
        <div class="metric"><div class="label">Average</div><div class="value">${report.averageLabel}</div></div>
        <div class="metric"><div class="label">Highest</div><div class="value">${report.highestLabel}</div></div>
        <div class="metric"><div class="label">Lowest</div><div class="value">${report.lowestLabel}</div></div>
        <div class="metric"><div class="label">In range</div><div class="value">${report.inRangeCount}/${report.readingCount}</div></div>
      </div>
      <h2>Summary</h2>
      <ul>${report.summaryBullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
      <h2>Readings</h2>
      <table>
        <thead>
          <tr><th>Time</th><th>Glucose</th><th>Timing</th><th>Meal</th><th>Tags</th><th>Notes</th></tr>
        </thead>
        <tbody>${readingRows || "<tr><td colspan='6'>No readings in this date range.</td></tr>"}</tbody>
      </table>
      <div class="notice">${DISCLAIMER}</div>
    </body>
  </html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function exportReportPdf(report: ReportModel): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: createReportHtml(report) });
  await Sharing.shareAsync(uri, {
    dialogTitle: "Share DayRange PDF report",
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
  });
  return uri;
}

export async function exportReportCsv(report: ReportModel): Promise<string> {
  const file = new File(Paths.cache, `dayrange-${report.rangeDays}-day-report.csv`);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(createReportCsv(report));
  await Sharing.shareAsync(file.uri, {
    dialogTitle: "Share DayRange CSV report",
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
  });
  return file.uri;
}
