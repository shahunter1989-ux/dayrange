import * as LocalAuthentication from "expo-local-authentication";
import { LockKeyhole } from "lucide-react-native";
import { ReactNode, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { useDayRange } from "@/data/dayrange-store";
import { colors } from "@/theme";

export function BiometricGate({ children }: { children: ReactNode }) {
  const { profile } = useDayRange();
  const [unlocked, setUnlocked] = useState(false);

  const unlock = async () => {
    if (!profile.biometricLockEnabled) {
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock DayRange",
      fallbackLabel: "Use device passcode",
    });
    setUnlocked(result.success);
  };

  useEffect(() => {
    let active = true;
    async function authenticate() {
      if (!profile.biometricLockEnabled) {
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock DayRange",
        fallbackLabel: "Use device passcode",
      });
      if (active) {
        setUnlocked(result.success);
      }
    }
    authenticate();
    return () => {
      active = false;
    };
  }, [profile.biometricLockEnabled]);

  if (!profile.biometricLockEnabled || unlocked) {
    return children;
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        gap: 18,
        backgroundColor: colors.background,
      }}
    >
      <View
        style={{
          width: 70,
          height: 70,
          borderRadius: 35,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        }}
      >
        <LockKeyhole color={colors.primary} size={34} />
      </View>
      <Text selectable style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>
        DayRange is locked
      </Text>
      <Text selectable style={{ color: colors.textMuted, textAlign: "center", lineHeight: 21 }}>
        Use your device biometric lock to open your local glucose journal.
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={unlock}
        style={{
          minHeight: 50,
          minWidth: 160,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          backgroundColor: colors.primary,
        }}
      >
        <Text selectable style={{ color: colors.onPrimary, fontWeight: "900" }}>
          Unlock
        </Text>
      </Pressable>
    </View>
  );
}
