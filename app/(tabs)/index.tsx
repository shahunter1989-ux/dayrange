import { Link } from "expo-router";
import { Plus, Trash2 } from "lucide-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { MetricCard } from "@/components/metric-card";
import { SafetyNotice } from "@/components/safety-notice";
import { Section } from "@/components/section";
import { useDayRange } from "@/data/dayrange-store";
import { formatGlucose, readingRangeLabel } from "@/utils/glucose";
import { buildReportModel, formatDateTime, isSameLocalDay } from "@/utils/reports";
import { colors, radii } from "@/theme";

export default function TodayScreen() {
  const { readings, profile, deleteReading } = useDayRange();
  const todayReadings = readings.filter((reading) => isSameLocalDay(reading.recordedAt, new Date()));
  const todayReport = buildReportModel(todayReadings, profile, 1, new Date());
  const latest = readings[0];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <SafetyNotice />

      <Link href="/add-reading" asChild>
        <Pressable
          accessibilityRole="button"
          style={{
            minHeight: 86,
            borderRadius: 18,
            borderCurve: "continuous",
            backgroundColor: colors.primary,
            padding: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 8px 20px rgba(30, 111, 92, 0.22)",
          }}
        >
          <View style={{ gap: 6, flex: 1 }}>
            <Text selectable style={{ color: colors.onPrimary, fontSize: 16, fontWeight: "700" }}>
              Add Reading
            </Text>
            <Text selectable style={{ color: colors.onPrimaryMuted }}>
              Log glucose and context in under 10 seconds.
            </Text>
          </View>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.16)",
            }}
          >
            <Plus color={colors.onPrimary} size={26} />
          </View>
        </Pressable>
      </Link>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard label="Today avg" value={todayReport.averageLabel} />
        <MetricCard label="In range" value={`${todayReport.inRangeCount}/${todayReport.readingCount}`} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <MetricCard
          label="Latest"
          value={latest ? formatGlucose(latest.glucoseMgdl, profile.unit) : "--"}
        />
        <MetricCard label="Target" value={`${profile.targetLow}-${profile.targetHigh}`} />
      </View>

      <Section title="Daily Timeline">
        {todayReadings.length === 0 ? (
          <EmptyState
            title="No readings yet today"
            body="Your timeline will show readings, meals, medication notes, activity, symptoms, and mood context."
          />
        ) : (
          <View style={{ gap: 10 }}>
            {todayReadings.map((reading) => {
              const range = readingRangeLabel(reading.glucoseMgdl, profile.targetLow, profile.targetHigh);
              return (
                <View
                  key={reading.id}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radii.card,
                    borderCurve: "continuous",
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 14,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text selectable style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
                        {formatGlucose(reading.glucoseMgdl, profile.unit)}
                      </Text>
                      <Text selectable style={{ color: colors.textMuted }}>
                        {formatDateTime(reading.recordedAt)} · {reading.timing.replace("_", " ")} · {range}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel="Delete reading"
                      onPress={() => deleteReading(reading.id)}
                      style={{
                        width: 38,
                        height: 38,
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: 19,
                        backgroundColor: colors.dangerSoft,
                      }}
                    >
                      <Trash2 color={colors.danger} size={18} />
                    </Pressable>
                  </View>
                  {!!reading.tags.length && (
                    <Text selectable style={{ color: colors.textMuted }}>
                      {reading.tags.map((tag) => tag.replace("_", " ")).join(" · ")}
                    </Text>
                  )}
                  {!!reading.notes && (
                    <Text selectable style={{ color: colors.text }}>
                      {reading.notes}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </Section>
    </ScrollView>
  );
}
