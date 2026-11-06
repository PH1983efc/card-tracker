import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await getDb()`SELECT 1`;
    return NextResponse.json({ ok: true, database: true });
  } catch (error) {
    console.error("Health check failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ ok: false, database: false }, { status: 503 });
  }
}
