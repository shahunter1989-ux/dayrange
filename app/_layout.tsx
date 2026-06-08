import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { Suspense } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { BiometricGate } from "@/components/biometric-gate";
import { DayRangeProvider } from "@/data/dayrange-store";
import { migrateDatabase } from "@/data/database";
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
      <SQLiteProvider databaseName="dayrange.db" onInit={migrateDatabase} useSuspense>
        <DayRangeProvider>
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
        </DayRangeProvider>
      </SQLiteProvider>
    </Suspense>
  );
}
