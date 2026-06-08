import { ReactNode } from "react";
import { Text, View } from "react-native";

import { colors } from "@/theme";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text selectable style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
        {title}
      </Text>
      {children}
    </View>
  );
}
