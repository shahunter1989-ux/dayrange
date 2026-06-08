import { Clock3, Download, FileSpreadsheet, Wifi, WifiOff } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { MetricCard } from "@/components/metric-card";
import { Section } from "@/components/section";
import { DISCLAIMER } from "@/constants/options";
import { useDayRange } from "@/data/dayrange-store";
import { colors, radii } from "@/theme";
import { ReportRangeType } from "@/types/domain";
import { exportReportCsv, exportReportPdf } from "@/utils/report-export";
import {
  createReportHistoryItems,
  formatDateOnly,
  buildReportModel,
  planReportExport,
  PlannedReportExport,
} from "@/utils/reports";

const ranges: { label: string; value: ReportRangeType }[] = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" },
];

type WebOfflineStatus = {
  online: boolean;
  serviceWorker: boolean;
  standalone: boolean;
};

export default function ReportsScreen() {
  const { readings, profile, reportHistory, addReportHistory } = useDayRange();
  const [range, setRange] = useState<ReportRangeType>("week");
  const [webStatus, setWebStatus] = useState<WebOfflineStatus | null>(null);
  const report = useMemo(() => buildReportModel(readings, profile, range, new Date()), [readings, profile, range]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") {
      return undefined;
    }

    const updateStatus = () => {
      const navigatorValue = window.navigator;
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        Boolean((navigatorValue as Navigator & { standalone?: boolean }).standalone);
      setWebStatus({
        online: navigatorValue.onLine,
        serviceWorker: Boolean(navigatorValue.serviceWorker?.controller),
        standalone,
      });
    };

    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    window.navigator.serviceWorker?.ready.then(updateStatus).catch(() => undefined);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  const exportPdfPlan = async (plan: PlannedReportExport) => {
    const parts = await exportReportPdf(plan);
    await addReportHistory(createReportHistoryItems(parts, Platform.OS === "web" ? "web" : "native"));
    Alert.alert(
      "PDF report ready",
      parts.length > 1
        ? `${parts.length} PDF files were created for this larger report.`
        : "The PDF report was created on this device."
    );
  };

  const sharePdf = async () => {
    const plan = planReportExport(report, "pdf");
    try {
      if (plan.shouldSplit) {
        confirmSplitExport(plan, () => exportPdfPlan(plan));
        return;
      }
      await exportPdfPlan(plan);
    } catch (error) {
      Alert.alert("Report export failed", error instanceof Error ? error.message : "Could not create the PDF.");
    }
  };

  const shareCsv = async () => {
    const plan = planReportExport(report, "csv");
    try {
      const parts = await exportReportCsv(plan);
      await addReportHistory(createReportHistoryItems(parts, Platform.OS === "web" ? "web" : "native"));
      Alert.alert("CSV report ready", "The CSV report was created on this device.");
    } catch (error) {
      Alert.alert("CSV export failed", error instanceof Error ? error.message : "Could not create the CSV.");
    }
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {ranges.map((item) => (
          <Pressable
            key={item.value}
            onPress={() => setRange(item.value)}
            style={{
              flex: 1,
              minHeight: 42,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              backgroundColor: range === item.value ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: range === item.value ? colors.primary : colors.border,
            }}
          >
            <Text
              selectable
              style={{
                color: range === item.value ? colors.onPrimary : colors.text,
                fontWeight: "800",
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {webStatus ? (
        <View
          style={{
            backgroundColor: webStatus.online ? colors.infoSoft : colors.accentSoft,
            borderRadius: radii.control,
            borderCurve: "continuous",
            padding: 12,
            flexDirection: "row",
            gap: 10,
            alignItems: "center",
          }}
        >
          {webStatus.online ? <Wifi color={colors.info} size={18} /> : <WifiOff color={colors.accent} size={18} />}
          <Text selectable style={{ color: colors.text, flex: 1, lineHeight: 20 }}>
            {webStatus.serviceWorker
              ? `Offline app shell is saved on this browser${webStatus.standalone ? " and installed" : ""}.`
              : "Offline access is prepared after the first full load on this browser."}
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard label="Average" value={report.averageLabel} />
        <MetricCard label="Readings" value={`${report.readingCount}`} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard label="Highest" value={report.highestLabel} />
        <MetricCard label="Lowest" value={report.lowestLabel} />
      </View>

      <Section title="Doctor Report Preview">
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            padding: 16,
            gap: 10,
          }}
        >
          <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
            {report.title}
          </Text>
          <Text selectable style={{ color: colors.textMuted }}>
            {report.rangeLabel}
          </Text>
          {report.summaryBullets.map((bullet) => (
            <Text key={bullet} selectable style={{ color: colors.text, lineHeight: 22 }}>
              - {bullet}
            </Text>
          ))}
          <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radii.control, padding: 12, gap: 6 }}>
            <Text selectable style={{ color: colors.text, fontWeight: "800" }}>
              Detailed log fields
            </Text>
            <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
              Time, glucose, timing, range label, meal, carbs, medication, activity, symptoms, mood, tags, and notes.
            </Text>
          </View>
          <Text selectable style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
            {DISCLAIMER}
          </Text>
        </View>
      </Section>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={sharePdf}
          style={{
            flex: 1,
            minHeight: 52,
            borderRadius: 14,
            borderCurve: "continuous",
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Download color={colors.onPrimary} size={18} />
          <Text selectable style={{ color: colors.onPrimary, fontWeight: "900" }}>
            PDF
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={shareCsv}
          style={{
            flex: 1,
            minHeight: 52,
            borderRadius: 14,
            borderCurve: "continuous",
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
          }}
        >
          <FileSpreadsheet color={colors.primary} size={18} />
          <Text selectable style={{ color: colors.text, fontWeight: "900" }}>
            CSV
          </Text>
        </Pressable>
      </View>

      <Section title="Recent Reports">
        <View style={{ gap: 10 }}>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
            DayRange keeps only this local report list. PDF and CSV files are saved in your browser downloads or device
            files area.
          </Text>
          {reportHistory.length ? (
            reportHistory.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.control,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <Clock3 color={colors.primary} size={16} />
                  <Text selectable style={{ color: colors.text, fontWeight: "800", flex: 1 }}>
                    {item.fileName}
                  </Text>
                </View>
                <Text selectable style={{ color: colors.textMuted, lineHeight: 19 }}>
                  {formatDateOnly(item.startDate)} to {formatDateOnly(item.endDate)} - {item.readingCount} readings
                  {item.partCount > 1 ? ` - part ${item.partIndex} of ${item.partCount}` : ""}
                </Text>
              </View>
            ))
          ) : (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.control,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
              }}
            >
              <Text selectable style={{ color: colors.textMuted }}>
                No reports created yet.
              </Text>
            </View>
          )}
        </View>
      </Section>
    </ScrollView>
  );
}

function confirmSplitExport(plan: PlannedReportExport, onConfirm: () => void) {
  const message = `This report is estimated at ${plan.estimatedPages} pages, so DayRange will create ${plan.parts.length} smaller PDF files.`;
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(message)) {
      void onConfirm();
    }
    return;
  }

  Alert.alert("Split large report", message, [
    { text: "Cancel", style: "cancel" },
    { text: "Create files", onPress: onConfirm },
  ]);
}
