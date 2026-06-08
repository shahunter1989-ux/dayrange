import { Text, View } from "react-native";

import { colors, radii } from "@/theme";

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 84,
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderCurve: "continuous",
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        justifyContent: "space-between",
      }}
    >
      <Text selectable style={{ color: colors.textMuted, fontSize: 12, fontWeight: "800" }}>
        {label}
      </Text>
      <Text
        selectable
        adjustsFontSizeToFit
        numberOfLines={1}
        style={{ color: colors.text, fontSize: 22, fontWeight: "900", fontVariant: ["tabular-nums"] }}
      >
        {value}
      </Text>
    </View>
  );
}
