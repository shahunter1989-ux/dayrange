import { useSQLiteContext } from "expo-sqlite";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import {
  defaultProfile,
  getProfile,
  getReadings,
  getReminders,
  insertReading,
  makeId,
  removeReading,
  setProfile,
  setReminder,
} from "@/data/database";
import { cancelReminderNotification, scheduleReminderNotification } from "@/services/reminders";
import { AddReadingInput, Profile, Reading, Reminder } from "@/types/domain";
import { toMgdl } from "@/utils/glucose";

type DayRangeContextValue = {
  profile: Profile;
  readings: Reading[];
  reminders: Reminder[];
  refresh: () => Promise<void>;
  addReading: (input: AddReadingInput) => Promise<void>;
  deleteReading: (id: string) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  saveReminder: (reminder: Reminder) => Promise<void>;
};

const DayRangeContext = createContext<DayRangeContextValue | null>(null);

async function readStore(db: ReturnType<typeof useSQLiteContext>) {
  const [nextProfile, nextReadings, nextReminders] = await Promise.all([
    getProfile(db),
    getReadings(db),
    getReminders(db),
  ]);
  return { nextProfile, nextReadings, nextReminders };
}

export function DayRangeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [profile, setProfileState] = useState<Profile>(defaultProfile);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  const refresh = useCallback(async () => {
    const { nextProfile, nextReadings, nextReminders } = await readStore(db);
    setProfileState(nextProfile);
    setReadings(nextReadings);
    setReminders(nextReminders);
  }, [db]);

  useEffect(() => {
    let active = true;
    readStore(db).then(({ nextProfile, nextReadings, nextReminders }) => {
      if (active) {
        setProfileState(nextProfile);
        setReadings(nextReadings);
        setReminders(nextReminders);
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

  const value = useMemo(
    () => ({
      profile,
      readings,
      reminders,
      refresh,
      addReading,
      deleteReading,
      saveProfile,
      saveReminder,
    }),
    [profile, readings, reminders, refresh, addReading, deleteReading, saveProfile, saveReminder]
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
