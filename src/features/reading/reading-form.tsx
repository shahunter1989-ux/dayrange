import { Check, Save } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { moodOptions, symptomOptions, tagOptions, timingOptions } from "@/constants/options";
import { AddReadingInput, ContextTag, GlucoseUnit, Mood, Profile, ReadingTiming, Symptom } from "@/types/domain";
import { isValidGlucose } from "@/utils/glucose";
import { colors, radii } from "@/theme";

export function ReadingForm({
  profile,
  onSubmit,
  isSaving = false,
}: {
  profile: Profile;
  onSubmit: (input: AddReadingInput) => Promise<void> | void;
  isSaving?: boolean;
}) {
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<GlucoseUnit>(profile.unit);
  const [recordedAt, setRecordedAt] = useState(new Date());
  const [timePreset, setTimePreset] = useState("Now");
  const [timing, setTiming] = useState<ReadingTiming>("fasting");
  const [mealLabel, setMealLabel] = useState("");
  const [carbs, setCarbs] = useState("");
  const [medicationNote, setMedicationNote] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<ContextTag[]>([]);
  const [symptoms, setSymptoms] = useState<Symptom[]>(["normal"]);
  const [mood, setMood] = useState<Mood | null>(null);

  const toggle = <T extends string>(item: T, items: T[], setItems: (next: T[]) => void) => {
    setItems(items.includes(item) ? items.filter((current) => current !== item) : [...items, item]);
  };

  const submit = async () => {
    const numeric = Number(value);
    if (!isValidGlucose(numeric, unit)) {
      Alert.alert("Check glucose value", `Enter a glucose reading in ${unit}.`);
      return;
    }
    await onSubmit({
      displayValue: numeric,
      displayUnit: unit,
      recordedAt: recordedAt.toISOString(),
      timing,
      mealLabel,
      carbsGrams: carbs.trim() ? Number(carbs) : null,
      medicationNote,
      activityNote,
      notes,
      tags,
      symptoms,
      mood,
    });
  };

  return (
    <View style={{ gap: 18 }}>
      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.textMuted, fontWeight: "800" }}>
          Glucose reading
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TextInput
            accessibilityLabel="Glucose value"
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder={unit === "mg/dL" ? "132" : "7.3"}
            placeholderTextColor={colors.textSubtle}
            style={{
              flex: 1,
              minHeight: 58,
              borderRadius: radii.control,
              borderCurve: "continuous",
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 14,
              color: colors.text,
              fontSize: 24,
              fontWeight: "900",
            }}
          />
          <View style={{ width: 112 }}>
            <Segmented value={unit} options={["mg/dL", "mmol/L"]} onChange={(next) => setUnit(next as GlucoseUnit)} />
          </View>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text selectable style={{ color: colors.textMuted, fontWeight: "800" }}>
          Time
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            ["Now", 0],
            ["15 min ago", 15],
            ["1 hr ago", 60],
          ].map(([label, minutes]) => (
            <Chip
              key={label}
              label={String(label)}
              selected={timePreset === label}
              onPress={() => {
                setTimePreset(String(label));
                setRecordedAt(new Date(Date.now() - Number(minutes) * 60_000));
              }}
            />
          ))}
        </View>
        <Text selectable style={{ color: colors.textMuted }}>
          {recordedAt.toLocaleString()}
        </Text>
      </View>

      <OptionGroup
        title="Timing"
        options={timingOptions}
        selected={[timing]}
        onPress={(option) => setTiming(option as ReadingTiming)}
      />

      <View style={{ gap: 10 }}>
        <Field label="Meal or food note" value={mealLabel} onChangeText={setMealLabel} placeholder="Breakfast, dinner, late snack" />
        <Field label="Carbs (optional)" value={carbs} onChangeText={setCarbs} placeholder="45" keyboardType="numeric" />
        <Field label="Medication context" value={medicationNote} onChangeText={setMedicationNote} placeholder="Metformin taken, missed dose" />
        <Field label="Activity context" value={activityNote} onChangeText={setActivityNote} placeholder="22 minute walk" />
      </View>

      <OptionGroup
        title="Smart tags"
        options={tagOptions}
        selected={tags}
        onPress={(option) => toggle(option as ContextTag, tags, setTags)}
      />

      <OptionGroup
        title="Symptoms"
        options={symptomOptions}
        selected={symptoms}
        onPress={(option) => toggle(option as Symptom, symptoms, setSymptoms)}
      />

      <OptionGroup
        title="Mood"
        options={moodOptions}
        selected={mood ? [mood] : []}
        onPress={(option) => setMood(mood === option ? null : (option as Mood))}
      />

      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Anything else worth remembering" multiline />

      <Pressable
        accessibilityRole="button"
        onPress={submit}
        disabled={isSaving}
        style={{
          minHeight: 54,
          borderRadius: 14,
          borderCurve: "continuous",
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8,
          opacity: isSaving ? 0.6 : 1,
        }}
      >
        <Save color={colors.onPrimary} size={18} />
        <Text selectable style={{ color: colors.onPrimary, fontWeight: "900" }}>
          Save reading
        </Text>
      </Pressable>
    </View>
  );
}

function OptionGroup({
  title,
  options,
  selected,
  onPress,
}: {
  title: string;
  options: string[];
  selected: string[];
  onPress: (option: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text selectable style={{ color: colors.textMuted, fontWeight: "800" }}>
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => (
          <Chip
            key={option}
            label={option.replace("_", " ")}
            selected={selected.includes(option)}
            onPress={() => onPress(option)}
          />
        ))}
      </View>
    </View>
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
    <View style={{ gap: 6 }}>
      {options.map((option) => (
        <Chip key={option} label={option} selected={value === option} onPress={() => onChange(option)} />
      ))}
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        minHeight: 38,
        borderRadius: 999,
        paddingHorizontal: 13,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      }}
    >
      {selected && <Check color={colors.primary} size={14} />}
      <Text selectable style={{ color: selected ? colors.primary : colors.text, fontWeight: "800" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text selectable style={{ color: colors.textMuted, fontWeight: "800" }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.textSubtle}
        style={{
          minHeight: multiline ? 84 : 48,
          borderRadius: radii.control,
          borderCurve: "continuous",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
