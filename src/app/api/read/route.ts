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
}import { NextResponse } from "next/server";
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
}import { NextResponse } from "next/server";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const allCards = await db
      .select()
      .from(cards)
      .orderBy(asc(cards.id));

    // Return in the same format as the Google Sheets API
    const header = [
      "Card ID",
      "Year",
      "Card Set",
      "Card No.",
      "Player Name",
      "Card Description",
      "Variant",
      "Collecting",
      "Got",
      "Image URL",
    ];

    const rows = [
      header,
      ...allCards.map((c) => [
        c.cardId,
        c.year,
        c.cardSet,
        c.cardNo,
        c.playerName,
        c.cardDescription,
        c.variant,
        c.collecting ? "TRUE" : "FALSE",
        c.got ? "TRUE" : "FALSE",
        c.imageUrl || "",
      ]),
    ];

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
