import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSheets } from "@/lib/sheets";

const SHEET_CONFIG: Record<string, { name: string; gotCol: string; imageCol: string }> = {
  master:              { name: "Master",            gotCol: "I", imageCol: "J" },
  donruss:             { name: "Donruss",           gotCol: "G", imageCol: "H" },
  "topps-now":         { name: "Topps Now",         gotCol: "J", imageCol: "K" },
  "extra-collections": { name: "Extra Collections", gotCol: "H", imageCol: "I" },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sheet, rowIndex, got, imageUrl } = body as {
      sheet?: string;
      rowIndex?: number;
      got?: boolean;
      imageUrl?: string;
    };

    const sheetKey = sheet || "master";
    const config = SHEET_CONFIG[sheetKey];

    if (!config) {
      return NextResponse.json(
        { success: false, error: `Unknown sheet: ${sheetKey}` },
        { status: 400 }
      );
    }

    if (!rowIndex) {
      return NextResponse.json(
        { success: false, error: "Missing rowIndex" },
        { status: 400 }
      );
    }

    const { sheets, sheetId } = getAuthenticatedSheets();

    if (got !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${config.name}!${config.gotCol}${rowIndex}`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[got === true ? true : false]],
        },
      });
    }

    if (imageUrl !== undefined && config.imageCol) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${config.name}!${config.imageCol}${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [[imageUrl]],
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Update error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, got } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing id" },
        { status: 400 }
      );
    }

    await db
      .update(cards)
      .set({ got: got === true || got === "true" })
      .where(eq(cards.cardId, String(id)));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Update error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
