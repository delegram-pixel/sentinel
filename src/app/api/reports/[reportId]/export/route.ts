import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { readReportExport } from "@/modules/reports/application/report-service";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
): Promise<Response> {
  const { reportId } = await params;
  const format = new URL(request.url).searchParams.get("format") === "pdf" ? "PDF" : "MARKDOWN";
  const session = await getSessionContext();
  const result = await readReportExport(
    new PrismaReportStore(getDb()),
    session.workspace.id,
    reportId,
    format,
  );

  if (!result) {
    return new Response("This report is not available for export.", { status: 404 });
  }

  return new Response(result.body, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
