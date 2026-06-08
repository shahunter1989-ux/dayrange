import { Text, View } from "react-native";

import { DISCLAIMER } from "@/constants/options";
import { colors, radii } from "@/theme";

export function SafetyNotice() {
  return (
    <View
      style={{
        backgroundColor: colors.infoSoft,
        borderRadius: radii.card,
        borderCurve: "continuous",
        padding: 14,
        gap: 6,
      }}
    >
      <Text selectable style={{ color: colors.text, fontWeight: "900" }}>
        Track and organize only
      </Text>
      <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
        {DISCLAIMER}
      </Text>
    </View>
  );
}
