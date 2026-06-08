import { ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { Section } from "@/components/section";
import { useDayRange } from "@/data/dayrange-store";
import { buildInsights } from "@/utils/insights";
import { colors, radii } from "@/theme";

export default function InsightsScreen() {
  const { readings, profile } = useDayRange();
  const insights = buildInsights(readings, profile, new Date());

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <Section title="Weekly Patterns">
        {insights.length === 0 ? (
          <EmptyState
            title="Log more readings"
            body="DayRange needs at least two readings before it can summarize patterns without guessing."
          />
        ) : (
          <View style={{ gap: 12 }}>
            {insights.map((insight) => (
              <View
                key={insight.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.card,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 16,
                  gap: 8,
                }}
              >
                <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                  {insight.title}
                </Text>
                <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
                  {insight.body}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Section>

      <Section title="Guardrails">
        <View
          style={{
            backgroundColor: colors.infoSoft,
            borderRadius: radii.card,
            borderCurve: "continuous",
            padding: 16,
            gap: 8,
          }}
        >
          <Text selectable style={{ color: colors.text, fontWeight: "800" }}>
            Pattern coach, not medical advice
          </Text>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
            Insights describe what appears in your own log. They do not diagnose, recommend medication
            changes, or tell you how to treat a reading.
          </Text>
        </View>
      </Section>
    </ScrollView>
  );
}
