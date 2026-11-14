import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTIONS = {
  master: { tab: "Master", label: "Everton Cards" },
  donruss: { tab: "Donruss", label: "Donruss" },
  "topps-now": { tab: "Topps Now", label: "Topps Now" },
  "extra-collections": { tab: "Extra Collections", label: "Extra Collections" },
} as const;

type CollectionKey = keyof typeof COLLECTIONS;
type ImportRow = {
  year?: unknown; cardSet?: unknown; cardNo?: unknown; playerName?: unknown;
  cardDescription?: unknown; variant?: unknown; collecting?: unknown; got?: unknown;
  imageUrl?: unknown; team?: unknown; printRun?: unknown; sourceCardId?: unknown;
};

function clean(value: unknown) {
  return value == null ? "" : String(value).trim();
}
function boolValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  const v = clean(value).toLowerCase();
  if (["true","yes","1","y"].includes(v)) return true;
  if (["false","no","0","n"].includes(v)) return false;
  return fallback;
}
function signature(row: any) {
  return [row.collection, row.year, row.cardSet, row.cardNo, row.playerName, row.variant || "Base"]
    .map((v: unknown) => clean(v).toLowerCase()).join("|");
}
function normalize(input: ImportRow, collection: string) {
  return {
    collection,
    year: clean(input.year),
    cardSet: clean(input.cardSet),
    cardNo: clean(input.cardNo),
    playerName: clean(input.playerName),
    cardDescription: clean(input.cardDescription),
    variant: clean(input.variant) || "Base",
    collecting: boolValue(input.collecting, true),
    got: boolValue(input.got, false),
    imageUrl: clean(input.imageUrl),
    team: clean(input.team),
    printRun: clean(input.printRun),
    sourceCardId: clean(input.sourceCardId),
  };
}

async function inspectRows(db: ReturnType<typeof getDb>, rows: any[]) {
  const keys = [...new Set(rows.map((r) => r.collection))];
  const existing = await db`
    SELECT collection_key AS collection, COALESCE(year,'') AS year,
      COALESCE(card_set,'') AS "cardSet", COALESCE(card_no,'') AS "cardNo",
      COALESCE(player_name,'') AS "playerName", COALESCE(variant,'Base') AS variant
    FROM cards WHERE collection_key = ANY(${keys}::text[])
  `;
  const known = new Set(existing.map((r: any) => signature(r)));
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const missing = ["year","cardSet","cardNo","playerName"].filter((key) => !row[key]);
    const key = signature(row);
    const duplicateInFile = seen.has(key);
    const duplicateInDatabase = known.has(key);
    seen.add(key);
    return { row: index + 1, missing, duplicateInFile, duplicateInDatabase, valid: missing.length === 0 && !duplicateInFile && !duplicateInDatabase };
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; collection?: string; rows?: ImportRow[] };
    if (!body.collection || !(body.collection in COLLECTIONS)) {
      return NextResponse.json({ success: false, error: "Choose a valid collection." }, { status: 400 });
    }
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 5000) {
      return NextResponse.json({ success: false, error: "Provide between 1 and 5,000 card rows." }, { status: 400 });
    }
    const collection = body.collection as CollectionKey;
    const rows = body.rows.map((r) => normalize(r, collection));
    const db = getDb();

    if (body.action !== "import") {
      const checks = await inspectRows(db, rows);
      return NextResponse.json({
        success: true, checks,
        summary: {
          total: rows.length,
          ready: checks.filter((c) => c.valid).length,
          duplicates: checks.filter((c) => c.duplicateInFile || c.duplicateInDatabase).length,
          incomplete: checks.filter((c) => c.missing.length > 0).length,
        },
      });
    }

    const result = await db.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext('everton-card-tracker-card-import'))`;
      const checks = await inspectRows(tx as unknown as ReturnType<typeof getDb>, rows);
      const ready = rows.filter((_, i) => checks[i].valid);
      if (!ready.length) return { inserted: 0, skipped: rows.length, skippedReasons: checks };
      const [snapshot] = await tx`
        INSERT INTO source_snapshots (source_description, source_metadata)
        VALUES (${"Website card import"}, ${tx.json({ collection, rowCount: rows.length, source: "website-import" })})
        RETURNING snapshot_id
      `;
      const tab = COLLECTIONS[collection].tab;
      let inserted = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!checks[i].valid) continue;
        const sourceValues = [
          row.sourceCardId, row.year, row.cardSet, row.cardNo, row.playerName,
          row.cardDescription, row.variant, row.collecting, row.got, row.imageUrl, row.team, row.printRun,
        ];
        const [archive] = await tx`
          INSERT INTO source_archive
            (snapshot_id, source_tab, source_row_number, row_kind, raw_values, processing_status)
          VALUES
            (${snapshot.snapshot_id}, ${tab}, ${i + 1}, 'data', ${tx.json(sourceValues)}, 'imported')
          RETURNING archive_row_id
        `;
        await tx`
          INSERT INTO cards
            (collection_key, source_archive_row_id, source_row_number, source_card_id,
             year, card_set, card_no, player_name, card_description, variant,
             collecting, got, image_url, team, print_run, source_fields)
          VALUES
            (${collection}, ${archive.archive_row_id}, ${i + 1},
             ${row.sourceCardId || null}, ${row.year}, ${row.cardSet}, ${row.cardNo},
             ${row.playerName}, ${row.cardDescription || null}, ${row.variant},
             ${row.collecting}, ${row.got}, ${row.imageUrl || null},
             ${row.team || null}, ${row.printRun || null},
             ${tx.json({ importedVia: "website", sourceCardId: row.sourceCardId })})
        `;
        inserted++;
      }
      return { inserted, skipped: rows.length - inserted, skippedReasons: checks };
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Card import failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ success: false, error: "Import failed. No partial changes were saved." }, { status: 503 });
  }
}
