import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { buildScheduleWorkbook, buildProfilesWorkbook, exportFileName } from "@/lib/server/export-excel";
import { withRoute } from "@/lib/server/http";

/**
 * Admin: download the clinic data as an Excel (.xlsx) workbook.
 *   GET /api/admin/export?type=schedule   → the appointments calendar
 *   GET /api/admin/export?type=profiles   → patients + operations/payments/messages
 */
export const GET = withRoute("admin.export.GET", adminExportGET);

async function adminExportGET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const type = new URL(req.url).searchParams.get("type");
  if (type !== "schedule" && type !== "profiles") {
    return NextResponse.json({ error: "bad_type" }, { status: 400 });
  }

  const buffer = type === "schedule" ? await buildScheduleWorkbook() : await buildProfilesWorkbook();
  const fileName = exportFileName(type);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
