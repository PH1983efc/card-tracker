import { NextResponse } from "next/server";
import { getAuthenticatedSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const SHEETS = [
  { key: "master", name: "Master", hasDescription: true },
  { key: "donruss", name: "Donruss", hasDescription: false },
  { key: "topps-now", name: "Topps Now", hasDescription: false },
  { key: "extra-collections", name: "Extra Collections", hasDescription: false },
];

export async function GET() {
  try {
    const { sheets, sheetId } = getAuthenticatedSheets();

    const allCards: Array<{
      sheet: string;
      rowIndex: number;
      id: string;
      year: string;
      cardSet: string;
      cardNo: string;
      playerName: string;
      cardDescription: string;
      variant: string;
      collecting: boolean;
      got: boolean;
      imageUrl: string;
    }> = [];

    for (const sheetDef of SHEETS) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: sheetDef.name,
        });

        const rows = response.data.values || [];
        if (rows.length < 2) continue;

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          if (sheetDef.hasDescription) {
            allCards.push({
              sheet: sheetDef.key,
              rowIndex: i + 1,
              id: row[0] || "",
              year: row[1] || "",
              cardSet: row[2] || "",
              cardNo: row[3] || "",
              playerName: (row[4] || "").replace(/,\s*$/, ""),
              cardDescription: row[5] || "",
              variant: row[6] || "",
              collecting: row[7] === "TRUE",
              got: row[8] === "TRUE",
              imageUrl: row[9] || "",
            });
          } else {
            allCards.push({
              sheet: sheetDef.key,
              rowIndex: i + 1,
              id: row[0] || "",
              year: row[1] || "",
              cardSet: row[2] || "",
              cardNo: row[3] || "",
              playerName: (row[4] || "").replace(/,\s*$/, ""),
              cardDescription: "",
              variant: row[5] || "",
              collecting: row[6] === "TRUE",
              got: row[7] === "TRUE",
              imageUrl: row[8] || "",
            });
          }
        }
      } catch (err) {
        console.warn(`Could not read sheet "${sheetDef.name}":`, err instanceof Error ? err.message : err);
      }
    }

    return NextResponse.json({ success: true, cards: allCards });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Read error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
