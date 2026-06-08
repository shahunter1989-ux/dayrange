import { fireEvent, render } from "@testing-library/react-native";

import ReportsScreen from "@app/(tabs)/reports";
import { defaultProfile } from "@/data/database";
import { useDayRange } from "@/data/dayrange-store";
import { ReportHistoryItem } from "@/types/domain";

jest.mock("@/data/dayrange-store", () => ({
  useDayRange: jest.fn(),
}));

jest.mock("@/utils/report-export", () => ({
  exportReportCsv: jest.fn(async (plan) => plan.parts),
  exportReportPdf: jest.fn(async (plan) => plan.parts),
}));

const useDayRangeMock = useDayRange as jest.MockedFunction<typeof useDayRange>;

const historyItem: ReportHistoryItem = {
  id: "report-1",
  fileName: "dayrange-week-2026-06-01-to-2026-06-07.pdf",
  rangeType: "week",
  startDate: "2026-06-01T00:00:00.000Z",
  endDate: "2026-06-07T23:59:59.999Z",
  generatedAt: "2026-06-07T14:00:00.000Z",
  readingCount: 3,
  partIndex: 1,
  partCount: 1,
  platform: "web",
};

describe("ReportsScreen", () => {
  beforeEach(() => {
    useDayRangeMock.mockReturnValue({
      profile: defaultProfile,
      readings: [],
      reminders: [],
      reportHistory: [],
      refresh: jest.fn(),
      addReading: jest.fn(),
      deleteReading: jest.fn(),
      saveProfile: jest.fn(),
      saveReminder: jest.fn(),
      addReportHistory: jest.fn(),
    });
  });

  it("renders report range controls, preview, and empty state", async () => {
    const view = await render(<ReportsScreen />);

    expect(view.getByText("Day")).toBeTruthy();
    expect(view.getByText("Week")).toBeTruthy();
    expect(view.getByText("Month")).toBeTruthy();
    expect(view.getByText("Doctor Report Preview")).toBeTruthy();
    expect(view.getByText("No reports created yet.")).toBeTruthy();

    await fireEvent.press(view.getByText("Month"));
    expect(view.getByText(/Month report,/)).toBeTruthy();
  });

  it("renders recent report metadata", async () => {
    useDayRangeMock.mockReturnValue({
      profile: defaultProfile,
      readings: [],
      reminders: [],
      reportHistory: [historyItem],
      refresh: jest.fn(),
      addReading: jest.fn(),
      deleteReading: jest.fn(),
      saveProfile: jest.fn(),
      saveReminder: jest.fn(),
      addReportHistory: jest.fn(),
    });

    const view = await render(<ReportsScreen />);

    expect(view.getByText(historyItem.fileName)).toBeTruthy();
    expect(view.getByText(/3 readings/)).toBeTruthy();
  });
});
