import { SQLiteProvider } from "expo-sqlite";
import { ReactNode } from "react";

import { DayRangeProvider } from "@/data/dayrange-store";
import { migrateDatabase } from "@/data/database";

export function AppDataProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName="dayrange.db" onInit={migrateDatabase} useSuspense>
      <DayRangeProvider>{children}</DayRangeProvider>
    </SQLiteProvider>
  );
}
