import { NextResponse } from "next/server";
import { getAuthenticatedSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { sheets, sheetId } = getAuthenticatedSheets();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: "Master",
    });

    const rows = response.data.values || [];
    return NextResponse.json({ success: true, rows });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Read error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
