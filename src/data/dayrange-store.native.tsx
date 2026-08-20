import { useSQLiteContext } from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { useCallback, useContext, createContext, ReactNode, useEffect, useMemo, useState } from "react";

import {
  clearAllData,
  defaultProfile,
  getProfile,
  getReadings,
  getReportHistory,
  getReminders,
  insertReading,
  insertReportHistory,
  makeId,
  replaceAllData,
  removeReading,
  setProfile,
  setReminder,
} from "@/data/database";
import { cancelReminderNotification, scheduleReminderNotification } from "@/services/reminders";
import { BackupRestoreInfo, AddReadingInput, Profile, Reading, Reminder, ReportHistoryItem, StorageHealth, StorageHealthStatus } from "@/types/domain";
import { createEncryptedBackup, parseEncryptedBackup } from "@/utils/backup";
import { toMgdl } from "@/utils/glucose";

type DayRangeContextValue = {
  profile: Profile;
  readings: Reading[];
  reminders: Reminder[];
  reportHistory: ReportHistoryItem[];
  storageHealth?: StorageHealth;
  refresh: () => Promise<void>;
  addReading: (input: AddReadingInput) => Promise<void>;
  deleteReading: (id: string) => Promise<void>;
  saveProfile: (profile: Profile) => Promise<void>;
  saveReminder: (reminder: Reminder) => Promise<void>;
  addReportHistory: (items: ReportHistoryItem[]) => Promise<void>;
  createBackup: (password: string) => Promise<string>;
  previewRestore: (fileText: string, password: string) => Promise<BackupRestoreInfo>;
  restoreFromText: (fileText: string, password: string) => Promise<void>;
  deleteAllData: () => Promise<void>;
};

const DayRangeContext = createContext<DayRangeContextValue | null>(null);

async function readStore(db: SQLiteDatabase) {
  const [nextProfile, nextReadings, nextReminders, nextReportHistory] = await Promise.all([
    getProfile(db),
    getReadings(db),
    getReminders(db),
    getReportHistory(db),
  ]);
  return {
    profile: nextProfile,
    readings: nextReadings,
    reminders: nextReminders,
    reportHistory: nextReportHistory,
  };
}

function nextStatus(status: StorageHealthStatus, message?: string, lastSuccessAt?: string): StorageHealth {
  return { status, lastSaveError: message, lastSuccessAt };
}

export function DayRangeProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [profile, setProfileState] = useState<Profile>(defaultProfile);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistoryItem[]>([]);
  const [storageHealth, setStorageHealth] = useState<StorageHealth>({ status: "idle" });

  const refresh = useCallback(async () => {
    const next = await readStore(db);
    setProfileState(next.profile);
    setReadings(next.readings);
    setReminders(next.reminders);
    setReportHistory(next.reportHistory);
    setStorageHealth(nextStatus("saved", undefined, new Date().toISOString()));
  }, [db]);

  useEffect(() => {
    let canceled = false;
    const initialize = async () => {
      await refresh();
      if (!canceled) {
        setStorageHealth(nextStatus("saved"));
      }
    };
    initialize();
    return () => {
      canceled = true;
    };
  }, [db, refresh]);

  const withStorageWrite = useCallback(async (operation: () => Promise<void>) => {
    setStorageHealth(nextStatus("saving"));
    try {
      await operation();
      setStorageHealth(nextStatus("saved", undefined, new Date().toISOString()));
    } catch (error) {
      setStorageHealth(nextStatus("error", error instanceof Error ? error.message : "Failed to save"));
      throw error;
    }
  }, []);

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
      await withStorageWrite(async () => {
        await insertReading(db, reading);
        const next = await getReadings(db);
        setReadings(next);
      });
    },
    [db, withStorageWrite]
  );

  const deleteReading = useCallback(
    async (id: string) => {
      await withStorageWrite(async () => {
        await removeReading(db, id);
        const next = await getReadings(db);
        setReadings(next);
      });
    },
    [db, withStorageWrite]
  );

  const saveProfile = useCallback(
    async (nextProfile: Profile) => {
      await withStorageWrite(async () => {
        await setProfile(db, nextProfile);
        setProfileState(nextProfile);
      });
    },
    [db, withStorageWrite]
  );

  const saveReminder = useCallback(
    async (nextReminder: Reminder) => {
      await withStorageWrite(async () => {
        await cancelReminderNotification(nextReminder.notificationId);
        const notificationId = nextReminder.enabled
          ? await scheduleReminderNotification({ ...nextReminder, notificationId: null })
          : null;
        await setReminder(db, { ...nextReminder, notificationId });
        const next = await getReminders(db);
        setReminders(next);
      });
    },
    [db, withStorageWrite]
  );

  const addReportHistory = useCallback(
    async (items: ReportHistoryItem[]) => {
      await withStorageWrite(async () => {
        await insertReportHistory(db, items);
        const next = await getReportHistory(db);
        setReportHistory(next);
      });
    },
    [db, withStorageWrite]
  );

  const createBackup = useCallback(async (password: string): Promise<string> => {
    if (!password) {
      throw new Error("Password is required.");
    }
    const next = await readStore(db);
    return createEncryptedBackup(
      {
        profile: next.profile,
        reminders: next.reminders,
        readings: next.readings,
        reportHistory: next.reportHistory,
      },
      password
    );
  }, [db]);

  const previewRestore = useCallback(async (fileText: string, password: string) => {
    const result = await parseEncryptedBackup(fileText, password);
    return result.restoreInfo;
  }, []);

  const restoreFromText = useCallback(
    async (fileText: string, password: string) => {
      const { data } = await parseEncryptedBackup(fileText, password);
      await withStorageWrite(async () => {
        await replaceAllData(db, {
          profile: data.profile,
          readings: data.readings,
          reminders: data.reminders,
          reportHistory: data.reportHistory,
        });
        await refresh();
      });
    },
    [db, refresh, withStorageWrite]
  );

  const deleteAllData = useCallback(async () => {
    await withStorageWrite(async () => {
      await clearAllData(db);
      await refresh();
    });
  }, [db, withStorageWrite, refresh]);

  const value = useMemo(
    () => ({
      profile,
      readings,
      reminders,
      reportHistory,
      storageHealth,
      refresh,
      addReading,
      deleteReading,
      saveProfile,
      saveReminder,
      addReportHistory,
      createBackup,
      previewRestore,
      restoreFromText,
      deleteAllData,
    }),
    [profile, readings, reminders, reportHistory, storageHealth, refresh, addReading, deleteReading, saveProfile, saveReminder, addReportHistory, createBackup, previewRestore, restoreFromText, deleteAllData]
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
