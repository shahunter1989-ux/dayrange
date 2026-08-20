export type GlucoseUnit = "mg/dL" | "mmol/L";

export type ReadingTiming = "fasting" | "before_meal" | "after_meal" | "bedtime" | "other";

export type ContextTag =
  | "stress"
  | "sick"
  | "missed_meds"
  | "high_carb_meal"
  | "low_sleep"
  | "walked"
  | "exercise"
  | "alcohol"
  | "hydration";

export type Symptom = "shaky" | "tired" | "dizzy" | "headache" | "normal";

export type Mood = "calm" | "anxious" | "stressed" | "energetic";

export type ReminderKind = "fasting" | "after_dinner" | "medication" | "appointment_report";

export type ReportRange = 7 | 14 | 30;

export type ReportRangeType = "day" | "week" | "month";

export type ReportHistoryItem = {
  id: string;
  fileName: string;
  rangeType: ReportRangeType;
  startDate: string;
  endDate: string;
  generatedAt: string;
  readingCount: number;
  partIndex: number;
  partCount: number;
  platform: "native" | "web";
};

export type ReportExportPart = {
  fileName: string;
  rangeType: ReportRangeType;
  startDate: string;
  endDate: string;
  readingCount: number;
  partIndex: number;
  partCount: number;
};

export type StorageHealthStatus = "idle" | "saving" | "saved" | "error";

export type StorageHealth = {
  status: StorageHealthStatus;
  lastSuccessAt?: string;
  lastSaveError?: string;
  isPersistentStorage?: boolean;
  storageUsed?: number;
  storageQuota?: number;
};

export type BackupData = {
  profile: Profile;
  readings: Reading[];
  reminders: Reminder[];
  reportHistory: ReportHistoryItem[];
};

export type BackupEnvelope = {
  format: "dayrange-backup";
  version: 1;
  createdAt: string;
  appVersion: string;
  data: BackupData;
};

export type BackupRestoreInfo = {
  createdAt: string;
  readingCount: number;
  profileIncluded: boolean;
  version: number;
};

export type ReportExportPlan = {
  rangeType: ReportRangeType;
  startDate: string;
  endDate: string;
  estimatedPages: number;
  shouldSplit: boolean;
  parts: ReportExportPart[];
};

export type ReadingSource = "manual";

export type Reading = {
  id: string;
  glucoseMgdl: number;
  displayValue: number;
  displayUnit: GlucoseUnit;
  recordedAt: string;
  timing: ReadingTiming;
  mealLabel: string;
  carbsGrams: number | null;
  medicationNote: string;
  activityNote: string;
  notes: string;
  tags: ContextTag[];
  symptoms: Symptom[];
  mood: Mood | null;
  source: ReadingSource;
  createdAt: string;
};

export type AddReadingInput = {
  displayValue: number;
  displayUnit: GlucoseUnit;
  recordedAt: string;
  timing: ReadingTiming;
  mealLabel: string;
  carbsGrams: number | null;
  medicationNote: string;
  activityNote: string;
  notes: string;
  tags: ContextTag[];
  symptoms: Symptom[];
  mood: Mood | null;
};

export type Profile = {
  id: "default";
  unit: GlucoseUnit;
  targetLow: number;
  targetHigh: number;
  diabetesType: string;
  medications: string;
  allergies: string;
  emergencyContact: string;
  physician: string;
  biometricLockEnabled: boolean;
  updatedAt: string;
};

export type Reminder = {
  id: string;
  kind: ReminderKind;
  label: string;
  hour: number;
  minute: number;
  enabled: boolean;
  notificationId: string | null;
};

export type Insight = {
  id: string;
  title: string;
  body: string;
};
