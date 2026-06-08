import { useSQLiteContext } from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  defaultProfile,
  getProfile,
  getReadings,
  getReportHistory,
  getReminders,
  insertReading,
  insertReportHistory,
  makeId,
  removeReading,
  setProfile,
  setReminder,
} from "@/data/database";
import { cancelReminderNotification, scheduleReminderNotification } from "@/services/reminders";
import { AddReadingInput, Profile, Reading, Reminder, ReportHistoryItem } from "@/types/domain";
import { toMgdl } from "@/utils/glucose";

type DayRangeContextValue = {
  profile: Profile;
  readings: Reading[];
  reminders: Reminder[];
  reportHistory: ReportHistoryItem[];
  refresh: () => Promise<void>;
  addReading: (input: AddReadingInput) => Promise<void>;
  deleteReading: (id: string) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  saveReminder: (reminder: Reminder) => Promise<void>;
  addReportHistory: (items: ReportHistoryItem[]) => Promise<void>;
};

const DayRangeContext = createContext<DayRangeContextValue | null>(null);

async function readStore(db: SQLiteDatabase) {
  const [nextProfile, nextReadings, nextReminders, nextReportHistory] = await Promise.all([
    getProfile(db),
    getReadings(db),
    getReminders(db),
    getReportHistory(db),
  ]);
  return { nextProfile, nextReadings, nextReminders, nextReportHistory };
}

export function DayRangeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [profile, setProfileState] = useState<Profile>(defaultProfile);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);

  const refresh = useCallback(async () => {
    const { nextProfile, nextReadings, nextReminders, nextReportHistory } = await readStore(db);
    setProfileState(nextProfile);
    setReadings(nextReadings);
    setReminders(nextReminders);
    setReportHistory(nextReportHistory);
  }, [db]);

  useEffect(() => {
    let active = true;
    readStore(db).then(({ nextProfile, nextReadings, nextReminders, nextReportHistory }) => {
      if (active) {
        setProfileState(nextProfile);
        setReadings(nextReadings);
        setReminders(nextReminders);
        setReportHistory(nextReportHistory);
      }
    });
    return () => {
      active = false;
    };
  }, [db]);

  const addReading = useCallback(
    async (input: AddReadingInput) => {
      const now = new Date().toISOString();
      const reading: Reading = {
        id: makeId("reading"),
        glucoseMgdl: toMgdl(input.displayValue, input.displayUnit),
        displayValue: input.displayValue,
        displayUnit: input.displayUnit,
        recordedAt: input.recordedAt,
        timing: input.timing,
        mealLabel: input.mealLabel.trim(),
        carbsGrams: input.carbsGrams,
        medicationNote: input.medicationNote.trim(),
        activityNote: input.activityNote.trim(),
        notes: input.notes.trim(),
        tags: input.tags,
        symptoms: input.symptoms,
        mood: input.mood,
        source: "manual",
        createdAt: now,
      };
      await insertReading(db, reading);
      await refresh();
    },
    [db, refresh]
  );

  const deleteReading = useCallback(
    async (id: string) => {
      await removeReading(db, id);
      await refresh();
    },
    [db, refresh]
  );

  const saveProfile = useCallback(
    async (nextProfile: Profile) => {
      await setProfile(db, nextProfile);
      await refresh();
    },
    [db, refresh]
  );

  const saveReminder = useCallback(
    async (nextReminder: Reminder) => {
      await cancelReminderNotification(nextReminder.notificationId);
      const notificationId = nextReminder.enabled
        ? await scheduleReminderNotification({ ...nextReminder, notificationId: null })
        : null;
      await setReminder(db, { ...nextReminder, notificationId });
      await refresh();
    },
    [db, refresh]
  );

  const addReportHistory = useCallback(
    async (items: ReportHistoryItem[]) => {
      await insertReportHistory(db, items);
      await refresh();
    },
    [db, refresh]
  );

  const value = useMemo(
    () => ({
      profile,
      readings,
      reminders,
      reportHistory,
      refresh,
      addReading,
      deleteReading,
      saveProfile,
      saveReminder,
      addReportHistory,
    }),
    [profile, readings, reminders, reportHistory, refresh, addReading, deleteReading, saveProfile, saveReminder, addReportHistory]
  );

  return <DayRangeContext.Provider value={value}>{children}</DayRangeContext.Provider>;
}

export function useDayRange(): DayRangeContextValue {
  const value = useContext(DayRangeContext);
  if (!value) {
    throw new Error("useDayRange must be used inside DayRangeProvider");
  }
  return value;
}
