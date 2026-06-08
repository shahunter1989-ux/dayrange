import { router } from "expo-router";
import { ScrollView } from "react-native";

import { ReadingForm } from "@/features/reading/reading-form";
import { useDayRange } from "@/data/dayrange-store";
import { colors } from "@/theme";

export default function AddReadingScreen() {
  const { addReading, profile } = useDayRange();

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <ReadingForm
        profile={profile}
        onSubmit={async (input) => {
          await addReading(input);
          router.back();
        }}
      />
    </ScrollView>
  );
}
