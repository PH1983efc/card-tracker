import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      cardId?: string;
      got?: boolean;
      imageUrl?: string;
    };

    if (!body.cardId || !/^\d+$/.test(body.cardId)) {
      return NextResponse.json({ success: false, error: "A valid database card ID is required." }, { status: 400 });
    }
    if (body.got === undefined && body.imageUrl === undefined) {
      return NextResponse.json({ success: false, error: "There is nothing to update." }, { status: 400 });
    }
    if (body.got !== undefined && typeof body.got !== "boolean") {
      return NextResponse.json({ success: false, error: "Got must be true or false." }, { status: 400 });
    }
    if (body.imageUrl !== undefined && typeof body.imageUrl !== "string") {
      return NextResponse.json({ success: false, error: "Image URL must be text." }, { status: 400 });
    }

    const db = getDb();
    const rows = await db`
      UPDATE cards
      SET got = CASE WHEN ${body.got ?? null}::boolean IS NULL THEN got ELSE ${body.got ?? null}::boolean END,
          image_url = CASE WHEN ${body.imageUrl !== undefined}::boolean THEN ${body.imageUrl ?? null}::text ELSE image_url END,
          updated_at = now()
      WHERE card_id = ${body.cardId}::bigint
      RETURNING card_id::text AS "databaseId"
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, error: "Card not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Card update failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ success: false, error: "Unable to save the card update." }, { status: 503 });
  }
}
