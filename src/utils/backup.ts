import * as Crypto from "expo-crypto";

import { BackupData, BackupRestoreInfo } from "@/types/domain";

type BackupPayload = {
  kind: "encrypted";
  algorithm: "aes-gcm-v1";
  salt: string;
  payload: string;
};

type BackupContainer = {
  format: "dayrange-backup";
  version: 1;
  createdAt: string;
  appVersion: string;
  data: BackupPayload;
};

const VERSION = 1;
const FORMAT = "dayrange-backup";
const IV_LENGTH = 12;

function toBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index];
    const byte2 = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const byte3 = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triplet = (byte1 << 16) | (byte2 << 8) | byte3;
    output += chars[(triplet >> 18) & 0x3f];
    output += chars[(triplet >> 12) & 0x3f];
    if (index + 1 < bytes.length) {
      output += chars[(triplet >> 6) & 0x3f];
    } else {
      output += "=";
    }
    output += index + 2 < bytes.length ? chars[triplet & 0x3f] : "=";
  }
  return output;
}

function fromBase64(base64: string): Uint8Array {
  const normalized = base64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes = new Uint8Array(Math.floor((normalized.length * 3) / 4));
  let byteIndex = 0;
  for (let index = 0; index < normalized.length; index += 4) {
    const char1 = normalized.charCodeAt(index);
    const char2 = normalized.charCodeAt(index + 1);
    const char3 = normalized.charCodeAt(index + 2);
    const char4 = normalized.charCodeAt(index + 3);
    const idx1 = toBase64Index(char1);
    const idx2 = toBase64Index(char2);
    const idx3 = normalized[index + 2] === "=" ? 64 : toBase64Index(char3);
    const idx4 = normalized[index + 3] === "=" ? 64 : toBase64Index(char4);

    const triplet = (idx1 << 18) | (idx2 << 12) | ((idx3 & 0x3f) << 6) | (idx4 & 0x3f);
    bytes[byteIndex++] = (triplet >> 16) & 0xff;
    if (idx3 !== 64) {
      bytes[byteIndex++] = (triplet >> 8) & 0xff;
    }
    if (idx4 !== 64) {
      bytes[byteIndex++] = triplet & 0xff;
    }
  }
  return bytes.slice(0, byteIndex);
}

function toBase64Index(charCode: number): number {
  if (charCode >= 65 && charCode <= 90) {
    return charCode - 65;
  }
  if (charCode >= 97 && charCode <= 122) {
    return charCode - 97 + 26;
  }
  if (charCode >= 48 && charCode <= 57) {
    return charCode - 48 + 52;
  }
  if (charCode === 43) {
    return 62;
  }
  if (charCode === 47) {
    return 63;
  }
  return 64;
}

function stringToBase64(value: string): string {
  return toBase64(new TextEncoder().encode(value));
}

function base64ToString(base64: string): string {
  return new TextDecoder().decode(fromBase64(base64));
}

async function randomSalt(): Promise<string> {
  const array = await Crypto.getRandomBytesAsync(16);
  return toBase64(array);
}

async function deriveKey(password: string, salt: string): Promise<Crypto.AESEncryptionKey> {
  let seed = `${password}::${salt}`;
  for (let round = 0; round < 5000; round += 1) {
    seed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed, {
      encoding: Crypto.CryptoEncoding.BASE64,
    });
  }

  return Crypto.AESEncryptionKey.import(seed, "base64");
}

export async function createEncryptedBackup(data: BackupData, password: string): Promise<string> {
  const salt = await randomSalt();
  const key = await deriveKey(password, salt);
  const payload = JSON.stringify({
    profile: data.profile,
    readings: data.readings,
    reminders: data.reminders,
    reportHistory: data.reportHistory,
    createdAt: new Date().toISOString(),
  });
  const plaintext = stringToBase64(payload);
  const sealed = await Crypto.aesEncryptAsync(plaintext, key, {
    tagLength: 16,
    nonce: {
      length: IV_LENGTH,
    },
  });
  const payloadText = (await sealed.combined("base64")) as string;
  const envelope: BackupContainer = {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    appVersion: "1.0.0",
    data: {
      kind: "encrypted",
      algorithm: "aes-gcm-v1",
      salt,
      payload: payloadText,
    },
  };

  return JSON.stringify(envelope);
}

export async function parseEncryptedBackup(
  raw: string,
  password: string
): Promise<{ restoreInfo: BackupRestoreInfo; data: BackupData }> {
  let parsed: BackupContainer;
  try {
    parsed = JSON.parse(raw) as BackupContainer;
  } catch {
    throw new Error("Invalid backup file contents.");
  }

  if (parsed.format !== FORMAT) {
    throw new Error("Unknown backup format.");
  }
  if (parsed.version !== VERSION || !parsed.data || parsed.data.kind !== "encrypted") {
    throw new Error("Unsupported backup version.");
  }

  const key = await deriveKey(password, parsed.data.salt);
  try {
    const sealed = Crypto.AESSealedData.fromCombined(parsed.data.payload, {
      ivLength: IV_LENGTH,
      tagLength: 16,
    });
    const decrypted = await Crypto.aesDecryptAsync(sealed, key, { output: "base64" });
    const decoded = base64ToString(decrypted);
    const data = JSON.parse(decoded) as {
      profile: BackupData["profile"];
      readings: BackupData["readings"];
      reminders: BackupData["reminders"];
      reportHistory: BackupData["reportHistory"];
      createdAt: string;
    };

    if (!data?.profile || !Array.isArray(data.readings) || !Array.isArray(data.reminders)) {
      throw new Error("Malformed backup data.");
    }

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
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes("bad")) {
      throw new Error("Invalid password or damaged backup.");
    }
    throw new Error("Could not decrypt backup.");
  }
}
