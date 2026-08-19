import { NextRequest, NextResponse } from "next/server";
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
