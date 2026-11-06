import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLLECTIONS = new Set(["master", "donruss", "topps-now", "extra-collections"]);

export async function GET(request: NextRequest) {
  try {
    const collection = request.nextUrl.searchParams.get("collection");
    const needsOnly = request.nextUrl.searchParams.get("needsOnly") === "true";

    if (collection && !COLLECTIONS.has(collection)) {
      return NextResponse.json({ success: false, error: "Unknown collection." }, { status: 400 });
    }

    const db = getDb();
    const rows = await db`
      SELECT
        c.card_id::text AS "databaseId",
        COALESCE(c.source_card_id, '') AS id,
        COALESCE(c.year, '') AS year,
        COALESCE(c.card_set, '') AS "cardSet",
        COALESCE(c.card_no, '') AS "cardNo",
        COALESCE(c.player_name, '') AS "playerName",
        COALESCE(c.card_description, '') AS "cardDescription",
        COALESCE(c.variant, 'Base') AS variant,
        CASE WHEN c.collecting IS NULL AND c.collection_key = 'donruss' THEN true
             ELSE COALESCE(c.collecting, false) END AS collecting,
        COALESCE(c.got, false) AS got,
        COALESCE(c.image_url, '') AS "imageUrl",
        c.source_row_number AS "rowIndex",
        c.collection_key AS sheet
      FROM cards c
      WHERE (${collection ?? null}::text IS NULL OR c.collection_key = ${collection ?? null})
        AND (${needsOnly}::boolean = false OR (COALESCE(c.collecting, c.collection_key = 'donruss') = true AND COALESCE(c.got, false) = false))
      ORDER BY c.collection_key, c.source_row_number, c.card_id
    `;

    return NextResponse.json({ success: true, cards: rows });
  } catch (error) {
    console.error("Card read failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ success: false, error: "Unable to load cards from the database." }, { status: 503 });
  }
}
