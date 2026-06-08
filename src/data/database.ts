import type { SQLiteDatabase } from "expo-sqlite";

import { defaultReminders } from "@/constants/options";
import { Profile, Reading, Reminder } from "@/types/domain";

export const defaultProfile: Profile = {
  id: "default",
  unit: "mg/dL",
  targetLow: 70,
  targetHigh: 180,
  diabetesType: "Type 2 diabetes",
  medications: "",
  allergies: "",
  emergencyContact: "",
  physician: "",
  biometricLockEnabled: false,
  updatedAt: new Date(0).toISOString(),
};

type ReadingRow = {
  id: string;
  glucose_mgdl: number;
  display_value: number;
  display_unit: string;
  recorded_at: string;
  timing: string;
  meal_label: string | null;
  carbs_grams: number | null;
  medication_note: string | null;
  activity_note: string | null;
  notes: string | null;
  tags: string;
  symptoms: string;
  mood: string | null;
  source: "manual";
  created_at: string;
};

type ReminderRow = {
  id: string;
  kind: string;
  label: string;
  hour: number;
  minute: number;
  enabled: number;
  notification_id: string | null;
};

export async function migrateDatabase(db: SQLiteDatabase) {
  const current = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const version = current?.user_version ?? 0;
  if (version >= 1) {
    return;
  }

  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS profile (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS readings (
      id TEXT PRIMARY KEY NOT NULL,
      glucose_mgdl REAL NOT NULL,
      display_value REAL NOT NULL,
      display_unit TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      timing TEXT NOT NULL,
      meal_label TEXT,
      carbs_grams REAL,
      medication_note TEXT,
      activity_note TEXT,
      notes TEXT,
      tags TEXT NOT NULL,
      symptoms TEXT NOT NULL,
      mood TEXT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS readings_recorded_at_idx ON readings(recorded_at);
    CREATE TABLE IF NOT EXISTS context_events (
      id TEXT PRIMARY KEY NOT NULL,
      reading_id TEXT,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      value TEXT,
      timestamp TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      notification_id TEXT
    );
  `);

  await db.runAsync(
    "INSERT OR IGNORE INTO profile (id, data, updated_at) VALUES (?, ?, ?)",
    defaultProfile.id,
    JSON.stringify(defaultProfile),
    defaultProfile.updatedAt
  );

  for (const reminder of defaultReminders) {
    await db.runAsync(
      `INSERT OR IGNORE INTO reminders (id, kind, label, hour, minute, enabled, notification_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      reminder.id,
      reminder.kind,
      reminder.label,
      reminder.hour,
      reminder.minute,
      reminder.enabled ? 1 : 0,
      reminder.notificationId
    );
  }

  await db.execAsync("PRAGMA user_version = 1");
}

export async function getProfile(db: SQLiteDatabase): Promise<Profile> {
  const row = await db.getFirstAsync<{ data: string }>("SELECT data FROM profile WHERE id = ?", "default");
  return row ? { ...defaultProfile, ...JSON.parse(row.data) } : defaultProfile;
}

export async function setProfile(db: SQLiteDatabase, profile: Profile): Promise<void> {
  await db.runAsync(
    "INSERT OR REPLACE INTO profile (id, data, updated_at) VALUES (?, ?, ?)",
    profile.id,
    JSON.stringify(profile),
    profile.updatedAt
  );
}

export async function getReadings(db: SQLiteDatabase): Promise<Reading[]> {
  const rows = await db.getAllAsync<ReadingRow>("SELECT * FROM readings ORDER BY recorded_at DESC");
  return rows.map((row) => ({
    id: row.id,
    glucoseMgdl: row.glucose_mgdl,
    displayValue: row.display_value,
    displayUnit: row.display_unit === "mmol/L" ? "mmol/L" : "mg/dL",
    recordedAt: row.recorded_at,
    timing: row.timing as Reading["timing"],
    mealLabel: row.meal_label ?? "",
    carbsGrams: row.carbs_grams,
    medicationNote: row.medication_note ?? "",
    activityNote: row.activity_note ?? "",
    notes: row.notes ?? "",
    tags: JSON.parse(row.tags),
    symptoms: JSON.parse(row.symptoms),
    mood: row.mood as Reading["mood"],
    source: row.source,
    createdAt: row.created_at,
  }));
}

export async function insertReading(db: SQLiteDatabase, reading: Reading): Promise<void> {
  await db.runAsync(
    `INSERT INTO readings (
      id, glucose_mgdl, display_value, display_unit, recorded_at, timing, meal_label, carbs_grams,
      medication_note, activity_note, notes, tags, symptoms, mood, source, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    reading.id,
    reading.glucoseMgdl,
    reading.displayValue,
    reading.displayUnit,
    reading.recordedAt,
    reading.timing,
    reading.mealLabel,
    reading.carbsGrams,
    reading.medicationNote,
    reading.activityNote,
    reading.notes,
    JSON.stringify(reading.tags),
    JSON.stringify(reading.symptoms),
    reading.mood,
    reading.source,
    reading.createdAt
  );

  const contextItems = [
    ["meal", reading.mealLabel, reading.carbsGrams === null ? "" : `${reading.carbsGrams}g carbs`],
    ["medication", reading.medicationNote, ""],
    ["activity", reading.activityNote, ""],
  ].filter(([, label]) => Boolean(label));

  for (const [kind, label, value] of contextItems) {
    await db.runAsync(
      "INSERT INTO context_events (id, reading_id, kind, label, value, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
      makeId(kind),
      reading.id,
      kind,
      label,
      value,
      reading.recordedAt
    );
  }
}

export async function removeReading(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync("DELETE FROM context_events WHERE reading_id = ?", id);
  await db.runAsync("DELETE FROM readings WHERE id = ?", id);
}

export async function getReminders(db: SQLiteDatabase): Promise<Reminder[]> {
  const rows = await db.getAllAsync<ReminderRow>("SELECT * FROM reminders ORDER BY hour, minute");
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as Reminder["kind"],
    label: row.label,
    hour: row.hour,
    minute: row.minute,
    enabled: row.enabled === 1,
    notificationId: row.notification_id,
  }));
}

export async function setReminder(db: SQLiteDatabase, reminder: Reminder): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO reminders (id, kind, label, hour, minute, enabled, notification_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    reminder.id,
    reminder.kind,
    reminder.label,
    reminder.hour,
    reminder.minute,
    reminder.enabled ? 1 : 0,
    reminder.notificationId
  );
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
