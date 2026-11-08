import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  try {
    const { itemId } = await context.params;
    if (!/^\d+$/.test(itemId)) return NextResponse.json({ success: false, error: "Invalid order item." }, { status: 400 });
    const body = await request.json() as { quantity?: number; variant?: string };
    if (!Number.isInteger(body.quantity) || (body.quantity ?? 0) < 1 || (body.quantity ?? 0) > 999 ||
        typeof body.variant !== "string" || !body.variant.trim()) {
      return NextResponse.json({ success: false, error: "Confirm a valid quantity and variant." }, { status: 400 });
    }

    const receivedQty = Number(body.quantity);
    const receivedVariant = body.variant.trim();
    const db = getDb();
    await db.begin(async (tx) => {
      const rows = await tx`
        SELECT oi.order_item_id, oi.card_id, oi.quantity, oi.received_quantity
        FROM order_items oi
        WHERE oi.order_item_id = ${itemId}::bigint
        FOR UPDATE
      `;
      if (!rows.length) throw new Error("Order item not found.");
      const item = rows[0];
      if (!item.card_id) throw new Error("This order item is not linked to a collection card.");
      const remaining = Number(item.quantity) - Number(item.received_quantity);
      if (receivedQty > remaining) throw new Error(`Only ${remaining} remaining on this order item.`);

      await tx`
        INSERT INTO card_ownership (card_id, variant, quantity)
        VALUES (${item.card_id}, ${receivedVariant}, ${receivedQty})
        ON CONFLICT (card_id, variant)
        DO UPDATE SET quantity = card_ownership.quantity + EXCLUDED.quantity, updated_at = now()
      `;
      const receivedQuantity = Number(item.received_quantity) + receivedQty;
      await tx`
        UPDATE order_items
        SET received_quantity = ${receivedQuantity},
            received_variant = ${receivedVariant},
            received = (${receivedQuantity} >= quantity)
        WHERE order_item_id = ${itemId}::bigint
      `;
      await tx`UPDATE cards SET got = true, updated_at = now() WHERE card_id = ${item.card_id}`;
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Order receipt failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to record receipt." }, { status: 400 });
  }
}
