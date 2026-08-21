import { BackupData, BackupRestoreInfo } from "@/types/domain";

type BackupPayload = {
  data: {
    profile: BackupData["profile"];
    readings: BackupData["readings"];
    reminders: BackupData["reminders"];
    reportHistory: BackupData["reportHistory"];
    createdAt: string;
  };
};

type BackupContainer = {
  format: "dayrange-backup";
  version: 1;
  createdAt: string;
  appVersion: string;
  data: BackupPayload["data"];
};

const VERSION = 1;
const FORMAT = "dayrange-backup";

function assertBackupShape(value: unknown): value is BackupContainer {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as BackupContainer;
  return (
    candidate.format === FORMAT &&
    candidate.version === VERSION &&
    !!candidate.createdAt &&
    !!candidate.data &&
    !!candidate.data.profile &&
    Array.isArray(candidate.data.readings) &&
    Array.isArray(candidate.data.reminders)
  );
}

export async function createEncryptedBackup(data: BackupData, _password?: string): Promise<string> {
  const payload: BackupPayload = {
    data: {
      profile: data.profile,
      readings: data.readings,
      reminders: data.reminders,
      reportHistory: data.reportHistory,
      createdAt: new Date().toISOString(),
    },
  };

  const envelope: BackupContainer = {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    appVersion: "1.0.0",
    data: payload.data,
  };

  return JSON.stringify(envelope);
}

export async function parseEncryptedBackup(
  raw: string,
  _password?: string
): Promise<{ restoreInfo: BackupRestoreInfo; data: BackupData }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid backup file contents.");
  }

  if (!assertBackupShape(parsed)) {
    throw new Error("Unsupported or invalid backup format.");
  }

  const data = parsed.data;
  return {
    restoreInfo: {
      createdAt: data.createdAt || parsed.createdAt,
      readingCount: data.readings.length,
      profileIncluded: Boolean(data.profile),
      version: parsed.version,
    },
    data: {
      profile: data.profile,
      readings: data.readings,
      reminders: data.reminders,
      reportHistory: data.reportHistory ?? [],
    },
  };
}
