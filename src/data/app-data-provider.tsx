import { ReactNode } from "react";

import { DayRangeProvider } from "@/data/dayrange-store";

export function AppDataProvider({ children }: { children: ReactNode }) {
  return <DayRangeProvider>{children}</DayRangeProvider>;
}
