#!/usr/bin/env node

// Local-only, no-write preparation against the approved saved export.
// This script intentionally does not load .env files, inspect process.env,
// import database clients, make network calls, or execute SQL.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPORT_NAME =
  "google-sheets-export-2026-10-29T12-51-45-107Z-684fc25b-4121-4a2c-a57b-8a79870b9f3c.json";
const EXPECTED_TABS = [
  { name: "Master", rows: 53071, columns: 26, archiveRows: 18583, cards: 18558 },
  { name: "Donruss", rows: 2376, columns: 22, archiveRows: 1952, cards: 1951 },
  { name: "Topps Now", rows: 999, columns: 26, archiveRows: 75, cards: 74 },
  { name: "Extra Collections", rows: 998, columns: 24, archiveRows: 130, cards: 128 },
  { name: "Orders", rows: 1000, columns: 26, archiveRows: 3, cards: 0 },
];
const EXPECTED_HEADERS = {
  Master: ["Card ID", "Year", "Card Set", "Card No.", "Player Name", "Card Description", "Variant", "Collecting", "Got", "Image URL"],
  Donruss: ["Card ID", "Year", "Card No.", "Player ", "Team", "Card", "Got", "Image URL"],
  "Topps Now": ["Card ID", "Year", "Card Set", "Card No.", "Player Name", "Print Run", "Variant", "Date & Description", "Collecting", "Got", "Image"],
  "Extra Collections": ["Card ID", "Year", "Card Set", "Card No.", "Player Name", "Variant", "Collecting", "Got", "Image"],
  Orders: ["data"],
};
const EXPECTED = {
  archiveRows: 20743,
  cardRows: 20711,
  orders: 2,
  orderItems: 12,
  receivedTrue: 7,
  receivedFalse: 5,
  formulaCells: 16104,
  formulaOnlyRows: 24,
  spreadsheetErrors: 9,
  internalBlankRows: 1,
  trailingBlankRowsOmitted: 37701,
  duplicateIdGroupsWithinTabs: 0,
  crossCollectionDuplicateGroups: 1951,
  crossCollectionDuplicateExcessRows: 2025,
  orderMatchUnique: 12,
  orderMatchAmbiguous: 0,
  orderMatchUnmatched: 0,
};
const COLLECTIONS = {
  Master: { key: "master", displayName: "Master", cardSet: null, fields: { source_card_id: 0, year: 1, card_set: 2, card_no: 3, player_name: 4, card_description: 5, variant: 6, collecting: 7, got: 8, image_url: 9 } },
  Donruss: { key: "donruss", displayName: "Donruss", cardSet: "Donruss International", fields: { source_card_id: 0, year: 1, card_no: 2, player_name: 3, team: 4, variant: 5, got: 6, image_url: 7 } },
  "Topps Now": { key: "topps-now", displayName: "Topps Now", cardSet: null, fields: { source_card_id: 0, year: 1, card_set: 2, card_no: 3, player_name: 4, print_run: 5, variant: 6, card_description: 7, collecting: 8, got: 9, image_url: 10 } },
  "Extra Collections": { key: "extra-collections", displayName: "Extra Collections", cardSet: null, fields: { source_card_id: 0, year: 1, card_set: 2, card_no: 3, player_name: 4, variant: 5, collecting: 6, got: 7, image_url: 8 } },
};
const EXPECTED_ERRORS = [
  "Master!B16383", "Master!R16383", "Master!E17234", "Master!E17305",
  "Master!E17306", "Master!E18345", "Master!E18346", "Master!E18347",
  "Master!E18410",
];

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(repoRoot, "..", "..");
const inputPath = resolve(workspaceRoot, "outputs", EXPORT_NAME);
const outputPath = resolve(workspaceRoot, "outputs", "neon-import-dry-run-2026-10-29.md");

function failPreflight() {
  throw new Error("Saved export is missing or differs from the approved manifest.");
}
function assert(condition) {
  if (!condition) failPreflight();
}
function colName(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}
function cellValue(cell) {
  return cell?.userEnteredValue ?? null;
}
function isEntered(cell) {
  const value = cellValue(cell);
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}
function isFormula(cell) {
  return typeof cell?.userEnteredValue?.formulaValue === "string";
}
function primitive(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.stringValue === "string") return value.stringValue;
  if (typeof value.numberValue === "number") return String(value.numberValue);
  if (typeof value.boolValue === "boolean") return String(value.boolValue);
  return null;
}
function rowHasEntered(row) {
  return row.cells.some(isEntered);
}
function rawRowValues(row) {
  return row.cells.map((cell) => cellValue(cell));
}
function rawCellData(row) {
  // Preserve typed entered/effective/formatted/format data and column position.
  return row.cells.map((cell) => cell ?? null);
}
function sourceFields(row) {
  return Object.fromEntries(row.cells.map((cell, i) => [colName(i), cellValue(cell)]));
}
function nonFormulaMappedValue(row, index) {
  return isEntered(row.cells[index]) && !isFormula(row.cells[index]);
}
function isCardCandidate(tabName, row) {
  const mapping = COLLECTIONS[tabName];
  if (!mapping) return false;
  return Object.values(mapping.fields).some((index) => nonFormulaMappedValue(row, index));
}
function cardIdFor(tabName, row) {
  const mapping = COLLECTIONS[tabName];
  return primitive(cellValue(row.cells[mapping.fields.source_card_id]));
}
function boolCell(row, index) {
  const value = cellValue(row.cells[index]);
  return typeof value?.boolValue === "boolean" ? value.boolValue : null;
}
function cellsWithFormula(tab) {
  const out = [];
  for (const row of tab.rows) {
    for (let i = 0; i < row.cells.length; i += 1) {
      if (isFormula(row.cells[i])) out.push({ row: row.rowNumber, col: i, cell: row.cells[i] });
  }
  }
  return out;
}
function spreadsheetErrors(tab) {
  const out = [];
  for (const row of tab.rows) {
    for (let i = 0; i < row.cells.length; i += 1) {
      if (row.cells[i]?.effectiveValue?.errorValue) {
        out.push(`${tab.title}!${colName(i)}${row.rowNumber}`);
      }
    }
  }
  return out;
}
function summarizeStatus(tab, index) {
  let trueCount = 0;
  let falseCount = 0;
  let otherCount = 0;
  for (const row of tab.rows.slice(1)) {
    if (!isEntered(row.cells[index])) continue;
    const value = boolCell(row, index);
    if (value === true) trueCount += 1;
    else if (value === false) falseCount += 1;
    else otherCount += 1;
  }
  return { trueCount, falseCount, otherCount };
}
function jsonSafe(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function main() {
  let text;
  try {
    text = await readFile(inputPath, "utf8");
  } catch {
    failPreflight();
  }
  let exportData;
  try { exportData = JSON.parse(text); } catch { failPreflight(); }

  assert(exportData?.exportFormat === "google-sheets-grid-v1");
  assert(Array.isArray(exportData.tabs));
  assert(exportData.tabs.length === EXPECTED_TABS.length);

  const byName = new Map(exportData.tabs.map((tab) => [tab.title, tab]));
  const tabStats = [];
  const candidateRows = [];
  const allArchiveRows = [];
  const allOrderRecords = [];
  let formulasTotal = 0;
  let formulaOnlyRowsTotal = 0;
  let errorsTotal = 0;
  let internalBlankTotal = 0;
  let trailingBlankTotal = 0;
  const errorsSeen = [];

  for (const expected of EXPECTED_TABS) {
    const tab = byName.get(expected.name);
    assert(tab && Number.isInteger(tab.rowCount) && Number.isInteger(tab.columnCount));
    assert(tab.rowCount === expected.rows && tab.columnCount === expected.columns);
    assert(Array.isArray(tab.rows) && tab.rows.length === expected.rows);
    const expectedHeaders = EXPECTED_HEADERS[expected.name];
    assert(expectedHeaders.every((header, index) => tab.rows[0].cells[index]?.userEnteredValue?.stringValue === header));
    for (let index = expectedHeaders.length; index < expected.columns; index += 1) {
      assert(!isEntered(tab.rows[0].cells[index]));
    }

    let lastOccupied = 1;
    for (let i = tab.rows.length - 1; i >= 1; i -= 1) {
      if (rowHasEntered(tab.rows[i])) { lastOccupied = i + 1; break; }
    }
    assert(lastOccupied === expected.archiveRows);
    let candidateCount = 0;
    let populatedRows = 0;
    let internalBlanks = 0;
    let formulaRows = 0;
    let formulaOnlyRows = 0;
    let missingIdsOnCards = 0;
    const activeArchiveRows = [];

    for (let i = 0; i < tab.rows.length; i += 1) {
      const row = tab.rows[i];
      assert(row?.rowNumber === i + 1 && Array.isArray(row.cells));
      assert(row.cells.length === expected.columns);
      if (i >= lastOccupied) continue;
      const hasData = rowHasEntered(row);
      const hasFormula = row.cells.some(isFormula);
      if (!hasData && i > 0) internalBlanks += 1;
      const formulasInRow = row.cells.filter(isFormula).length;
      if (formulasInRow) formulaRows += 1;
      if (formulasInRow && !row.cells.some((cell) => isEntered(cell) && !isFormula(cell))) {
        formulaOnlyRows += 1;
      }
      if (hasData || hasFormula || i === 0 || (!hasData && i > 0 && i < lastOccupied)) {
        activeArchiveRows.push({
          source_tab: tab.title,
          source_row_number: row.rowNumber,
          row_kind: i === 0 ? "header" : hasData || hasFormula ? "data" : "blank",
          raw_values: rawRowValues(row),
          raw_cell_data: rawCellData(row),
          raw_payload: tab.title === "Orders" && i > 0 ? primitive(cellValue(row.cells[0])) : null,
        });
      }
      if (i > 0 && hasData) populatedRows += 1;
      if (i > 0 && isCardCandidate(tab.title, row)) {
        candidateCount += 1;
        const originalId = cardIdFor(tab.title, row);
        if (originalId === null || originalId === "") missingIdsOnCards += 1;
        const mapping = COLLECTIONS[tab.title];
        const fields = {};
        for (const [field, columnIndex] of Object.entries(mapping.fields)) {
          const value = cellValue(row.cells[columnIndex]);
          fields[field] = field === "collecting" || field === "got"
            ? boolCell(row, columnIndex)
            : primitive(value);
        }
        if (tab.title === "Donruss") {
          // Compatibility view only; source Collecting does not exist.
          fields.collecting = null;
          fields.application_collecting_default = true;
          fields.card_set = mapping.cardSet;
          fields.variant = primitive(cellValue(row.cells[mapping.fields.variant])) || "Base";
        }
        if (tab.title === "Master" || tab.title === "Topps Now" || tab.title === "Extra Collections") {
          fields.variant = primitive(cellValue(row.cells[mapping.fields.variant])) || "Base";
        }
        const card = {
          collection_key: mapping.key,
          source_archive_key: `${tab.title}:${row.rowNumber}`,
          source_row_number: row.rowNumber,
          source_card_id: originalId,
          ...fields,
          source_fields: sourceFields(row),
        };
        candidateRows.push(card);
      }
      if (tab.title === "Orders" && i > 0 && hasData) {
        const raw = primitive(cellValue(row.cells[0]));
        assert(typeof raw === "string");
        const parsed = jsonSafe(raw);
        assert(parsed && typeof parsed === "object" && !Array.isArray(parsed));
        assert(typeof parsed.id === "string");
        assert(Array.isArray(parsed.cardIds) && parsed.cardIds.every((id) => typeof id === "string"));
        assert(Array.isArray(parsed.received) && parsed.received.every((id) => typeof id === "string"));
        const orderRecord = {
          source_archive_key: `Orders:${row.rowNumber}`,
          source_row_number: row.rowNumber,
          source_order_id: parsed.id,
          seller: typeof parsed.seller === "string" ? parsed.seller : null,
          order_date: typeof parsed.date === "string" ? parsed.date : null,
          price: typeof parsed.price === "string" ? parsed.price : null,
          source_payload_text: raw,
          source_payload: parsed,
          items: parsed.cardIds.map((id, item_position) => ({
            item_position,
            source_card_id: id,
            received: parsed.received.includes(id),
            source_received_value: parsed.received.includes(id),
          })),
        };
        allOrderRecords.push(orderRecord);
      }
    }

    const formulaCells = cellsWithFormula(tab);
    const formulaColumns = [...new Set(formulaCells.map(({ col }) => colName(col)))];
    const expectedFormulaColumns = tab.title === "Master" ? ["R"] : tab.title === "Extra Collections" ? ["I"] : [];
    assert(JSON.stringify(formulaColumns.sort()) === JSON.stringify(expectedFormulaColumns));
    if (tab.title === "Master") assert(formulaCells.length === 16004);
    if (tab.title === "Extra Collections") assert(formulaCells.length === 100);
    if (!["Master", "Extra Collections"].includes(tab.title)) assert(formulaCells.length === 0);
    if (tab.title === "Master") {
      const formulaOnlyRowNumbers = tab.rows.filter((row) =>
        row.cells.some(isFormula) && !row.cells.some((cell) => isEntered(cell) && !isFormula(cell))
      ).map((row) => row.rowNumber);
      assert(JSON.stringify(formulaOnlyRowNumbers) === JSON.stringify(Array.from({ length: 24 }, (_, i) => 18560 + i)));
    }
    const tabErrors = spreadsheetErrors(tab);
    formulasTotal += formulaCells.length;
    formulaOnlyRowsTotal += formulaOnlyRows;
    errorsTotal += tabErrors.length;
    internalBlankTotal += internalBlanks;
    trailingBlankTotal += tab.rows.length - lastOccupied;
    errorsSeen.push(...tabErrors);
    assert(activeArchiveRows.length === expected.archiveRows);
    assert(candidateCount === expected.cards);
    assert(missingIdsOnCards === 0);
    allArchiveRows.push(...activeArchiveRows);
    tabStats.push({
      name: tab.title,
      grid: `${tab.rowCount.toLocaleString("en-US")} × ${tab.columnCount}`,
      lastOccupied,
      archiveRows: activeArchiveRows.length,
      candidates: candidateCount,
      populatedRows,
      formulaRows,
      formulaCells: formulaCells.length,
      formulaOnlyRows,
      errors: tabErrors.length,
      internalBlanks,
      trailingBlanks: tab.rows.length - lastOccupied,
    });
  }

  assert(allArchiveRows.length === EXPECTED.archiveRows);
  assert(candidateRows.length === EXPECTED.cardRows);
  assert(formulasTotal === EXPECTED.formulaCells);
  assert(formulaOnlyRowsTotal === EXPECTED.formulaOnlyRows);
  assert(errorsTotal === EXPECTED.spreadsheetErrors);
  assert(internalBlankTotal === EXPECTED.internalBlankRows);
  assert(allArchiveRows.some((row) => row.source_tab === "Extra Collections" && row.source_row_number === 22 && row.row_kind === "blank"));
  assert(trailingBlankTotal === EXPECTED.trailingBlankRowsOmitted);
  assert(JSON.stringify(errorsSeen.sort()) === JSON.stringify([...EXPECTED_ERRORS].sort()));
  assert(allOrderRecords.length === EXPECTED.orders);

  const cardCountsByCollection = new Map();
  const idToCandidates = new Map();
  const idsByCollection = new Map();
  for (const card of candidateRows) {
    cardCountsByCollection.set(card.collection_key, (cardCountsByCollection.get(card.collection_key) || 0) + 1);
    if (card.source_card_id !== null && card.source_card_id !== "") {
      if (!idToCandidates.has(card.source_card_id)) idToCandidates.set(card.source_card_id, []);
      idToCandidates.get(card.source_card_id).push(card);
      if (!idsByCollection.has(card.collection_key)) idsByCollection.set(card.collection_key, new Map());
      const counts = idsByCollection.get(card.collection_key);
      counts.set(card.source_card_id, (counts.get(card.source_card_id) || 0) + 1);
    }
  }
  const withinTabDuplicateGroups = [...idsByCollection.values()]
    .flatMap((counts) => [...counts.values()]).filter((count) => count > 1).length;
  const duplicateIdValuesAcrossCollections = [...idToCandidates.entries()]
    .filter(([, cards]) => new Set(cards.map((card) => card.collection_key)).size > 1);
  const crossCollectionDuplicateExcessRows = duplicateIdValuesAcrossCollections
    .reduce((sum, [, cards]) => sum + cards.length - 1, 0);
  assert(withinTabDuplicateGroups === EXPECTED.duplicateIdGroupsWithinTabs);
  assert(duplicateIdValuesAcrossCollections.length === EXPECTED.crossCollectionDuplicateGroups);
  assert(crossCollectionDuplicateExcessRows === EXPECTED.crossCollectionDuplicateExcessRows);

  let orderItemCount = 0;
  let receivedTrue = 0;
  let receivedFalse = 0;
  let orderDuplicateGroups = 0;
  let receivedIdsAbsent = 0;
  let ambiguousReceivedItems = 0;
  let matchUnique = 0;
  let matchAmbiguous = 0;
  let matchUnmatched = 0;
  const orderStats = [];
  for (const order of allOrderRecords) {
    const orderRow = order.source_row_number;
    const rawOrder = byName.get("Orders").rows[orderRow - 1].cells[0].userEnteredValue.stringValue;
    assert(order.source_payload_text === rawOrder);
    const idCounts = new Map();
    for (const item of order.items) idCounts.set(item.source_card_id, (idCounts.get(item.source_card_id) || 0) + 1);
    const dupGroups = [...idCounts.values()].filter((count) => count > 1).length;
    const receivedSet = new Set(order.source_payload.received);
    for (const item of order.items) {
      if (idCounts.get(item.source_card_id) > 1 && receivedSet.has(item.source_card_id)) ambiguousReceivedItems += 1;
    }
    orderDuplicateGroups += dupGroups;
    for (const receivedId of order.source_payload.received) {
      if (!order.source_payload.cardIds.includes(receivedId)) receivedIdsAbsent += 1;
    }
    let rowTrue = 0;
    let rowFalse = 0;
    let rowUnique = 0;
    let rowAmbiguous = 0;
    let rowUnmatched = 0;
    for (const item of order.items) {
      orderItemCount += 1;
      if (item.received) { receivedTrue += 1; rowTrue += 1; }
      else { receivedFalse += 1; rowFalse += 1; }

      const matches = idToCandidates.get(item.source_card_id) || [];
      const matchingCollections = new Set(matches.map((card) => card.collection_key));
      if (matches.length === 1 && matchingCollections.size === 1) { matchUnique += 1; rowUnique += 1; }
      else if (matches.length > 1 || matchingCollections.size > 1) { matchAmbiguous += 1; rowAmbiguous += 1; }
      else { matchUnmatched += 1; rowUnmatched += 1; }
    }
    orderStats.push({ row: orderRow, items: order.items.length, received: rowTrue, notReceived: rowFalse, duplicateIdGroups: dupGroups, uniqueLinks: rowUnique, ambiguousLinks: rowAmbiguous, unmatchedLinks: rowUnmatched });
  }
  assert(orderItemCount === EXPECTED.orderItems);
  assert(receivedTrue === EXPECTED.receivedTrue && receivedFalse === EXPECTED.receivedFalse);
  assert(orderDuplicateGroups === 0 && receivedIdsAbsent === 0 && ambiguousReceivedItems === 0);
  assert(JSON.stringify(orderStats.map((o) => [o.row, o.items, o.received, o.notReceived])) === JSON.stringify([[2, 5, 0, 5], [3, 7, 7, 0]]));
  assert(matchUnique === EXPECTED.orderMatchUnique);
  assert(matchAmbiguous === EXPECTED.orderMatchAmbiguous && matchUnmatched === EXPECTED.orderMatchUnmatched);

  const statusStats = [
    ["Master H — Collecting", summarizeStatus(byName.get("Master"), 7)],
    ["Master I — Got", summarizeStatus(byName.get("Master"), 8)],
    ["Donruss G — Got", summarizeStatus(byName.get("Donruss"), 6)],
    ["Topps Now I — Collecting", summarizeStatus(byName.get("Topps Now"), 8)],
    ["Topps Now J — Got", summarizeStatus(byName.get("Topps Now"), 9)],
    ["Extra Collections G — Collecting", summarizeStatus(byName.get("Extra Collections"), 6)],
    ["Extra Collections H — Got", summarizeStatus(byName.get("Extra Collections"), 7)],
  ];
  const expectedStatus = [
    [2214, 16344], [1334, 17224], [710, 1241], [14, 60], [11, 63], [128, 0], [81, 47],
  ];
  statusStats.forEach(([, stats], i) => {
    assert(stats.trueCount === expectedStatus[i][0]);
    assert(stats.falseCount === expectedStatus[i][1] && stats.otherCount === 0);
  });

  const warnings = [
    "Master K has no approved semantic mapping; source cells remain archive-only/source_fields data.",
    "Master R remains archive-only; formula results and errors are not normalized as card fields.",
    "Fresh source comparison has not been performed; this plan uses the selected saved snapshot.",
    "Collection scope is absent from Orders JSON; linking is allowed only when exact ID resolves to one card in one collection.",
    "Trailing blank grid rows are excluded from source_archive under the approved working boundary but remain in the untouched export.",
  ];

  const lines = [
    "# Local import preparation dry run",
    "",
    `- Snapshot: ${EXPORT_NAME} (captured ${exportData.exportedAt}).`,
    "- Mode: local-only preparation; no database connection, SQL, import, or network request.",
    "- Input file was read only; report contains aggregate counts and coordinates, not card/order values.",
    "",
    "## Expected inserts",
    "",
    "| Table | Expected rows |",
    "|---|---:|",
    "| `source_snapshots` | 1 |",
    ...tabStats.map((s) => `| source_archive — ${s.name} | ${s.archiveRows.toLocaleString("en-US")} |`),
    `| **source_archive total** | **${allArchiveRows.length.toLocaleString("en-US")}** |`,
    ...[...cardCountsByCollection.entries()].map(([key, count]) => `| cards — ${key} | ${count.toLocaleString("en-US")} |`),
    `| **cards total** | **${candidateRows.length.toLocaleString("en-US")}** |`,
    `| orders | ${allOrderRecords.length} |`,
    `| order_items | ${orderItemCount} |`,
    "| `collections` | 0–4, conditional on inspecting target seed rows |",
    "",
    "## Source row and collection reconciliation",
    "",
    "| Tab | Captured grid | Last active row | Archive rows | Card candidates | Formula-only rows | Internal blanks | Trailing blanks excluded |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...tabStats.map((s) => `| ${s.name} | ${s.grid} | ${s.lastOccupied} | ${s.archiveRows} | ${s.candidates} | ${s.formulaOnlyRows} | ${s.internalBlanks} | ${s.trailingBlanks.toLocaleString("en-US")} |`),
    "",
    "| Collection key | Card candidates | Missing candidate IDs | Duplicate IDs within collection |",
    "|---|---:|---:|---:|",
    ...EXPECTED_TABS.filter((t) => COLLECTIONS[t.name]).map((t) => `| ${COLLECTIONS[t.name].key} | ${cardCountsByCollection.get(COLLECTIONS[t.name].key)} | 0 | 0 |`),
    `| **Total** | **${candidateRows.length}** | **0** | **${withinTabDuplicateGroups}** |`,
    "",
    `Across collections, ${duplicateIdValuesAcrossCollections.length.toLocaleString("en-US")} original ID values occur in more than one collection, with ${crossCollectionDuplicateExcessRows.toLocaleString("en-US")} excess occurrences. The preparation preserves every card row; no source ID is used as a primary key.`,
    "",
    "## Orders reconciliation",
    "",
    "| Source row | Order records | Items | Received | Not received | Duplicate-ID groups | Unique card links | Ambiguous links | Unmatched links |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...orderStats.map((o) => `| Orders!A${o.row} | 1 | ${o.items} | ${o.received} | ${o.notReceived} | ${o.duplicateIdGroups} | ${o.uniqueLinks} | ${o.ambiguousLinks} | ${o.unmatchedLinks} |`),
    `| **Total** | **${allOrderRecords.length}** | **${orderItemCount}** | **${receivedTrue}** | **${receivedFalse}** | **${orderDuplicateGroups}** | **${matchUnique}** | **${matchAmbiguous}** | **${matchUnmatched}** |`,
    "",
    "The Orders source JSON text is retained in-memory unchanged as `source_payload_text`; parsing is used only to prepare normalized fields and item positions. It is not written to the report. Each item uses its zero-based array position. A `card_id` link is planned only when exact source ID resolves to one candidate in one collection; otherwise it remains unset for review.",
    "",
    "## Status values and source preservation",
    "",
    "| Source status column | True | False | Other |",
    "|---|---:|---:|---:|",
    ...statusStats.map(([label, s]) => `| ${label} | ${s.trueCount} | ${s.falseCount} | ${s.otherCount} |`),
    `| Orders received-ID list | ${receivedTrue} item memberships | ${receivedFalse} non-memberships | 0 unmatched entries |`,
    "",
    "All counted card statuses are typed Sheets booleans, preserved in raw cell data and mapped directly only where a source column exists. Donruss has no source Collecting cell: its normalized source value remains null; the existing UI may derive `true` as an application default. The original Donruss F value is retained in source fields/archive and continues to feed the UI `variant` compatibility mapping with `Base` fallback.",
    "",
    `Formula cells preserved in planned archive: ${formulasTotal.toLocaleString("en-US")} (Master R: 16,004; Extra Collections I: 100). Formula-only rows: ${formulaOnlyRowsTotal} (Master rows 18,560–18,583). Spreadsheet error cells: ${errorsTotal} at ${errorsSeen.sort().join(", ")}. Formula text, effective values/errors, formatted values, number formats, typed cells, source columns, and original row positions are retained in source_archive.raw_cell_data; raw_values uses the position-preserving entered-value array.`,
    "",
    "Archive boundary: all headers, active rows, formula-bearing rows, and internal blank rows are included. Extra Collections source row 22 is the one internal blank. The 37,701 trailing blank rows are omitted from the database archive but remain in the unchanged full export.",
    "",
    "## Warnings and unresolved decisions",
    "",
    ...warnings.map((warning) => `- ${warning}`),
    "- Donruss application default is not source data; a future application read path must preserve its current display behavior separately.",
    "- If an order repeats a card ID, the source received-ID array cannot identify a specific repeated item position; stop and review. None occur in this snapshot.",
    "- The schema does not seed `collections`; inspect the test database and insert only missing approved keys after explicit authorization.",
    "",
    "## Preflight outcome",
    "",
    "All approved structural, row-count, mapping, formula/error, status, duplicate-ID, and Orders baselines matched. This report is a preparation artifact only; it does not authorize or perform database writes.",
    "",
  ];

  await writeFile(outputPath, lines.join("\n"), { encoding: "utf8", flag: "w" });
  console.log(`Dry-run report created: ${outputPath}`);
}

main().catch(() => {
  console.error("Dry-run refused or failed: saved export is missing or differs from the approved manifest.");
  process.exitCode = 1;
});
