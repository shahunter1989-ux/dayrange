import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { Suspense } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { AppDataProvider } from "@/data/app-data-provider";
import { BiometricGate } from "@/components/biometric-gate";
import { colors } from "@/theme";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator color={colors.primary} />
      <Text selectable style={{ color: colors.textMuted }}>
        Preparing your local journal
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AppDataProvider>
        <BiometricGate>
          <Stack
            screenOptions={{
              headerLargeTitle: true,
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="add-reading"
              options={{
                title: "Add Reading",
                presentation: "modal",
                headerLargeTitle: false,
              }}
            />
          </Stack>
        </BiometricGate>
      </AppDataProvider>
    </Suspense>
  );
}
