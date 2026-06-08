import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { ReportExportPart } from "@/types/domain";
import { createReportCsv, createReportHtml, PlannedReportExport } from "@/utils/reports";

export async function exportReportPdf(plan: PlannedReportExport): Promise<ReportExportPart[]> {
  for (const job of plan.jobs) {
    const { uri } = await Print.printToFileAsync({ html: createReportHtml(job.report) });
    await Sharing.shareAsync(uri, {
      dialogTitle: job.partCount > 1 ? `Share ${job.fileName}` : "Share DayRange PDF report",
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
    });
  }
  return plan.parts;
}

export async function exportReportCsv(plan: PlannedReportExport): Promise<ReportExportPart[]> {
  for (const job of plan.jobs) {
    const file = new File(Paths.cache, job.fileName);
    if (file.exists) {
      file.delete();
    }
    file.create();
    file.write(createReportCsv(job.report));
    await Sharing.shareAsync(file.uri, {
      dialogTitle: job.partCount > 1 ? `Share ${job.fileName}` : "Share DayRange CSV report",
      mimeType: "text/csv",
      UTI: "public.comma-separated-values-text",
    });
  }
  return plan.parts;
}
