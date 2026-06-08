import { Download, FileSpreadsheet } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { MetricCard } from "@/components/metric-card";
import { Section } from "@/components/section";
import { useDayRange } from "@/data/dayrange-store";
import { ReportRange } from "@/types/domain";
import { buildReportModel, exportReportCsv, exportReportPdf } from "@/utils/reports";
import { colors, radii } from "@/theme";

const ranges: ReportRange[] = [7, 14, 30];

export default function ReportsScreen() {
  const { readings, profile } = useDayRange();
  const [range, setRange] = useState<ReportRange>(14);
  const report = useMemo(() => buildReportModel(readings, profile, range, new Date()), [readings, profile, range]);

  const sharePdf = async () => {
    try {
      await exportReportPdf(report);
    } catch (error) {
      Alert.alert("Report export failed", error instanceof Error ? error.message : "Could not create the PDF.");
    }
  };

  const shareCsv = async () => {
    try {
      await exportReportCsv(report);
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
            key={item}
            onPress={() => setRange(item)}
            style={{
              flex: 1,
              minHeight: 42,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              backgroundColor: range === item ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: range === item ? colors.primary : colors.border,
            }}
          >
            <Text
              selectable
              style={{
                color: range === item ? colors.onPrimary : colors.text,
                fontWeight: "800",
              }}
            >
              {item} days
            </Text>
          </Pressable>
        ))}
      </View>

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
          <Text selectable style={{ color: colors.textMuted, fontSize: 12, lineHeight: 18 }}>
            DayRange helps you track and organize glucose information. It does not diagnose, treat,
            or replace medical advice.
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
    </ScrollView>
  );
}
