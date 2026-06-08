import { Text, View } from "react-native";

import { colors, radii } from "@/theme";

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.surfaceAlt,
        borderRadius: radii.card,
        borderCurve: "continuous",
        padding: 18,
        gap: 6,
      }}
    >
      <Text selectable style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
        {title}
      </Text>
      <Text selectable style={{ color: colors.textMuted, lineHeight: 21 }}>
        {body}
      </Text>
    </View>
  );
}
