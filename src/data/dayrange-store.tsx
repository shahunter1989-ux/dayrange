import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { defaultReminders } from "@/constants/options";
import { defaultProfile, makeId } from "@/data/database";
import {
  AddReadingInput,
  BackupData,
  BackupRestoreInfo,
  Profile,
  Reading,
  Reminder,
  ReportHistoryItem,
  StorageHealth,
} from "@/types/domain";
import { toMgdl } from "@/utils/glucose";
import { createEncryptedBackup, parseEncryptedBackup } from "@/utils/backup";

type IndexedStore = "profile" | "readings" | "reminders" | "reportHistory" | "metadata" | "recovery";

type MetaRecord = {
  key: string;
  value: string;
};

type WebStoreHealth = StorageHealth;

type WebStoreState = {
  profile: Profile;
  readings: Reading[];
  reminders: Reminder[];
  reportHistory: ReportHistoryItem[];
};

type DayRangeContextValue = {
  profile: Profile;
  readings: Reading[];
  reminders: Reminder[];
  reportHistory: ReportHistoryItem[];
  storageHealth?: WebStoreHealth;
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
const DB_NAME = "dayrange-web-db";
const DB_VERSION = 1;
const LEGACY_STORAGE_KEY = "dayrange-web-store";

function blankStore(): WebStoreState {
  return {
    profile: defaultProfile,
    readings: [],
    reminders: defaultReminders,
    reportHistory: [],
  };
}

async function openWebDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("profile")) {
        db.createObjectStore("profile", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("readings")) {
        const store = db.createObjectStore("readings", { keyPath: "id" });
        store.createIndex("recordedAt", "recordedAt");
      }
      if (!db.objectStoreNames.contains("reminders")) {
        db.createObjectStore("reminders", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("reportHistory")) {
        const store = db.createObjectStore("reportHistory", { keyPath: "id" });
        store.createIndex("generatedAt", "generatedAt");
      }
      if (!db.objectStoreNames.contains("metadata")) {
        db.createObjectStore("metadata", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("recovery")) {
        const store = db.createObjectStore("recovery", { autoIncrement: true });
        store.createIndex("seenAt", "seenAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed opening web store"));
    request.onblocked = () => reject(new Error("IndexedDB blocked by another open tab"));
  });
}

async function withStore<T>(
  db: IDBDatabase,
  storeName: IndexedStore,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    try {
      const result = operation(store);
      Promise.resolve(result).then(
        (value) => resolve(value),
        (error) => reject(error)
      );
    } catch (error) {
      reject(error);
    }
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
  });
}

function safeDate(value: unknown): string {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : value;
}

function isValidReminder(item: unknown): item is Reminder {
  return (
    !!item &&
    typeof item === "object" &&
    typeof (item as Reminder).id === "string" &&
    typeof (item as Reminder).kind === "string" &&
    typeof (item as Reminder).label === "string" &&
    typeof (item as Reminder).hour === "number" &&
    typeof (item as Reminder).minute === "number" &&
    typeof (item as Reminder).enabled === "boolean"
  );
}

function isValidReading(item: unknown): item is Reading {
  return (
    !!item &&
    typeof item === "object" &&
    typeof (item as Reading).id === "string" &&
    typeof (item as Reading).recordedAt === "string" &&
    typeof (item as Reading).glucoseMgdl === "number" &&
    typeof (item as Reading).displayValue === "number" &&
    ((item as Reading).displayUnit === "mg/dL" || (item as Reading).displayUnit === "mmol/L")
  );
}

function normalizeBackupPayload(input: unknown): BackupData {
  const base = input as Partial<BackupData>;
  const profile = base.profile && typeof base.profile === "object" ? (base.profile as Profile) : defaultProfile;
  const readings = Array.isArray(base.readings) ? base.readings.filter(isValidReading) : [];
  const reminders = Array.isArray(base.reminders) ? base.reminders.filter(isValidReminder) : defaultReminders;
  const reportHistory = Array.isArray(base.reportHistory) ? base.reportHistory.filter(Boolean) : [];
  return {
    profile: { ...defaultProfile, ...profile },
    readings,
    reminders,
    reportHistory,
  };
}

async function migrateLegacyIfNeeded(db: IDBDatabase) {
  const meta = await getMetadata(db, "legacy-migration");
  if (meta === "done") {
    return;
  }

  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) {
    await setMetadata(db, "legacy-migration", "done");
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await setMetadata(db, "legacy-migration", "failed");
    await setMetadata(db, "legacy-migration-message", "Could not parse legacy dayrange-web-store JSON.");
    return;
  }

  const next = normalizeBackupPayload(parsed);
  try {
    await withStore(db, "profile", "readwrite", async (store) => {
      store.put({ ...next.profile, id: next.profile.id });
    });
    await withStore(db, "readings", "readwrite", async (store) => {
      for (const item of next.readings) {
        store.put({ ...item, recordedAt: safeDate(item.recordedAt) });
      }
    });
    await withStore(db, "reminders", "readwrite", async (store) => {
      if (next.reminders.length) {
        for (const item of next.reminders) {
          store.put({ ...item });
        }
      } else {
        defaultReminders.forEach((item) => store.put(item));
      }
    });
    await withStore(db, "reportHistory", "readwrite", async (store) => {
      for (const item of next.reportHistory) {
        store.put(item);
      }
    });
    await setMetadata(db, "legacy-migration", "done");
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    await setMetadata(db, "legacy-migration", "failed");
    await setMetadata(db, "legacy-migration-message", "Failed to import legacy local data.");
  }
}

async function getMetadata(db: IDBDatabase, key: string): Promise<string | null> {
  const tx = db.transaction("metadata", "readonly");
  const store = tx.objectStore("metadata");
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve((request.result?.value as string) ?? null);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB metadata read failed"));
  });
}

async function setMetadata(db: IDBDatabase, key: string, value: string): Promise<void> {
  await withStore(db, "metadata", "readwrite", async (store) => {
    const record: MetaRecord = { key, value };
    store.put(record);
  });
}

async function loadAll(db: IDBDatabase): Promise<WebStoreState> {
  const storeData = { ...blankStore() };
  const profileRecords = await withStore(db, "profile", "readonly", async (store) => {
    return new Promise<Profile[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result ?? []);
      request.onerror = () => reject(request.error ?? new Error("Failed to load profile"));
    });
  });
  if (profileRecords.length) {
    const normalized = { ...defaultProfile, ...profileRecords[0] };
    storeData.profile = normalized;
  }

  const readings = await withStore(db, "readings", "readonly", async (store) => {
    return new Promise<Reading[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result ?? []).filter((value: unknown) => isValidReading(value)) as Reading[]);
      request.onerror = () => reject(request.error ?? new Error("Failed to load readings"));
    });
  });
  storeData.readings = readings.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  storeData.reminders = await withStore(db, "reminders", "readonly", async (store) => {
    return new Promise<Reminder[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve((request.result ?? []).filter((value: unknown) => isValidReminder(value)) as Reminder[]);
      request.onerror = () => reject(request.error ?? new Error("Failed to load reminders"));
    });
  });
  if (!storeData.reminders.length) {
    storeData.reminders = [...defaultReminders];
  }

  storeData.reportHistory = await withStore(db, "reportHistory", "readonly", async (store) => {
    return new Promise<ReportHistoryItem[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result?.slice(0, 20) ?? []);
      request.onerror = () => reject(request.error ?? new Error("Failed to load report history"));
    });
  });

  return storeData;
}

async function readStorageStatus(): Promise<Pick<WebStoreHealth, "isPersistentStorage" | "storageUsed" | "storageQuota">> {
  if (typeof navigator === "undefined") {
    return {};
  }
  const storage = (navigator as Navigator & { storage?: StorageManager }).storage;
  if (!storage?.estimate) {
    return {};
  }
  const estimate = await storage.estimate();
  const persisted = storage.persisted ? await storage.persisted().catch(() => false) : false;
  const used = estimate.usage ?? undefined;
  const quota = estimate.quota ?? undefined;
  return { isPersistentStorage: persisted, storageUsed: used, storageQuota: quota };
}

function readLegacyRecoveryMessage(db: IDBDatabase): Promise<string | null> {
  return getMetadata(db, "legacy-migration-message");
}

function normalizeForStorage(reading: Reading): Reading {
  return {
    ...reading,
    mealLabel: reading.mealLabel?.trim() ?? "",
    medicationNote: reading.medicationNote?.trim() ?? "",
    activityNote: reading.activityNote?.trim() ?? "",
    notes: reading.notes?.trim() ?? "",
    tags: Array.isArray(reading.tags) ? reading.tags : [],
    symptoms: Array.isArray(reading.symptoms) ? reading.symptoms : [],
    createdAt: safeDate(reading.createdAt),
    recordedAt: safeDate(reading.recordedAt),
  };
}

function createRecoveryRecord(db: IDBDatabase, message: string) {
  return withStore(db, "recovery", "readwrite", async (store) => {
    store.add({ seenAt: new Date().toISOString(), message });
  });
}

export function DayRangeProvider({ children }: { children: ReactNode }) {
  const dbRef = useRef<IDBDatabase | null>(null);
  const [store, setStore] = useState<WebStoreState>(blankStore());
  const [storageHealth, setStorageHealth] = useState<WebStoreHealth>({ status: "idle" });

  const load = useCallback(async () => {
    if (!window.indexedDB) {
      setStorageHealth(toStorageModeError("IndexedDB unavailable."));
      return;
    }
    const db = dbRef.current ?? (await openWebDatabase());
    dbRef.current = db;
    await migrateLegacyIfNeeded(db);
    const next = await loadAll(db);
    const recoveryMessage = await readLegacyRecoveryMessage(db);
    const status = await readStorageStatus();
    setStorageHealth({
      status: "saved",
      storageUsed: status.storageUsed,
      storageQuota: status.storageQuota,
      isPersistentStorage: status.isPersistentStorage,
      lastSaveError: recoveryMessage ?? undefined,
    });
    setStore((current) => ({ ...current, ...next }));
  }, []);

  const persist = useCallback(
    async (updater: (current: WebStoreState) => Promise<WebStoreState>) => {
      const db = dbRef.current ?? (await openWebDatabase());
      dbRef.current = db;
      setStorageHealth({ status: "saving" });
    try {
      const next = await updater(store);
      setStore(next);
      const status = await readStorageStatus();
        setStorageHealth({
          status: "saved",
          storageUsed: status.storageUsed,
          storageQuota: status.storageQuota,
          isPersistentStorage: status.isPersistentStorage,
          lastSuccessAt: new Date().toISOString(),
        });
      } catch (error) {
        setStorageHealth(toStorageModeError(error instanceof Error ? error.message : "Failed to save data."));
        await createRecoveryRecord(db, error instanceof Error ? error.message : "Unknown write failure.");
        throw error;
      }
    },
    [store]
  );

  useEffect(() => {
    let canceled = false;
    const initialize = async () => {
      await load();
      if (!canceled) {
        setStorageHealth((current) => ({ ...current, status: "saved" }));
      }
    };
    initialize();
    return () => {
      canceled = true;
      dbRef.current?.close();
      dbRef.current = null;
    };
  }, [load]);

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
      await persist(async (current) => {
        const normalizedReading = normalizeForStorage(reading);
        const db = dbRef.current;
        if (!db) {
          throw new Error("Storage not ready");
        }
        await withStore(db, "readings", "readwrite", async (store) => {
          store.put(normalizedReading);
        });
        return {
          ...current,
          readings: [normalizedReading, ...current.readings].sort(
            (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
          ),
        };
      });
    },
    [persist]
  );

  const deleteReading = useCallback(
    async (id: string) => {
      await persist(async (current) => {
        const db = dbRef.current;
        if (!db) {
          throw new Error("Storage not ready");
        }
        await withStore(db, "readings", "readwrite", async (store) => {
          store.delete(id);
        });
        return {
          ...current,
          readings: current.readings.filter((item) => item.id !== id),
        };
      });
    },
    [persist]
  );

  const saveProfile = useCallback(
    async (nextProfile: Profile) => {
      await persist(async (current) => {
        const db = dbRef.current;
        if (!db) {
          throw new Error("Storage not ready");
        }
        const profile = { ...nextProfile, id: defaultProfile.id };
        await withStore(db, "profile", "readwrite", async (store) => {
          store.put(profile);
        });
        return { ...current, profile };
      });
    },
    [persist]
  );

  const saveReminder = useCallback(
    async (nextReminder: Reminder) => {
      await persist(async (current) => {
        const db = dbRef.current;
        if (!db) {
          throw new Error("Storage not ready");
        }
        await withStore(db, "reminders", "readwrite", async (store) => {
          store.put({ ...nextReminder });
        });
        return {
          ...current,
          reminders: current.reminders.map((item) => (item.id === nextReminder.id ? nextReminder : item)),
        };
      });
    },
    [persist]
  );

  const addReportHistory = useCallback(
    async (items: ReportHistoryItem[]) => {
      await persist(async (current) => {
        const db = dbRef.current;
        if (!db) {
          throw new Error("Storage not ready");
        }
        await withStore(db, "reportHistory", "readwrite", async (store) => {
          for (const item of items) {
            store.put(item);
          }
        });
        return {
          ...current,
          reportHistory: [...items, ...current.reportHistory].slice(0, 20),
        };
      });
    },
    [persist]
  );

  const createBackup = useCallback(
    async (password: string): Promise<string> => {
      if (!password) {
        throw new Error("Password is required.");
      }
      const latest = await loadAll(dbRef.current || (await openWebDatabase()));
      return createEncryptedBackup(
        {
          profile: latest.profile,
          reminders: latest.reminders,
          readings: latest.readings,
          reportHistory: latest.reportHistory,
        },
        password
      );
    },
    []
  );

  const previewRestore = useCallback(async (fileText: string, password: string): Promise<BackupRestoreInfo> => {
    const { restoreInfo } = await parseEncryptedBackup(fileText, password);
    return restoreInfo;
  }, []);

  const restoreFromText = useCallback(async (fileText: string, password: string) => {
    const { data } = await parseEncryptedBackup(fileText, password);
    const payload = normalizeBackupPayload(data);
    await persist(async () => {
      const db = dbRef.current ?? (await openWebDatabase());
      dbRef.current = db;
      await withStore(db, "profile", "readwrite", async (store) => {
        store.clear();
        store.put({ ...payload.profile, id: defaultProfile.id });
      });
      await withStore(db, "readings", "readwrite", async (store) => {
        store.clear();
        payload.readings.forEach((item) => store.put(normalizeForStorage(item)));
      });
      await withStore(db, "reminders", "readwrite", async (store) => {
        store.clear();
        (payload.reminders.length ? payload.reminders : defaultReminders).forEach((reminder) => store.put(reminder));
      });
      await withStore(db, "reportHistory", "readwrite", async (store) => {
        store.clear();
        payload.reportHistory.forEach((item) => store.put(item));
      });
      await setMetadata(db, "legacy-migration", "done");
      return payload;
    });
  }, [persist]);

  const deleteAllData = useCallback(async () => {
    await persist(async () => {
      const db = dbRef.current ?? (await openWebDatabase());
      dbRef.current = db;
      await withStore(db, "profile", "readwrite", async (store) => {
        store.clear();
        store.put({ ...defaultProfile });
      });
      await withStore(db, "readings", "readwrite", async (store) => {
        store.clear();
      });
      await withStore(db, "reminders", "readwrite", async (store) => {
        store.clear();
        defaultReminders.forEach((item) => store.put(item));
      });
      await withStore(db, "reportHistory", "readwrite", async (store) => {
        store.clear();
      });
      return blankStore();
    });
  }, [persist]);

  const value = useMemo(
    () => ({
      ...store,
      storageHealth,
      refresh: load,
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
    [store, storageHealth, load, addReading, deleteReading, saveProfile, saveReminder, addReportHistory, createBackup, previewRestore, restoreFromText, deleteAllData]
  );

  return <DayRangeContext.Provider value={value}>{children}</DayRangeContext.Provider>;
}

function toStorageModeError(message: string): WebStoreHealth {
  return { status: "error", lastSaveError: message };
}

export function useDayRange(): DayRangeContextValue {
  const value = useContext(DayRangeContext);
  if (!value) {
    throw new Error("useDayRange must be used inside DayRangeProvider");
  }
  return value;
}
