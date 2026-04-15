import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { hasCSRole, requireAuth } from "@/lib/auth";
import { logAction } from "@/lib/action-log";

type DrillDownRow = {
  date: string;
  orders: number;
  payouts: number;
  refunds: number;
  adjustments: number;
  netProfit: number;
};

type AnalyticsExportPayload = {
  drillDownRows?: DrillDownRow[];
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function serializeCsv(rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escaped = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const dataRows = rows.map((row) => headers.map((h) => escaped(row[h] ?? "")).join(","));
  return [headers.join(","), ...dataRows].join("\n");
}

async function createPdfReport(rows: Array<Record<string, string | number>>, range: string) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const headers = rows.length ? Object.keys(rows[0]) : ["date", "orders", "payouts_tnd", "refunds_tnd", "adjustments_tnd", "net_profit_tnd"];
  const colWidths = [100, 60, 120, 120, 130, 120];
  const rowsPerPage = 28;
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdfDoc.addPage([842, 595]);
    const { height } = page.getSize();
    let y = height - 40;

    page.drawText("Financial Analytics Report", {
      x: 40,
      y,
      size: 20,
      font: bold,
      color: rgb(0.08, 0.12, 0.2),
    });
    y -= 24;
    page.drawText(
      `Range: ${range.toUpperCase()}  |  Generated: ${new Date().toLocaleString()}  |  Page ${pageIndex + 1}/${pageCount}`,
      {
        x: 40,
        y,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      },
    );
    y -= 24;

    let x = 40;
    headers.forEach((header, i) => {
      page.drawText(header, { x, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
      x += colWidths[i] || 90;
    });
    y -= 14;
    page.drawLine({ start: { x: 40, y }, end: { x: 800, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 12;

    const pageRows = rows.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    pageRows.forEach((row) => {
      x = 40;
      headers.forEach((header, i) => {
        page.drawText(String(row[header] ?? ""), { x, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
        x += colWidths[i] || 90;
      });
      y -= 16;
    });

    page.drawText("CONFIDENTIAL - DELIVERY CONTROL FINANCE", {
      x: 210,
      y: 20,
      size: 12,
      font: bold,
      color: rgb(0.75, 0.75, 0.78),
    });
  }

  return pdfDoc.save();
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    const isAdmin = auth.role === "ADMIN";
    if (!isAdmin && !(hasCSRole(auth, "MANAGE_FINANCIAL_REPORTS"))) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "week";
    const format = (url.searchParams.get("format") || "csv").toLowerCase();
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const governorateIds = url.searchParams.get("governorateIds");
    const delegationIds = url.searchParams.get("delegationIds");
    const statuses = url.searchParams.get("statuses");
    const paymentTypes = url.searchParams.get("paymentTypes");
    const driverCohort = url.searchParams.get("driverCohort");
    const countryId = url.searchParams.get("countryId");
    const analyticsQuery = new URLSearchParams({ range });
    if (startDate && endDate) {
      analyticsQuery.set("startDate", startDate);
      analyticsQuery.set("endDate", endDate);
    }
    if (governorateIds) analyticsQuery.set("governorateIds", governorateIds);
    if (delegationIds) analyticsQuery.set("delegationIds", delegationIds);
    if (statuses) analyticsQuery.set("statuses", statuses);
    if (paymentTypes) analyticsQuery.set("paymentTypes", paymentTypes);
    if (driverCohort) analyticsQuery.set("driverCohort", driverCohort);
    if (countryId) analyticsQuery.set("countryId", countryId);
    const sourceResponse = await fetch(`${url.origin}/api/dashboard/financial-analytics?${analyticsQuery.toString()}`, {
      headers: { cookie: req.headers.get("cookie") || "" },
      cache: "no-store",
    });
    if (!sourceResponse.ok) {
      const err = await sourceResponse.json().catch(() => ({ error: "Failed to fetch analytics source." }));
      return NextResponse.json(err, { status: sourceResponse.status });
    }
    const data = (await sourceResponse.json()) as AnalyticsExportPayload;
    const rows = (data.drillDownRows || []).map((row) => ({
      date: row.date,
      orders: row.orders,
      payouts_tnd: Number(row.payouts ?? 0).toFixed(2),
      refunds_tnd: Number(row.refunds ?? 0).toFixed(2),
      adjustments_tnd: Number(row.adjustments ?? 0).toFixed(2),
      net_profit_tnd: Number(row.netProfit ?? 0).toFixed(2),
    }));

    const dateTag = new Date().toISOString().slice(0, 10);
    const scopeTag = startDate && endDate ? `${startDate}_to_${endDate}` : range;
    try {
      await logAction({
        actorId: auth.superUserId,
        actorRole: auth.role,
        actionType: format === "pdf" ? "EXPORT_FINANCIAL_ANALYTICS_PDF" : "EXPORT_FINANCIAL_ANALYTICS_CSV",
        targetType: "FINANCIAL_DASHBOARD",
        targetId: isAdmin ? "GLOBAL" : auth.customerServiceId || "CS_SCOPE",
        newValue: JSON.stringify({ range, rows: rows.length, format }),
      });
    } catch (error) {
      console.error("Failed to log analytics export", error);
    }

    if (format === "pdf") {
      const pdfBytes = await createPdfReport(rows, range);
      const fileName = `financial_analytics_${scopeTag}_${dateTag}.pdf`;
      return new NextResponse(toArrayBuffer(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    if (format === "xlsx") {
      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Financial Analytics");
      const xlsxBytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      const fileName = `financial_analytics_${scopeTag}_${dateTag}.xlsx`;
      return new NextResponse(xlsxBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    if (format === "board") {
      const csv = serializeCsv(rows);
      const pdfBytes = await createPdfReport(rows, range);
      const sheet = XLSX.utils.json_to_sheet(rows);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Financial Analytics");
      const xlsxBytes = XLSX.write(book, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
      const summary = JSON.stringify({
        generatedAt: new Date().toISOString(),
        range,
        rowCount: rows.length,
      }, null, 2);
      const zip = new JSZip();
      zip.file("financial_analytics.csv", csv);
      zip.file("financial_analytics.pdf", toArrayBuffer(pdfBytes));
      zip.file("financial_analytics.xlsx", xlsxBytes);
      zip.file("summary.json", summary);
      const archive = await zip.generateAsync({ type: "uint8array" });
      const fileName = `financial_board_bundle_${scopeTag}_${dateTag}.zip`;
      return new NextResponse(toArrayBuffer(archive), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${fileName}"`,
        },
      });
    }

    const csv = serializeCsv(rows);
    const fileName = `financial_analytics_${scopeTag}_${dateTag}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
