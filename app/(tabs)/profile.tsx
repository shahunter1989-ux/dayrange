import * as LocalAuthentication from "expo-local-authentication";
import { Bell, Save } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";

import { Section } from "@/components/section";
import { useDayRange } from "@/data/dayrange-store";
import { GlucoseUnit, Reminder } from "@/types/domain";
import { colors, radii } from "@/theme";

export default function ProfileScreen() {
  const { profile, reminders, saveProfile, saveReminder } = useDayRange();
  const [edits, setEdits] = useState<Partial<typeof profile>>({});
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const draft = useMemo(() => ({ ...profile, ...edits }), [profile, edits]);

  useEffect(() => {
    async function checkBiometrics() {
      const available =
        (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
      setBiometricAvailable(available);
    }
    checkBiometrics();
  }, []);

  const updateReminder = async (reminder: Reminder, enabled: boolean) => {
    try {
      await saveReminder({ ...reminder, enabled });
    } catch (error) {
      Alert.alert("Reminder not saved", error instanceof Error ? error.message : "Could not update reminder.");
    }
  };

  const save = async () => {
    await saveProfile({
      ...draft,
      targetLow: Number(draft.targetLow) || 70,
      targetHigh: Number(draft.targetHigh) || 180,
      updatedAt: new Date().toISOString(),
    });
    setEdits({});
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 36 }}
      style={{ backgroundColor: colors.background }}
    >
      <Section title="Glucose Settings">
        <View style={{ gap: 12 }}>
          <Segmented
            value={draft.unit}
            options={["mg/dL", "mmol/L"]}
            onChange={(unit) => setEdits((current) => ({ ...current, unit: unit as GlucoseUnit }))}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Field
              label="Target low"
              value={String(draft.targetLow)}
              keyboardType="numeric"
              onChangeText={(value) => setEdits((current) => ({ ...current, targetLow: Number(value) }))}
            />
            <Field
              label="Target high"
              value={String(draft.targetHigh)}
              keyboardType="numeric"
              onChangeText={(value) => setEdits((current) => ({ ...current, targetHigh: Number(value) }))}
            />
          </View>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
            Target range is user or care-team defined. DayRange uses it only to organize your log.
          </Text>
        </View>
      </Section>

      <Section title="Emergency Card">
        <View style={{ gap: 10 }}>
          <Field label="Diabetes type" value={draft.diabetesType} onChangeText={(diabetesType) => setEdits((current) => ({ ...current, diabetesType }))} />
          <Field label="Medications" value={draft.medications} onChangeText={(medications) => setEdits((current) => ({ ...current, medications }))} />
          <Field label="Allergies" value={draft.allergies} onChangeText={(allergies) => setEdits((current) => ({ ...current, allergies }))} />
          <Field label="Emergency contact" value={draft.emergencyContact} onChangeText={(emergencyContact) => setEdits((current) => ({ ...current, emergencyContact }))} />
          <Field label="Physician" value={draft.physician} onChangeText={(physician) => setEdits((current) => ({ ...current, physician }))} />
        </View>
      </Section>

      <Section title="Local Reminders">
        <View style={{ gap: 10 }}>
          {reminders.map((reminder) => (
            <View
              key={reminder.id}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radii.card,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.border,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Bell color={colors.primary} size={20} />
              <View style={{ flex: 1 }}>
                <Text selectable style={{ color: colors.text, fontWeight: "800" }}>
                  {reminder.label}
                </Text>
                <Text selectable style={{ color: colors.textMuted }}>
                  {String(reminder.hour).padStart(2, "0")}:{String(reminder.minute).padStart(2, "0")} daily
                </Text>
              </View>
              <Switch value={reminder.enabled} onValueChange={(enabled) => updateReminder(reminder, enabled)} />
            </View>
          ))}
        </View>
      </Section>

      <Section title="Privacy">
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text selectable style={{ color: colors.text, fontWeight: "800" }}>
                Biometric app lock
              </Text>
              <Text selectable style={{ color: colors.textMuted }}>
                {biometricAvailable ? "Unlock this local journal with device biometrics." : "No enrolled biometric lock is available on this device."}
              </Text>
            </View>
            <Switch
              disabled={!biometricAvailable}
              value={draft.biometricLockEnabled && biometricAvailable}
              onValueChange={(biometricLockEnabled) => setEdits((current) => ({ ...current, biometricLockEnabled }))}
            />
          </View>
          <Text selectable style={{ color: colors.textMuted, lineHeight: 20 }}>
            Data stays on this device. DayRange has no account system, cloud sync, ads, or third-party
            analytics in this MVP.
          </Text>
        </View>
      </Section>

      <Pressable
        accessibilityRole="button"
        onPress={save}
        style={{
          minHeight: 52,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
        }}
      >
        <Save color={colors.onPrimary} size={18} />
        <Text selectable style={{ color: colors.onPrimary, fontWeight: "900" }}>
          Save Profile
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {options.map((option) => (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={{
            flex: 1,
            minHeight: 42,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: value === option ? colors.primary : colors.surface,
            borderWidth: 1,
            borderColor: value === option ? colors.primary : colors.border,
          }}
        >
          <Text selectable style={{ color: value === option ? colors.onPrimary : colors.text, fontWeight: "800" }}>
            {option}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text selectable style={{ color: colors.textMuted, fontWeight: "700" }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor={colors.textSubtle}
        style={{
          minHeight: 46,
          borderRadius: 12,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          color: colors.text,
        }}
      />
    </View>
  );
}
