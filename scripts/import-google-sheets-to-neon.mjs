#!/usr/bin/env node
// Explicit transactional import of the approved snapshot. Never reads DATABASE_URL.
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
const TARGET = { projectId: "wispy-water-47339452", branchId: "br-red-violet-awyxzkjv", database: "neondb", schema: "public" };
const FILE = "google-sheets-export-2026-10-29T12-51-45-107Z-684fc25b-4121-4a2c-a57b-8a79870b9f3c.json";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPORT = resolve(ROOT, "..", "..", "outputs", FILE);
const TABS = [
  { name: "Master", rows: 53071, cols: 26, archive: 18583, cards: 18558 },
  { name: "Donruss", rows: 2376, cols: 22, archive: 1952, cards: 1951 },
  { name: "Topps Now", rows: 999, cols: 26, archive: 75, cards: 74 },
  { name: "Extra Collections", rows: 998, cols: 24, archive: 130, cards: 128 },
  { name: "Orders", rows: 1000, cols: 26, archive: 3, cards: 0 },
];
const HEADERS = {
  Master: ["Card ID", "Year", "Card Set", "Card No.", "Player Name", "Card Description", "Variant", "Collecting", "Got", "Image URL"],
  Donruss: ["Card ID", "Year", "Card No.", "Player ", "Team", "Card", "Got", "Image URL"],
  "Topps Now": ["Card ID", "Year", "Card Set", "Card No.", "Player Name", "Print Run", "Variant", "Date & Description", "Collecting", "Got", "Image"],
  "Extra Collections": ["Card ID", "Year", "Card Set", "Card No.", "Player Name", "Variant", "Collecting", "Got", "Image"],
  Orders: ["data"],
};
const MAP = {
  Master: { key: "master", fields: { source_card_id: 0, year: 1, card_set: 2, card_no: 3, player_name: 4, card_description: 5, variant: 6, collecting: 7, got: 8, image_url: 9 } },
  Donruss: { key: "donruss", fields: { source_card_id: 0, year: 1, card_no: 2, player_name: 3, team: 4, variant: 5, got: 6, image_url: 7 } },
  "Topps Now": { key: "topps-now", fields: { source_card_id: 0, year: 1, card_set: 2, card_no: 3, player_name: 4, print_run: 5, variant: 6, card_description: 7, collecting: 8, got: 9, image_url: 10 } },
  "Extra Collections": { key: "extra-collections", fields: { source_card_id: 0, year: 1, card_set: 2, card_no: 3, player_name: 4, variant: 5, collecting: 6, got: 7, image_url: 8 } },
};
const COLLECTIONS = Object.entries(MAP).map(([name, m]) => ({ key: m.key, display_name: name }));
const EXPECTED_ERRORS = ["Master!B16383", "Master!R16383", "Master!E17234", "Master!E17305", "Master!E17306", "Master!E18345", "Master!E18346", "Master!E18347", "Master!E18410"];
const EXPECTED = { archive: 20743, cards: 20711, orders: 2, items: 12, received: 7, formulas: 16104, formulaOnly: 24, errors: 9, internalBlanks: 1, trailingBlanks: 37701, duplicateGroups: 1951, duplicateExcess: 2025 };
const STATUS_EXPECTATIONS = [
  { key: "master", field: "collecting", yes: 2214, no: 16344 },
  { key: "master", field: "got", yes: 1334, no: 17224 },
  { key: "donruss", field: "got", yes: 710, no: 1241 },
  { key: "topps-now", field: "collecting", yes: 14, no: 60 },
  { key: "topps-now", field: "got", yes: 11, no: 63 },
  { key: "extra-collections", field: "collecting", yes: 128, no: 0 },
  { key: "extra-collections", field: "got", yes: 81, no: 47 },
];
const TABLES = ["collections", "source_snapshots", "source_archive", "cards", "orders", "order_items"];
const COLUMNS = {
  collections: ["collection_key", "display_name", "created_at"],
  source_snapshots: ["snapshot_id", "source_description", "captured_at", "source_metadata"],
  source_archive: ["archive_row_id", "snapshot_id", "source_tab", "source_row_number", "row_kind", "raw_values", "raw_cell_data", "raw_payload", "processing_status", "processing_error", "archived_at"],
  cards: ["card_id", "collection_key", "source_archive_row_id", "source_row_number", "source_card_id", "year", "card_set", "card_no", "player_name", "card_description", "variant", "collecting", "got", "image_url", "team", "print_run", "source_fields", "created_at", "updated_at"],
  orders: ["order_record_id", "source_archive_row_id", "source_order_id", "seller", "order_date", "price", "source_payload", "source_payload_text", "created_at", "updated_at"],
  order_items: ["order_item_id", "order_record_id", "source_item_id", "item_position", "source_card_id", "card_id", "received", "source_received_value", "source_fields"],
};
class StopError extends Error {}
function check(ok, message = "Saved export or target does not match the approved manifest.") { if (!ok) throw new StopError(message); }
function colName(n) { let s = ""; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; }
const entered = (c) => c && c.userEnteredValue !== undefined ? c.userEnteredValue : null;
const formula = (c) => typeof c?.userEnteredValue?.formulaValue === "string";
const hasCell = (c) => Boolean(entered(c) && Object.keys(entered(c)).length);
const hasRow = (r) => r.cells.some(hasCell);
const formulaOnly = (r) => r.cells.some(formula) && !r.cells.some((c) => hasCell(c) && !formula(c));
function primitive(v) {
  if (typeof v?.stringValue === "string") return v.stringValue;
  if (typeof v?.numberValue === "number") return String(v.numberValue);
  if (typeof v?.boolValue === "boolean") return String(v.boolValue);
  return null;
}
function cellText(c) { return primitive(entered(c)); }
function isBool(c) { return typeof entered(c)?.boolValue === "boolean" ? entered(c).boolValue : null; }
function candidate(tab, row) { return Boolean(MAP[tab] && Object.values(MAP[tab].fields).some((i) => hasCell(row.cells[i]) && !formula(row.cells[i]))); }
function errorCoords(tab) {
  return tab.rows.flatMap((r) => r.cells.flatMap((c, i) => c?.effectiveValue?.errorValue ? [tab.title + "!" + colName(i) + r.rowNumber] : []));
}
function parseOrder(raw, rowNo) {
  let o;
  try { o = JSON.parse(raw); } catch { throw new StopError("Orders!A" + rowNo + " is not valid JSON."); }
  check(o && typeof o === "object" && !Array.isArray(o) && typeof o.id === "string", "Orders!A" + rowNo + " has an invalid order shape.");
  check(Array.isArray(o.cardIds) && o.cardIds.every((x) => typeof x === "string"), "Orders!A" + rowNo + " has invalid card IDs.");
  check(Array.isArray(o.received) && o.received.every((x) => typeof x === "string"), "Orders!A" + rowNo + " has invalid received IDs.");
  check(new Set(o.cardIds).size === o.cardIds.length, "Orders!A" + rowNo + " repeats an ID; received membership cannot identify a specific item.");
  check(o.received.every((x) => o.cardIds.includes(x)), "Orders!A" + rowNo + " has a received ID absent from cardIds.");
  return o;
}
const sourceKey = (tab, row) => tab + "\0" + row;
function canonicalJson(value) {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonicalJson(value[key])).join(",") + "}";
  return JSON.stringify(value);
}
function normalized(tabName, row) {
  const m = MAP[tabName], f = { card_description: null, team: null, print_run: null };
  for (const [name, i] of Object.entries(m.fields)) {
    if (["collecting", "got"].includes(name)) {
      const value = isBool(row.cells[i]);
      check(typeof value === "boolean", "Missing or non-boolean " + name + " value at " + tabName + "!" + colName(i) + row.rowNumber + ".");
      f[name] = value;
    } else f[name] = cellText(row.cells[i]);
  }
  if (tabName === "Donruss") { f.collecting = null; f.card_set = "Donruss International"; f.variant = cellText(row.cells[5]) || "Base"; }
  else if (Object.hasOwn(f, "variant")) f.variant ||= "Base";
  return f;
}
function prepare(data) {
  check(data?.exportFormat === "google-sheets-grid-v1" && Array.isArray(data.tabs) && data.tabs.length === 5);
  check(typeof data.exportedAt === "string" && Number.isFinite(Date.parse(data.exportedAt)));
  const tabs = new Map(data.tabs.map((t) => [t.title, t]));
  check(tabs.size === 5);
  const archive = [], cards = [], orders = [], counts = {}, errors = [];
  let formulas = 0, formulaOnlyRows = 0, internalBlanks = 0, trailingBlanks = 0;
  for (const e of TABS) {
    const t = tabs.get(e.name);
    check(t && t.rowCount === e.rows && t.columnCount === e.cols && Array.isArray(t.rows) && t.rows.length === e.rows, "Grid dimensions differ for " + e.name + ".");
    check(t.rows.every((r, i) => r?.rowNumber === i + 1 && Array.isArray(r.cells) && r.cells.length === e.cols), "Row positions differ for " + e.name + ".");
    HEADERS[e.name].forEach((h, i) => check(t.rows[0].cells[i]?.userEnteredValue?.stringValue === h, "Header mismatch at " + e.name + "!" + colName(i) + "1."));
    let last = 1;
    for (let i = t.rows.length - 1; i > 0; i--) if (hasRow(t.rows[i])) { last = i + 1; break; }
    check(last === e.archive, "Archive boundary differs for " + e.name + ".");
    let cardCount = 0, onlyCount = 0, blankCount = 0;
    errors.push(...errorCoords(t));
    for (let i = 0; i < last; i++) {
      const r = t.rows[i], header = i === 0, blank = !header && !hasRow(r) && !r.cells.some(formula), isCard = !header && candidate(e.name, r);
      if (blank) { blankCount++; internalBlanks++; }
      if (formulaOnly(r)) { onlyCount++; formulaOnlyRows++; }
      const rawOrder = e.name === "Orders" && i > 0 ? primitive(entered(r.cells[0])) : null;
      const parsed = rawOrder === null ? null : parseOrder(rawOrder, r.rowNumber);
      const reasons = [];
      if (header) reasons.push("header_row");
      if (blank) reasons.push("internal_blank_row");
      if (formulaOnly(r)) reasons.push("formula_only_row");
      if (r.cells.some((c) => Boolean(c?.effectiveValue?.errorValue))) reasons.push("spreadsheet_error_present");
      archive.push({
        source_tab: e.name, source_row_number: r.rowNumber,
        row_kind: header ? "header" : blank ? "blank" : (hasRow(r) || r.cells.some(formula)) ? "data" : "other",
        raw_values: r.cells.map(entered), raw_cell_data: r.cells.map((c) => c ?? null),
        raw_payload: rawOrder,
        processing_status: header || blank || formulaOnly(r) ? "unmapped" : "imported",
        processing_error: reasons.length ? reasons.join(";") : null,
      });
      if (isCard) {
        cardCount++;
        cards.push({
          collection_key: MAP[e.name].key, source_tab: e.name, source_row_number: r.rowNumber,
          ...normalized(e.name, r),
          source_fields: Object.fromEntries(r.cells.map((c, j) => [colName(j), entered(c)])),
        });
      }
      if (parsed) orders.push({
        source_tab: e.name, source_row_number: r.rowNumber, source_order_id: parsed.id,
        seller: typeof parsed.seller === "string" ? parsed.seller : null,
        order_date: typeof parsed.date === "string" ? parsed.date : null,
        price: typeof parsed.price === "string" ? parsed.price : null,
        source_payload: parsed, source_payload_text: rawOrder,
        items: parsed.cardIds.map((id, pos) => ({
          item_position: pos, source_card_id: id, received: parsed.received.includes(id),
          source_received_value: parsed.received.includes(id) ? id : null,
        })),
      });
    }
    const formulaCells = t.rows.flatMap((r) => r.cells.flatMap((c, i) => formula(c) ? [i] : []));
    formulas += formulaCells.length;
    const formulaCols = [...new Set(formulaCells)].sort((a, b) => a - b);
    const expectedCols = e.name === "Master" ? [17] : e.name === "Extra Collections" ? [8] : [];
    check(JSON.stringify(formulaCols) === JSON.stringify(expectedCols), "Formula columns differ for " + e.name + ".");
    check(cardCount === e.cards && blankCount === (e.name === "Extra Collections" ? 1 : 0) && onlyCount === (e.name === "Master" ? 24 : 0), "Row classification differs for " + e.name + ".");
    if (e.name === "Master") check(formulaCells.length === 16004);
    if (e.name === "Extra Collections") check(formulaCells.length === 100);
    if (!["Master", "Extra Collections"].includes(e.name)) check(formulaCells.length === 0);
    counts[e.name] = { archive: last, cards: cardCount };
    trailingBlanks += e.rows - last;
  }
  check(archive.length === EXPECTED.archive && cards.length === EXPECTED.cards && orders.length === EXPECTED.orders);
  check(formulas === EXPECTED.formulas && formulaOnlyRows === EXPECTED.formulaOnly && internalBlanks === EXPECTED.internalBlanks && trailingBlanks === EXPECTED.trailingBlanks);
  check(JSON.stringify(errors.sort()) === JSON.stringify([...EXPECTED_ERRORS].sort()), "Spreadsheet error coordinates differ from the approved snapshot.");
  check(archive.some((r) => r.source_tab === "Extra Collections" && r.source_row_number === 22 && r.row_kind === "blank"));
  const idMap = new Map(), collectionCounts = new Map(), idsByCollection = new Map();
  let missingSourceIds = 0;
  for (const c of cards) {
    collectionCounts.set(c.collection_key, (collectionCounts.get(c.collection_key) || 0) + 1);
    if (!idsByCollection.has(c.collection_key)) idsByCollection.set(c.collection_key, new Map());
    if (c.source_card_id === null || c.source_card_id === "") { missingSourceIds++; continue; }
    if (!idMap.has(c.source_card_id)) idMap.set(c.source_card_id, []);
    idMap.get(c.source_card_id).push(c);
    const localIds = idsByCollection.get(c.collection_key);
    localIds.set(c.source_card_id, (localIds.get(c.source_card_id) || 0) + 1);
  }
  check(missingSourceIds === 0, "Missing original card ID count differs from the manifest.");
  for (const m of Object.values(MAP)) {
    const duplicateGroups = [...(idsByCollection.get(m.key)?.values() || [])].filter((count) => count > 1).length;
    check(duplicateGroups === 0, "Duplicate source card IDs within collection " + m.key + " differ from the manifest.");
  }
  for (const [tab, m] of Object.entries(MAP)) check(collectionCounts.get(m.key) === TABS.find((t) => t.name === tab).cards);
  const groups = [...idMap.values()].filter((x) => new Set(x.map((c) => c.collection_key)).size > 1);
  const excess = groups.reduce((n, x) => n + x.length - 1, 0);
  check(groups.length === EXPECTED.duplicateGroups && excess === EXPECTED.duplicateExcess, "Cross-collection duplicate baseline differs.");
  let itemCount = 0, receivedCount = 0, uniqueLinks = 0;
  for (const o of orders) for (const item of o.items) {
    itemCount++; if (item.received) receivedCount++;
    const matches = idMap.get(item.source_card_id) || [];
    item.card = matches.length === 1 ? matches[0] : null;
    item.match = matches.length === 1 ? "unique" : matches.length === 0 ? "unmatched" : "ambiguous";
    if (item.match === "unique") uniqueLinks++;
  }
  check(itemCount === EXPECTED.items && receivedCount === EXPECTED.received && uniqueLinks === EXPECTED.items, "Order matching or status baseline differs.");
  for (const expected of STATUS_EXPECTATIONS) {
    const rows = cards.filter((card) => card.collection_key === expected.key);
    const values = rows.map((card) => card[expected.field]);
    const yes = values.filter((value) => value === true).length;
    const no = values.filter((value) => value === false).length;
    check(values.length === expected.yes + expected.no && yes === expected.yes && no === expected.no, "Source status counts differ for " + expected.key + " " + expected.field + ".");
  }
  return { data, archive, cards, orders, counts };
}
async function insertBatch(client, table, columns, rows, valueFor, returning) {
  const inserted = [];
  for (let start = 0; start < rows.length; start += 100) {
    const args = [], tuples = rows.slice(start, start + 100).map((row) => "(" + columns.map((column) => {
      args.push(valueFor(row, column));
      return ["raw_values", "raw_cell_data", "source_fields"].includes(column) ? "$" + args.length + "::jsonb" : "$" + args.length;
    }).join(",") + ")");
    const result = await client.query("INSERT INTO public." + table + " (" + columns.join(",") + ") VALUES " + tuples.join(",") + " RETURNING " + returning, args);
    inserted.push(...result.rows);
  }
  return inserted;
}
async function verifySchema(client) {
  const definitions = {
    collections: [["collection_key","text","NO"],["display_name","text","NO"],["created_at","timestamp with time zone","NO"]],
    source_snapshots: [["snapshot_id","bigint","NO","ALWAYS"],["source_description","text","NO"],["captured_at","timestamp with time zone","NO"],["source_metadata","jsonb","NO"]],
    source_archive: [["archive_row_id","bigint","NO","ALWAYS"],["snapshot_id","bigint","NO"],["source_tab","text","NO"],["source_row_number","integer","NO"],["row_kind","text","NO"],["raw_values","jsonb","NO"],["raw_cell_data","jsonb","NO"],["raw_payload","text","YES"],["processing_status","text","NO"],["processing_error","text","YES"],["archived_at","timestamp with time zone","NO"]],
    cards: [["card_id","bigint","NO","ALWAYS"],["collection_key","text","NO"],["source_archive_row_id","bigint","NO"],["source_row_number","integer","NO"],["source_card_id","text","YES"],["year","text","YES"],["card_set","text","YES"],["card_no","text","YES"],["player_name","text","YES"],["card_description","text","YES"],["variant","text","YES"],["collecting","boolean","YES"],["got","boolean","YES"],["image_url","text","YES"],["team","text","YES"],["print_run","text","YES"],["source_fields","jsonb","NO"],["created_at","timestamp with time zone","NO"],["updated_at","timestamp with time zone","NO"]],
    orders: [["order_record_id","bigint","NO","ALWAYS"],["source_archive_row_id","bigint","NO"],["source_order_id","text","YES"],["seller","text","YES"],["order_date","text","YES"],["price","text","YES"],["source_payload","jsonb","NO"],["source_payload_text","text","YES"],["created_at","timestamp with time zone","NO"],["updated_at","timestamp with time zone","NO"]],
    order_items: [["order_item_id","bigint","NO","ALWAYS"],["order_record_id","bigint","NO"],["source_item_id","text","YES"],["item_position","integer","NO"],["source_card_id","text","YES"],["card_id","bigint","YES"],["received","boolean","YES"],["source_received_value","jsonb","YES"],["source_fields","jsonb","NO"]],
  };
  const expectedDefaults = {
    "collections.created_at": "now()",
    "source_snapshots.captured_at": "now()",
    "source_snapshots.source_metadata": "'{}'::jsonb",
    "source_archive.row_kind": "'data'::text",
    "source_archive.raw_cell_data": "'[]'::jsonb",
    "source_archive.processing_status": "'pending'::text",
    "source_archive.archived_at": "now()",
    "cards.source_fields": "'{}'::jsonb",
    "cards.created_at": "now()",
    "cards.updated_at": "now()",
    "orders.created_at": "now()",
    "orders.updated_at": "now()",
    "order_items.source_fields": "'{}'::jsonb",
  };
  const cols = await client.query("SELECT table_name,column_name,data_type,is_nullable,is_identity,identity_generation,column_default FROM information_schema.columns WHERE table_schema=$1 AND table_name=ANY($2::text[])", [TARGET.schema, TABLES]);
  const actualCols = new Map(cols.rows.map((c) => [c.table_name + "." + c.column_name, c]));
  const expectedColNames = new Set();
  for (const [table, fields] of Object.entries(definitions)) {
    for (const [name, type, nullable, identity] of fields) {
      const key = table + "." + name, actual = actualCols.get(key);
      expectedColNames.add(key);
      check(actual && actual.data_type === type && actual.is_nullable === nullable, "Schema type/nullability mismatch at " + key + ".");
      check(identity ? actual.is_identity === "YES" && actual.identity_generation === identity && actual.column_default === null : actual.is_identity === "NO", "Schema identity-generation/default mismatch at " + key + ".");
      if (!identity) {
        if (Object.hasOwn(expectedDefaults, key)) {
          check(actual.column_default !== null, "Required column default is missing at " + key + ".");
          check(normalizeSqlExpression(actual.column_default) === normalizeSqlExpression(expectedDefaults[key]), "Column default differs from the migration at " + key + ".");
        } else check(actual.column_default === null, "Unexpected column default at " + key + ".");
      }
    }
  }
  check(actualColNamesEqual(actualCols, expectedColNames), "Target tables have missing or unexpected columns.");
  const expectedConstraints = [
    ["collections","p","collections_pkey","collection_key"],
    ["source_snapshots","p","source_snapshots_pkey","snapshot_id"],
    ["source_snapshots","c","source_snapshots_metadata_is_object","","","","jsonb_typeof(source_metadata) = 'object'"],
    ["source_archive","p","source_archive_pkey","archive_row_id"],
    ["source_archive","f","source_archive_snapshot_id_fkey","snapshot_id","source_snapshots","snapshot_id","","a"],
    ["source_archive","u","source_archive_snapshot_tab_row_unique","snapshot_id,source_tab,source_row_number"],
    ["source_archive","c","source_archive_source_row_number_check","","","","source_row_number > 0"],
    ["source_archive","c","source_archive_tab_is_known","","","","source_tab = ANY (ARRAY['Master', 'Donruss', 'Topps Now', 'Extra Collections', 'Orders'])"],
    ["source_archive","c","source_archive_row_kind_is_known","","","","row_kind = ANY (ARRAY['header', 'data', 'blank', 'other'])"],
    ["source_archive","c","source_archive_status_is_known","","","","processing_status = ANY (ARRAY['pending', 'imported', 'unmapped', 'malformed', 'reviewed'])"],
    ["source_archive","c","source_archive_raw_values_is_array","","","","jsonb_typeof(raw_values) = 'array'"],
    ["source_archive","c","source_archive_raw_cell_data_is_array","","","","jsonb_typeof(raw_cell_data) = 'array'"],
    ["cards","p","cards_pkey","card_id"],
    ["cards","f","cards_collection_key_fkey","collection_key","collections","collection_key","","a"],
    ["cards","f","cards_source_archive_row_id_fkey","source_archive_row_id","source_archive","archive_row_id","","a"],
    ["cards","u","cards_source_archive_row_id_key","source_archive_row_id"],
    ["cards","c","cards_source_row_number_check","","","","source_row_number > 0"],
    ["cards","c","cards_source_fields_is_object","","","","jsonb_typeof(source_fields) = 'object'"],
    ["orders","p","orders_pkey","order_record_id"],
    ["orders","f","orders_source_archive_row_id_fkey","source_archive_row_id","source_archive","archive_row_id","","a"],
    ["orders","u","orders_source_archive_row_id_key","source_archive_row_id"],
    ["orders","c","orders_source_payload_is_object","","","","jsonb_typeof(source_payload) = 'object'"],
    ["order_items","p","order_items_pkey","order_item_id"],
    ["order_items","f","order_items_order_record_id_fkey","order_record_id","orders","order_record_id","","c"],
    ["order_items","f","order_items_card_id_fkey","card_id","cards","card_id","","r"],
    ["order_items","u","order_items_position_unique","order_record_id,item_position"],
    ["order_items","c","order_items_item_position_check","","","","item_position >= 0"],
    ["order_items","c","order_items_source_fields_is_object","","","","jsonb_typeof(source_fields) = 'object'"],
  ];
  const actualConstraints = await client.query(`SELECT rel.relname AS table_name,con.contype,con.conname,
    ARRAY(SELECT att.attname FROM unnest(con.conkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute att ON att.attrelid=rel.oid AND att.attnum=k.attnum ORDER BY k.ord) AS columns,
    ref.relname AS ref_table,
    ARRAY(SELECT att.attname FROM unnest(con.confkey) WITH ORDINALITY k(attnum,ord) JOIN pg_attribute att ON att.attrelid=ref.oid AND att.attnum=k.attnum ORDER BY k.ord) AS ref_columns,
    con.confdeltype::text AS delete_action,con.confupdtype::text AS update_action,con.condeferrable,con.condeferred,con.convalidated,pg_get_constraintdef(con.oid,true) AS definition
    FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid JOIN pg_namespace ns ON ns.oid=rel.relnamespace
    LEFT JOIN pg_class ref ON ref.oid=con.confrelid WHERE ns.nspname=$1 AND rel.relname=ANY($2::text[])`, [TARGET.schema,TABLES]);
  const declaredConstraintTypes = new Set(["p", "f", "u", "c"]);
  const unsupportedConstraints = actualConstraints.rows.filter((constraint) =>
    !declaredConstraintTypes.has(constraint.contype) && constraint.contype !== "n");
  check(unsupportedConstraints.length === 0, "Target contains unexpected constraint types: " + [...new Set(unsupportedConstraints.map((constraint) => constraint.contype))].join(", ") + ".");
  // PostgreSQL versions that expose NOT NULL entries in pg_constraint report them as
  // contype 'n'. Column nullability has already been checked against the migration above.
  const declaredConstraints = actualConstraints.rows.filter((constraint) => declaredConstraintTypes.has(constraint.contype));
  check(declaredConstraints.length === expectedConstraints.length, "Target declared constraint count differs from the migration.");
  function normalizeSqlExpression(expression, { checkConstraint = false, stripLiteralTextCasts = false } = {}) {
    const source = String(expression || "").replace(checkConstraint ? /^CHECK\s*/i : /$^/, "");
    const tokenPattern = /'(?:''|[^'])*'|"(?:""|[^"])*"|::|<=|>=|<>|!=|[A-Za-z_][A-Za-z_0-9$]*|\d+(?:\.\d+)?|[(),\[\]=<>+*/.-]/y;
    const tokens = [];
    let offset = 0;
    while (offset < source.length) {
      if (/\s/.test(source[offset])) { offset++; continue; }
      tokenPattern.lastIndex = offset;
      const match = tokenPattern.exec(source);
      if (!match) throw new StopError("Cannot safely normalize a schema expression; refusing import.");
      tokens.push(match[0]);
      offset = tokenPattern.lastIndex;
    }
    // pg_get_constraintdef may add a harmless cast to text literals.
    const withoutLiteralTextCasts = [];
    for (let i = 0; i < tokens.length; i++) {
      if (stripLiteralTextCasts && tokens[i] === "::" && i > 0 && tokens[i + 1]?.toLowerCase() === "text" && /^'(?:''|[^'])*'$/.test(tokens[i - 1])) { i++; continue; }
      const token = tokens[i];
      withoutLiteralTextCasts.push(token.startsWith("'") || token.startsWith('"') ? token : /^[A-Za-z_]/.test(token) ? token.toLowerCase() : token);
    }
    const stripOuterParens = (list) => {
      while (list[0] === "(" && list[list.length - 1] === ")") {
        let depth = 0, wrapsWholeExpression = true;
        for (let i = 0; i < list.length; i++) {
          if (list[i] === "(") depth++;
          else if (list[i] === ")") depth--;
          if (depth === 0 && i < list.length - 1) { wrapsWholeExpression = false; break; }
          if (depth < 0) throw new StopError("Malformed schema CHECK expression; refusing import.");
        }
        if (!wrapsWholeExpression || depth !== 0) break;
        list = list.slice(1, -1);
      }
      return list;
    };
    return stripOuterParens(withoutLiteralTextCasts).join(" ");
  }
  for (const [table,type,name,local,refTable,refCols,checkExpr,deleteAction] of expectedConstraints) {
    const actual = actualConstraints.rows.find((c) => c.table_name === table && c.conname === name);
    check(actual && actual.contype === type && actual.condeferrable === false && actual.condeferred === false && actual.convalidated === true, "Missing or mismatched constraint attributes for " + table + "." + name + ".");
    if (["p","u","f"].includes(type)) check(actual.columns.join(",") === local, "Constraint columns differ for " + name + ".");
    if (type === "f") check(actual.ref_table === refTable && actual.ref_columns.join(",") === refCols && actual.delete_action === deleteAction && actual.update_action === "a", "Foreign key target/action differs for " + name + ".");
    if (type === "c") check(normalizeSqlExpression(actual.definition, { checkConstraint: true, stripLiteralTextCasts: true }) === normalizeSqlExpression(checkExpr, { stripLiteralTextCasts: true }), "Check expression differs for " + name + ".");
  }
  const expectedIndexes = [
    ["collections_pkey", "collections", true, true, ["collection_key"]],
    ["source_snapshots_pkey", "source_snapshots", true, true, ["snapshot_id"]],
    ["source_archive_pkey", "source_archive", true, true, ["archive_row_id"]],
    ["source_archive_snapshot_tab_row_unique", "source_archive", true, false, ["snapshot_id", "source_tab", "source_row_number"]],
    ["source_archive_status_idx", "source_archive", false, false, ["processing_status", "source_tab"]],
    ["cards_pkey", "cards", true, true, ["card_id"]],
    ["cards_source_archive_row_id_key", "cards", true, false, ["source_archive_row_id"]],
    ["cards_collection_lookup_idx", "cards", false, false, ["collection_key", "source_card_id"]],
    ["orders_pkey", "orders", true, true, ["order_record_id"]],
    ["orders_source_archive_row_id_key", "orders", true, false, ["source_archive_row_id"]],
    ["orders_source_id_idx", "orders", false, false, ["source_order_id"]],
    ["order_items_pkey", "order_items", true, true, ["order_item_id"]],
    ["order_items_position_unique", "order_items", true, false, ["order_record_id", "item_position"]],
    ["order_items_card_lookup_idx", "order_items", false, false, ["card_id"]],
    ["order_items_source_card_id_idx", "order_items", false, false, ["source_card_id"]],
  ];
  const indexes = await client.query(`SELECT idx.relname AS index_name,tab.relname AS table_name,am.amname AS access_method,
    ix.indisunique,ix.indisprimary,ix.indisvalid,ix.indisready,ix.indislive,ix.indisexclusion,ix.indisclustered,ix.indisreplident,
    ix.indnatts,ix.indnkeyatts,(ix.indexprs IS NULL) AS no_expressions,(ix.indpred IS NULL) AS no_predicate,(idx.reloptions IS NULL) AS no_reloptions,(idx.reltablespace=0) AS default_tablespace,
    coalesce((to_jsonb(ix)->>'indnullsnotdistinct')::boolean,false) AS nulls_not_distinct,
    ARRAY(SELECT pg_get_indexdef(ix.indexrelid,k.position,true) FROM generate_series(1,ix.indnkeyatts) AS k(position) ORDER BY k.position) AS key_definitions
    FROM pg_index ix JOIN pg_class idx ON idx.oid=ix.indexrelid JOIN pg_class tab ON tab.oid=ix.indrelid
    JOIN pg_namespace ns ON ns.oid=tab.relnamespace JOIN pg_am am ON am.oid=idx.relam
    WHERE ns.nspname=$1 AND tab.relname=ANY($2::text[]) AND idx.relkind IN ('i','I')`, [TARGET.schema,TABLES]);
  check(indexes.rows.length === expectedIndexes.length, "Target index count differs from the migration.");
  for (const [name,table,unique,primary,columns] of expectedIndexes) {
    const actual = indexes.rows.find((index) => index.index_name === name);
    check(actual && actual.table_name === table && actual.access_method === "btree" && actual.indisunique === unique && actual.indisprimary === primary,
      "Missing or mismatched index identity or type for " + name + ".");
    check(actual.indisvalid && actual.indisready && actual.indislive && !actual.indisexclusion && !actual.indisclustered && !actual.indisreplident && !actual.nulls_not_distinct && actual.no_reloptions && actual.default_tablespace,
      "Index state or options differ for " + name + ".");
    check(actual.no_expressions && actual.no_predicate && actual.indnatts === columns.length && actual.indnkeyatts === columns.length,
      "Index expression, predicate, or included-column definition differs for " + name + ".");
    check(JSON.stringify(actual.key_definitions) === JSON.stringify(columns), "Indexed columns, order, collation, operator class, or sort options differ for " + name + ".");
  }
  const triggerInspection = await client.query(`SELECT count(DISTINCT rel.oid)::int AS inspected_tables,
    count(t.oid) FILTER (WHERE NOT t.tgisinternal)::int AS user_trigger_count
    FROM pg_class rel JOIN pg_namespace ns ON ns.oid=rel.relnamespace
    LEFT JOIN pg_trigger t ON t.tgrelid=rel.oid
    WHERE ns.nspname=$1 AND rel.relname=ANY($2::text[]) AND rel.relkind='r'`, [TARGET.schema,TABLES]);
  check(triggerInspection.rows.length === 1 && Number(triggerInspection.rows[0].inspected_tables) === TABLES.length,
    "Trigger inspection did not cover all six application tables; refusing import.");
  check(Number(triggerInspection.rows[0].user_trigger_count) === 0,
    "Unexpected user-defined trigger found on an application table; refusing import.");
}
function actualColNamesEqual(actualCols, expected) {
  return actualCols.size === expected.size && [...actualCols.keys()].every((name) => expected.has(name));
}
function safeOriginalError(error) {
  const name = typeof error?.name === "string" && /^[A-Za-z]+Error$/.test(error.name) ? error.name : "Error";
  const code = typeof error?.code === "string" && /^[0-9A-Z]{5}$/.test(error.code) ? " code=" + error.code : "";
  let message = typeof error?.message === "string" ? error.message : "No safe message available";
  message = message
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, "[URL redacted]")
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\b(password|token|secret|private[_ -]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]");
  for (const secret of [process.env.NEON_TEST_DATABASE_URL, process.env.NEON_API_KEY]) {
    if (secret) message = message.split(secret).join("[REDACTED]");
  }
  message = message.slice(0, 400);
  return name + code + ": " + message;
}
function parseTestConnectionConfig(connectionString) {
  let parsed;
  try { parsed = new URL(connectionString); } catch { throw new StopError("Testing database URL is invalid."); }
  check(["postgres:", "postgresql:"].includes(parsed.protocol), "Testing database URL must use PostgreSQL.");
  check(parsed.hostname && parsed.hostname.toLowerCase().endsWith(".neon.tech"), "Testing database URL is not a Neon endpoint.");
  check(parsed.hash === "", "Testing database URL must not contain a fragment.");
  check(parsed.port === "" || parsed.port === "5432", "Testing database URL must use the Neon PostgreSQL port.");
  const parameters = [...parsed.searchParams.entries()];
  check(parameters.every(([name]) => ["sslmode", "channel_binding"].includes(name)), "Testing database URL contains an unexpected or conflicting connection parameter.");
  for (const name of ["sslmode", "channel_binding"]) {
    const values = parameters.filter(([parameter]) => parameter === name).map(([, value]) => value.toLowerCase());
    check(values.length <= 1, "Testing database URL contains a duplicate " + name + " parameter.");
    if (name === "sslmode" && values.length) check(["require", "verify-full"].includes(values[0]), "Testing database URL contains an unsafe or unsupported SSL mode.");
    if (name === "channel_binding" && values.length) check(values[0] === "require", "Testing database URL must require SCRAM channel binding.");
  }
  check(decodeURIComponent(parsed.pathname.slice(1)) === TARGET.database, "Connection database does not match the approved target.");
  let user, password;
  try { user = decodeURIComponent(parsed.username); password = decodeURIComponent(parsed.password); }
  catch { throw new StopError("Testing database URL credentials are malformed."); }
  check(user.length > 0 && password.length > 0, "Testing database URL must contain its assigned user and password.");
  return { host: parsed.hostname, port: Number(parsed.port || 5432), database: TARGET.database, username: user, password };
}
function createDatabaseClient(connectionConfig, preflight = false) {
  // The URL is parsed into this allowlisted object before construction. These explicit
  // options override environment defaults: ssl verify-full is sslmode=verify-full, and
  // channel_binding=require prevents SCRAM downgrade.
  const sql = postgres({
    ...connectionConfig,
    ssl: "verify-full",
    channel_binding: "require",
    max: 1,
    max_pipeline: 1,
    connect_timeout: 10,
    connection: {
      application_name: preflight ? "everton-card-tracker-read-only-preflight" : "everton-card-tracker-migration",
      ...(preflight ? { options: "-c default_transaction_read_only=on" } : {}),
    },
  });
  let reserved = null;
  return {
    async connect() {
      check(reserved === null, "Database connection is already open.");
      reserved = await sql.reserve();
    },
    async query(text, values = []) {
      check(reserved !== null, "Database connection is not open.");
      const result = await reserved.unsafe(text, values);
      return { rows: result, command: result.command, rowCount: result.count };
    },
    async end() {
      const connection = reserved;
      reserved = null;
      try {
        if (connection) await connection.release();
      } finally {
        await sql.end({ timeout: 10 });
      }
    },
  };
}
async function runImport(connectionConfig, snapshot) {
  const client = createDatabaseClient(connectionConfig);
  let transaction = false;
  let commitAttempted = false;
  let commitSucceeded = false;
  let importFailure = null;
  try {
    await client.connect();
    const identity = await client.query("SELECT current_database() AS db, current_schema() AS schema");
    check(identity.rows[0]?.db === TARGET.database && identity.rows[0]?.schema === TARGET.schema, "Connected database/schema do not match the approved target.");
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE"); transaction = true;
    const found = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' AND table_name=ANY($2::text[])", [TARGET.schema, TABLES]);
    check(TABLES.every((t) => found.rows.some((r) => r.table_name === t)), "One or more required public tables are missing.");
    await verifySchema(client);
    await client.query("LOCK TABLE public.collections, public.source_snapshots, public.source_archive, public.cards, public.orders, public.order_items IN SHARE ROW EXCLUSIVE MODE");
    const before = {};
    for (const table of TABLES) {
      const r = await client.query("SELECT count(*)::bigint AS n FROM public." + table);
      before[table] = Number(r.rows[0].n);
    }
    const dirty = Object.entries(before).filter(([, n]) => n !== 0);
    check(dirty.length === 0, "Refusing import; target tables already contain rows: " + dirty.map(([t, n]) => t + "=" + n).join(", ") + ".");

    const seeds = COLLECTIONS.flatMap((c) => [c.key, c.display_name]);
    await client.query("INSERT INTO public.collections (collection_key,display_name) VALUES ($1,$2),($3,$4),($5,$6),($7,$8)", seeds);
    const metadata = { export_format: snapshot.data.exportFormat, export_filename: FILE, exported_at: snapshot.data.exportedAt, spreadsheet_title: snapshot.data.sourceSpreadsheetTitle ?? null, captured_tabs: TABS.map(({ name, rows, cols }) => ({ name, rows, columns: cols })), trailing_blank_policy: "omitted from database archive; retained in unchanged export" };
    const s = await client.query("INSERT INTO public.source_snapshots (source_description,source_metadata) VALUES ($1,$2::jsonb) RETURNING snapshot_id", ["Saved export " + FILE, metadata]);
    const snapshotId = s.rows[0].snapshot_id;
    const archiveRows = await insertBatch(client, "source_archive",
      ["snapshot_id", "source_tab", "source_row_number", "row_kind", "raw_values", "raw_cell_data", "raw_payload", "processing_status", "processing_error"],
      snapshot.archive, (r, c) => ({ snapshot_id: snapshotId, ...r, raw_values: r.raw_values, raw_cell_data: r.raw_cell_data })[c],
      "archive_row_id,source_tab,source_row_number");
    const archiveIds = new Map(archiveRows.map((r) => [sourceKey(r.source_tab, r.source_row_number), r.archive_row_id]));
    const cardColumns = ["collection_key", "source_archive_row_id", "source_row_number", "source_card_id", "year", "card_set", "card_no", "player_name", "card_description", "variant", "collecting", "got", "image_url", "team", "print_run", "source_fields"];
    const cardsDb = await insertBatch(client, "cards", cardColumns, snapshot.cards, (r, c) => {
      const v = { ...r, source_archive_row_id: archiveIds.get(sourceKey(r.source_tab, r.source_row_number)), source_fields: r.source_fields };
      check(v.source_archive_row_id, "Card row has no matching source archive row.");
      return v[c];
    }, "card_id,source_archive_row_id,source_card_id,collection_key");
    const dbIds = new Map();
    for (const c of cardsDb) if (c.source_card_id) { if (!dbIds.has(c.source_card_id)) dbIds.set(c.source_card_id, []); dbIds.get(c.source_card_id).push(c); }
    let itemCount = 0, receivedCount = 0, links = 0, review = [];
    for (const o of snapshot.orders) {
      const orderResult = await client.query("INSERT INTO public.orders (source_archive_row_id,source_order_id,seller,order_date,price,source_payload,source_payload_text) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING order_record_id",
        [archiveIds.get(sourceKey(o.source_tab, o.source_row_number)), o.source_order_id, o.seller, o.order_date, o.price, o.source_payload, o.source_payload_text]);
      for (const i of o.items) {
        const matches = dbIds.get(i.source_card_id) || [], cardId = matches.length === 1 ? matches[0].card_id : null;
        if (matches.length === 1) links++; else review.push(o.source_tab + "!A" + o.source_row_number + "[" + i.item_position + "]");
        itemCount++; if (i.received) receivedCount++;
        await client.query("INSERT INTO public.order_items (order_record_id,item_position,source_card_id,card_id,received,source_received_value,source_fields) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)",
          [orderResult.rows[0].order_record_id, i.item_position, i.source_card_id, cardId, i.received, i.source_received_value, {}]);
      }
      if (review.some((x) => x.startsWith(o.source_tab + "!A" + o.source_row_number + "["))) {
        await client.query("UPDATE public.source_archive SET processing_status='unmapped',processing_error='order_item_card_link_requires_review' WHERE archive_row_id=$1", [archiveIds.get(sourceKey(o.source_tab, o.source_row_number))]);
      }
    }
    check(itemCount === EXPECTED.items && receivedCount === EXPECTED.received && links === EXPECTED.items && review.length === 0,
      "Order reconciliation failed" + (review.length ? " at " + review.join(", ") : "") + ".");
    const final = {};
    for (const table of TABLES) {
      const r = await client.query("SELECT count(*)::bigint AS n FROM public." + table); final[table] = Number(r.rows[0].n);
    }
    check(final.collections === 4 && final.source_snapshots === 1 && final.source_archive === EXPECTED.archive && final.cards === EXPECTED.cards && final.orders === EXPECTED.orders && final.order_items === EXPECTED.items, "Final table totals differ from the approved manifest.");
    const archiveCounts = await client.query("SELECT source_tab,count(*)::bigint AS n FROM public.source_archive WHERE snapshot_id=$1 GROUP BY source_tab", [snapshotId]);
    for (const t of TABS) check(Number(archiveCounts.rows.find((r) => r.source_tab === t.name)?.n || 0) === t.archive, "Archive reconciliation failed for " + t.name + ".");
    for (const c of COLLECTIONS) {
      const r = await client.query("SELECT count(*)::bigint AS n FROM public.cards WHERE collection_key=$1", [c.key]);
      check(Number(r.rows[0].n) === TABS.find((t) => MAP[t.name]?.key === c.key).cards, "Card reconciliation failed for " + c.key + ".");
    }
    const seedRows = await client.query("SELECT collection_key,display_name FROM public.collections");
    check(COLLECTIONS.every((c) => seedRows.rows.some((r) => r.collection_key === c.key && r.display_name === c.display_name)), "Collection keys/display names differ.");
    const states = await client.query("SELECT count(*) FILTER(WHERE received)::bigint AS yes,count(*) FILTER(WHERE NOT received)::bigint AS no FROM public.order_items");
    check(Number(states.rows[0].yes) === EXPECTED.received && Number(states.rows[0].no) === EXPECTED.items - EXPECTED.received, "Received status counts differ.");
    for (const expected of STATUS_EXPECTATIONS) {
      const result = await client.query("SELECT count(*) FILTER(WHERE " + expected.field + " IS TRUE)::bigint AS yes,count(*) FILTER(WHERE " + expected.field + " IS FALSE)::bigint AS no,count(*) FILTER(WHERE " + expected.field + " IS NULL)::bigint AS missing FROM public.cards WHERE collection_key=$1", [expected.key]);
      check(Number(result.rows[0].yes) === expected.yes && Number(result.rows[0].no) === expected.no && Number(result.rows[0].missing) === 0, "Imported card status counts differ for " + expected.key + " " + expected.field + ".");
    }
    const payloads = await client.query("SELECT o.source_payload_text,a.raw_payload FROM public.orders o JOIN public.source_archive a ON a.archive_row_id = o.source_archive_row_id ORDER BY a.source_row_number");
    check(payloads.rows.length === snapshot.orders.length && payloads.rows.every((r, i) => r.source_payload_text === snapshot.orders[i].source_payload_text && r.raw_payload === snapshot.orders[i].source_payload_text), "Original Orders JSON text changed.");
    const archived = await client.query("SELECT source_tab,source_row_number,raw_values,raw_cell_data,raw_payload FROM public.source_archive WHERE snapshot_id=$1 ORDER BY source_tab,source_row_number", [snapshotId]);
    check(archived.rows.length === snapshot.archive.length, "Archived source row count differs.");
    const expectedArchive = new Map(snapshot.archive.map((r) => [sourceKey(r.source_tab, r.source_row_number), r]));
    for (const row of archived.rows) {
      const source = expectedArchive.get(sourceKey(row.source_tab, row.source_row_number));
      check(source && canonicalJson(row.raw_values) === canonicalJson(source.raw_values) && canonicalJson(row.raw_cell_data) === canonicalJson(source.raw_cell_data) && row.raw_payload === source.raw_payload, "Archived source data differs at " + row.source_tab + " row " + row.source_row_number + ".");
      expectedArchive.delete(sourceKey(row.source_tab, row.source_row_number));
    }
    check(expectedArchive.size === 0, "An expected source archive coordinate is missing.");
    const importedItems = await client.query("SELECT a.source_row_number,oi.item_position,oi.source_card_id,oi.card_id,oi.received,oi.source_received_value FROM public.order_items oi JOIN public.orders o USING(order_record_id) JOIN public.source_archive a ON a.archive_row_id=o.source_archive_row_id ORDER BY a.source_row_number,oi.item_position");
    const expectedItems = snapshot.orders.flatMap((o) => o.items.map((i) => ({ order: o, item: i })));
    check(importedItems.rows.length === expectedItems.length, "Order item row count differs.");
    for (let i = 0; i < expectedItems.length; i++) {
      const actual = importedItems.rows[i], expected = expectedItems[i];
      const matches = dbIds.get(expected.item.source_card_id) || [];
      check(Number(actual.source_row_number) === expected.order.source_row_number && actual.item_position === expected.item.item_position && actual.source_card_id === expected.item.source_card_id && actual.received === expected.item.received && matches.length === 1 && String(actual.card_id) === String(matches[0].card_id) && canonicalJson(actual.source_received_value) === canonicalJson(expected.item.source_received_value), "Order item provenance or mapping differs at source row " + expected.order.source_row_number + ".");
    }
    const cellRows = await client.query("SELECT raw_cell_data FROM public.source_archive WHERE snapshot_id=$1", [snapshotId]);
    let dbFormulas = 0, dbErrors = 0;
    for (const r of cellRows.rows) for (const c of r.raw_cell_data) { if (typeof c?.userEnteredValue?.formulaValue === "string") dbFormulas++; if (c?.effectiveValue?.errorValue) dbErrors++; }
    check(dbFormulas === EXPECTED.formulas && dbErrors === EXPECTED.errors, "Formula/error preservation totals differ.");
    const sourceIds = await client.query("SELECT count(*) FILTER(WHERE source_card_id IS NULL OR source_card_id='')::bigint AS missing FROM public.cards");
    check(Number(sourceIds.rows[0].missing) === 0, "Imported missing source card ID count differs from the manifest.");
    const withinDuplicates = await client.query("SELECT collection_key,count(*)::bigint AS groups FROM (SELECT collection_key,source_card_id FROM public.cards WHERE source_card_id IS NOT NULL AND source_card_id<>'' GROUP BY collection_key,source_card_id HAVING count(*)>1) d GROUP BY collection_key");
    check(withinDuplicates.rows.length === 0, "Duplicate source card IDs exist within a collection.");
    const duplicates = await client.query("SELECT count(*) FILTER(WHERE collections>1)::bigint AS groups,coalesce(sum(n-1) FILTER(WHERE collections>1),0)::bigint AS excess FROM (SELECT source_card_id,count(*) n,count(DISTINCT collection_key) collections FROM public.cards WHERE source_card_id IS NOT NULL AND source_card_id<>'' GROUP BY source_card_id) d");
    check(Number(duplicates.rows[0].groups) === EXPECTED.duplicateGroups && Number(duplicates.rows[0].excess) === EXPECTED.duplicateExcess, "Cross-collection duplicate IDs differ.");
    commitAttempted = true;
    await client.query("COMMIT"); transaction = false;
    commitSucceeded = true;
    console.log("Import committed to the verified testing target.");
    console.log("Reconciled counts: collections=4, snapshots=1, archive=" + final.source_archive + ", cards=" + final.cards + ", orders=" + final.orders + ", items=" + final.order_items + ", received=" + receivedCount + ", exact-ID links=" + links + ", formulas=" + dbFormulas + ", errors=" + dbErrors + ".");
  } catch (e) {
    if (commitSucceeded) {
      importFailure = new StopError("Database commit succeeded, but a subsequent operation failed. Error: " + safeOriginalError(e));
    } else if (transaction) {
      try {
        const rollback = await client.query("ROLLBACK");
        check(rollback.command === "ROLLBACK", "Database did not confirm rollback.");
        transaction = false;
      } catch (rollbackError) {
        importFailure = new StopError("Transaction outcome is uncertain. Original error: " + safeOriginalError(e) + ". Rollback error: " + safeOriginalError(rollbackError));
      }
      if (!importFailure && commitAttempted) {
        importFailure = new StopError("Transaction outcome is uncertain: COMMIT was attempted, so a subsequent ROLLBACK acknowledgement cannot establish whether it committed. Original error: " + safeOriginalError(e));
      } else if (!importFailure) {
        importFailure = new StopError("Import failed; rollback confirmed. Original error: " + safeOriginalError(e));
      }
    } else if (e instanceof StopError) {
      importFailure = e;
    } else {
      importFailure = new StopError("Import stopped before a transaction began. Original error: " + safeOriginalError(e));
    }
  } finally {
    try {
      await client.end();
    } catch (shutdownError) {
      const cleanupMessage = "Connection cleanup failed: " + safeOriginalError(shutdownError);
      if (importFailure) {
        importFailure = new StopError(importFailure.message + " " + cleanupMessage);
      } else if (commitSucceeded) {
        importFailure = new StopError("Database commit succeeded, but a subsequent connection cleanup operation failed. " + cleanupMessage);
      } else {
        importFailure = new StopError("Import did not complete with a confirmed commit. " + cleanupMessage);
      }
    }
  }
  if (importFailure) throw importFailure;
}
async function runReadOnlyPreflight(connectionConfig) {
  const client = createDatabaseClient(connectionConfig, true);
  let transactionStarted = false;
  let failed = false;
  let failure;
  let rollbackFailed = false;
  let rollbackFailure;
  let shutdownFailed = false;
  let shutdownFailure;
  let counts = null;
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    transactionStarted = true;
    const settings = await client.query("SELECT current_setting('default_transaction_read_only') AS default_read_only,current_setting('transaction_read_only') AS transaction_read_only");
    check(settings.rows[0]?.default_read_only === "on" && settings.rows[0]?.transaction_read_only === "on", "Read-only database session could not be verified.");
    const identity = await client.query("SELECT current_database() AS db, current_schema() AS schema");
    check(identity.rows[0]?.db === TARGET.database && identity.rows[0]?.schema === TARGET.schema, "Connected database/schema do not match the approved target.");
    const found = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' AND table_name=ANY($2::text[])", [TARGET.schema, TABLES]);
    check(TABLES.every((table) => found.rows.some((row) => row.table_name === table)), "One or more required public tables are missing.");
    await verifySchema(client);
    counts = {};
    for (const table of TABLES) {
      const result = await client.query("SELECT count(*)::bigint AS n FROM public." + table);
      counts[table] = Number(result.rows[0].n);
    }
    const populated = Object.entries(counts).filter(([, count]) => count !== 0);
    check(populated.length === 0, "Testing tables are not empty: " + populated.map(([table, count]) => table + "=" + count).join(", ") + ".");
  } catch (error) {
    failed = true;
    failure = error;
  }

  if (transactionStarted) {
    try {
      const rollback = await client.query("ROLLBACK");
      check(rollback.command === "ROLLBACK", "Database did not confirm read-only preflight rollback.");
      transactionStarted = false;
    } catch (error) {
      rollbackFailed = true;
      rollbackFailure = error;
    }
  }

  try {
    await client.end();
  } catch (error) {
    shutdownFailed = true;
    shutdownFailure = error;
  }

  const describe = (error) => error instanceof StopError ? error.message : safeOriginalError(error);
  const problems = [];
  if (failed) problems.push("Preflight failed: " + describe(failure));
  if (rollbackFailed) problems.push("Read-only transaction rollback was not confirmed: " + describe(rollbackFailure));
  if (shutdownFailed) problems.push("Database connection shutdown was not confirmed: " + describe(shutdownFailure));
  if (problems.length) throw new StopError(problems.join(". "));
  return counts;
}
async function verifyNeonBranchEndpoint(hostname, apiKey) {
  const endpoint = "https://console.neon.tech/api/v2/projects/" + encodeURIComponent(TARGET.projectId) + "/branches/" + encodeURIComponent(TARGET.branchId) + "/endpoints";
  let response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: { accept: "application/json", authorization: "Bearer " + apiKey },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new StopError("Could not verify the target branch with the Neon read-only management API; refusing to connect.");
  }
  if (!response.ok) throw new StopError("Neon did not verify the expected project and branch; refusing to connect.");
  let payload;
  try { payload = await response.json(); } catch { throw new StopError("Neon branch verification returned an invalid response; refusing to connect."); }
  const normalizeHost = (value) => value.toLowerCase();
  const matches = Array.isArray(payload?.endpoints)
    ? payload.endpoints.filter((item) => typeof item?.host === "string" && normalizeHost(item.host) === normalizeHost(hostname))
    : [];
  check(matches.length === 1 && matches[0].type === "read_write", "The connection host is not the unique read-write endpoint returned for the expected Neon project and branch.");
}

async function main() {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !["--execute", "--preflight-only"].includes(mode)) {
    console.error(mode === "--preflight-only" ? "Preflight FAIL: use exactly --preflight-only with no additional arguments." : "No database action taken. Use exactly --preflight-only or --execute.");
    process.exitCode = 2; return;
  }
  let text;
  try { text = await readFile(EXPORT, "utf8"); } catch { throw new StopError("Approved saved export is missing or unreadable."); }
  let data;
  try { data = JSON.parse(text); } catch { throw new StopError("Approved saved export is not valid JSON."); }
  const snapshot = prepare(data);
  const url = process.env.NEON_TEST_DATABASE_URL;
  const apiKey = process.env.NEON_API_KEY;
  check(url && apiKey, "Set the testing-only database URL and a Neon API key for read-only branch verification.");
  const connectionConfig = parseTestConnectionConfig(url);
  await verifyNeonBranchEndpoint(connectionConfig.host, apiKey);
  if (mode === "--preflight-only") {
    await runReadOnlyPreflight(connectionConfig);
    console.log("Preflight PASS: verified validation-branch endpoint, read-only session, expected schema/defaults/indexes/triggers, and empty target tables.");
    return;
  }
  await runImport(connectionConfig, snapshot);
}
main().catch((e) => {
  if (process.argv[2] === "--preflight-only") {
    console.error("Preflight FAIL: " + (e instanceof StopError ? e.message : safeOriginalError(e)));
  } else console.error(e instanceof StopError ? e.message : "Import stopped safely; raw error details were not printed.");
  process.exitCode = 1;
});
