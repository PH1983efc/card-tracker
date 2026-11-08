import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const collectionNames: Record<string, string> = {
  master: "Everton Cards",
  donruss: "Donruss",
  "topps-now": "Topps Now",
  "extra-collections": "Extra Collections",
};

export async function GET() {
  try {
    const db = getDb();
    const [orders, cards] = await Promise.all([
      db`
        SELECT
          o.order_record_id::text AS "orderId",
          o.seller,
          o.order_date AS "orderDate",
          o.price,
          o.created_at AS "createdAt",
          COALESCE(json_agg(json_build_object(
            'itemId', oi.order_item_id::text,
            'cardId', c.card_id::text,
            'sourceCardId', c.source_card_id,
            'collection', c.collection_key,
            'collectionName', CASE c.collection_key
              WHEN 'master' THEN 'Everton Cards'
              WHEN 'donruss' THEN 'Donruss'
              WHEN 'topps-now' THEN 'Topps Now'
              WHEN 'extra-collections' THEN 'Extra Collections'
              ELSE c.collection_key END,
            'playerName', c.player_name,
            'cardNo', c.card_no,
            'cardSet', c.card_set,
            'quantity', oi.quantity,
            'receivedQuantity', oi.received_quantity,
            'receivedVariant', oi.received_variant,
            'received', oi.received
          ) ORDER BY oi.item_position) FILTER (WHERE oi.order_item_id IS NOT NULL), '[]'::json) AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_record_id = o.order_record_id
        LEFT JOIN cards c ON c.card_id = oi.card_id
        GROUP BY o.order_record_id
        ORDER BY o.created_at DESC, o.order_record_id DESC
      `,
      db`
        SELECT
          c.card_id::text AS "databaseId",
          COALESCE(c.source_card_id, '') AS "sourceCardId",
          c.collection_key AS collection,
          CASE c.collection_key
            WHEN 'master' THEN 'Everton Cards'
            WHEN 'donruss' THEN 'Donruss'
            WHEN 'topps-now' THEN 'Topps Now'
            WHEN 'extra-collections' THEN 'Extra Collections'
            ELSE c.collection_key END AS "collectionName",
          COALESCE(c.year, '') AS year,
          COALESCE(c.card_set, '') AS "cardSet",
          COALESCE(c.card_no, '') AS "cardNo",
          COALESCE(c.player_name, '') AS "playerName",
          COALESCE(c.card_description, '') AS "cardDescription",
          COALESCE(c.variant, 'Base') AS variant,
          COALESCE(c.got, false) AS got
        FROM cards c
        ORDER BY c.collection_key, c.source_row_number, c.card_id
      `
    ]);
    return NextResponse.json({ success: true, orders, cards, collections: Object.entries(collectionNames).map(([key, name]) => ({ key, name })) });
  } catch (error) {
    console.error("Orders read failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ success: false, error: "Unable to load orders." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      seller?: string; orderDate?: string; price?: string;
      items?: { cardId: string; quantity: number }[];
    };
    if (!Array.isArray(body.items) || body.items.length === 0 ||
        body.items.some((item) => !/^\d+$/.test(item.cardId) || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 999)) {
      return NextResponse.json({ success: false, error: "Add at least one valid card and quantity." }, { status: 400 });
    }
    const db = getDb();
    const result = await db.begin(async (tx) => {
      const cardIds = body.items!.map((item) => item.cardId);
      const found = await tx`
        SELECT card_id::text AS id FROM cards WHERE card_id = ANY(${cardIds}::bigint[])
      `;
      if (found.length !== cardIds.length) throw new Error("One or more selected cards could not be found.");
      const [order] = await tx`
        INSERT INTO orders (seller, order_date, price, source_payload)
        VALUES (${body.seller?.trim() || null}, ${body.orderDate || null}, ${body.price?.trim() || null},
          ${tx.json({ source: "website", itemCount: body.items!.length })})
        RETURNING order_record_id::text AS id
      `;
      for (let i = 0; i < body.items!.length; i++) {
        const item = body.items![i];
        const [card] = await tx`SELECT source_card_id FROM cards WHERE card_id = ${item.cardId}::bigint`;
        await tx`
          INSERT INTO order_items (order_record_id, item_position, source_card_id, card_id, quantity, received_quantity, received)
          VALUES (${order.id}::bigint, ${i}, ${card.source_card_id}, ${item.cardId}::bigint, ${item.quantity}, 0, false)
        `;
      }
      return order;
    });
    return NextResponse.json({ success: true, orderId: result.id });
  } catch (error) {
    console.error("Order create failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create order." }, { status: 400 });
  }
}
