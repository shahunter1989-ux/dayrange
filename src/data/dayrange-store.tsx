import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { defaultReminders } from "@/constants/options";
import { defaultProfile, makeId } from "@/data/database";
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

type WebStore = {
  profile: Profile;
  readings: Reading[];
  reminders: Reminder[];
  reportHistory: ReportHistoryItem[];
};

const STORAGE_KEY = "dayrange-web-store";
const DayRangeContext = createContext<DayRangeContextValue | null>(null);

function initialStore(): WebStore {
  return {
    profile: defaultProfile,
    readings: [],
    reminders: defaultReminders,
    reportHistory: [],
  };
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readWebStore(): WebStore {
  if (!canUseStorage()) {
    return initialStore();
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return initialStore();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<WebStore>;
    return {
      profile: { ...defaultProfile, ...parsed.profile },
      readings: parsed.readings ?? [],
      reminders: parsed.reminders ?? defaultReminders,
      reportHistory: parsed.reportHistory ?? [],
    };
  } catch {
    return initialStore();
  }
}

function writeWebStore(store: WebStore) {
  if (canUseStorage()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }
}

export function DayRangeProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<WebStore>(initialStore);

  const refresh = useCallback(async () => {
    setStore(readWebStore());
  }, []);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setStore(readWebStore());
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = useCallback((updater: (current: WebStore) => WebStore) => {
    setStore((current) => {
      const next = updater(current);
      writeWebStore(next);
      return next;
    });
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
      persist((current) => ({
        ...current,
        readings: [reading, ...current.readings].sort(
          (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
        ),
      }));
    },
    [persist]
  );

  const deleteReading = useCallback(
    async (id: string) => {
      persist((current) => ({
        ...current,
        readings: current.readings.filter((reading) => reading.id !== id),
      }));
    },
    [persist]
  );

  const saveProfile = useCallback(
    async (profile: Profile) => {
      persist((current) => ({ ...current, profile }));
    },
    [persist]
  );

  const saveReminder = useCallback(
    async (reminder: Reminder) => {
      persist((current) => ({
        ...current,
        reminders: current.reminders.map((item) =>
          item.id === reminder.id ? { ...reminder, notificationId: null } : item
        ),
      }));
    },
    [persist]
  );

  const addReportHistory = useCallback(
    async (items: ReportHistoryItem[]) => {
      persist((current) => ({
        ...current,
        reportHistory: [...items, ...current.reportHistory].slice(0, 20),
      }));
    },
    [persist]
  );

  const value = useMemo(
    () => ({
      profile: store.profile,
      readings: store.readings,
      reminders: store.reminders,
      reportHistory: store.reportHistory,
      refresh,
      addReading,
      deleteReading,
      saveProfile,
      saveReminder,
      addReportHistory,
    }),
    [store, refresh, addReading, deleteReading, saveProfile, saveReminder, addReportHistory]
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
