# Google Sheets to Neon: migration mapping and verification plan

## Scope and evidence boundary

This document maps the existing export snapshot `google-sheets-export-2026-10-29T12-51-45-107Z-684fc25b-4121-4a2c-a57b-8a79870b9f3c.json` to `0001_neon_schema.sql`. It is a plan, not an import specification that has been executed. The export was inspected as a saved snapshot; it has **not** been compared with a fresh Google Sheets read in this work. The exporter requests the Sheets read-only scope and captures cell `userEnteredValue`, `effectiveValue`, `formattedValue`, and `userEnteredFormat.numberFormat` in each cell's typed data. No Sheets request, Neon connection, or database operation is part of this plan.

The schema defines six expected tables: `collections`, `source_snapshots`, `source_archive`, `cards`, `orders`, and `order_items`. Import should run as one controlled, repeatable operation against the approved development/preview branch first. The schema has no destructive replacement behavior; it begins a transaction and plain `CREATE TABLE` statements will fail if names already exist. Before applying or importing, inspect the target branch and confirm whether any of these objects exist. Do not infer that it is empty.

## Snapshot layout observed

The saved export reports the following captured grid dimensions and non-empty rows after the first row. The latter count includes any row with at least one populated cell, including formula-only rows.

| Tab | Captured grid | Non-empty rows after row 1 | Header/layout observation |
|---|---:|---:|---|
| Master | 53,071 × 26 | 18,582 | A:J headers; K:R have blank header cells, with data/formulas in K and R |
| Donruss | 2,376 × 22 | 1,951 | A:H headers, including Team in E and Card in F |
| Topps Now | 999 × 26 | 74 | A:K headers, including Print Run in F |
| Extra Collections | 998 × 24 | 128 | A:I headers; the known internal blank is source row 22 |
| Orders | 1,000 × 26 | 2 | A1 is `data`; the two data cells contain JSON text |

The exporter represents the complete captured grid, including trailing blank grid rows. The import must preserve the full captured range if the goal is a faithful snapshot archive, while classifying genuinely blank rows distinctly. A “blank row” should mean no entered value or formula anywhere in that captured row; a formatted-but-empty cell can still be retained in `raw_cell_data` if present.

## Row archival and source fidelity (all tabs)

1. Create one `source_snapshots` row for this export. Record the source spreadsheet title, export timestamp, export filename/format, captured tab names and dimensions, and a snapshot identifier in `source_metadata`. Do not store credentials or connection strings there.
2. Insert one `source_archive` row per captured source row per tab, including row 1 headers and blank rows in the captured grid. Set `source_tab` to the exact tab title and `source_row_number` to the original one-based spreadsheet row number. Use `row_kind = 'header'` for row 1, `'blank'` for rows with no entered values/formulas, `'data'` for ordinary populated rows, and `'other'` only when a row needs explicit review. The unique `(snapshot_id, source_tab, source_row_number)` constraint makes row provenance unambiguous.
3. Preserve the entire source row without trimming empty cells or collapsing columns. Store source cell values in `raw_values` as a JSON array with the original column positions, and the export's typed per-cell objects in `raw_cell_data` at those same positions. In particular retain formula text (`userEnteredValue.formulaValue`), evaluated result/error (`effectiveValue`), display text (`formattedValue`), and captured number format. Where a cell is absent in the export, preserve its position as null rather than shifting later cells left. Keep the captured header labels (including blank header cells) in the row-1 archive record.
4. `raw_cell_data` is a lossless record of the fields selected by the exporter, not every possible Google Sheets cell property. It can preserve the formula text, calculated value/error, formatted value, and number format captured in this snapshot. It cannot reconstruct cell properties that the exporter did not request. Do not claim a fresh or complete source read beyond this selection.
5. Set `processing_status` to `pending` initially. After classification, use `imported` only for rows represented in normalized tables, `unmapped` for deliberately archive-only rows such as formula-only rows, `malformed` for rows that cannot be parsed, and `reviewed` only after a human/data-quality review. Put a safe, concise reason in `processing_error` where useful; never copy secrets there.

For all normal card rows, `source_archive_row_id` is the provenance link from `cards` back to the exact archived row. The importer should maintain an in-memory/source manifest keyed by `(snapshot_id, source_tab, source_row_number)` and capture the generated `archive_row_id` and `card_id` returned by inserts. Do not use original card IDs as database keys or use spreadsheet row numbers as identifiers. Re-running should either be rejected for an already imported snapshot or be explicitly idempotent by detecting that same snapshot; it must not duplicate rows silently.

## Source-to-target mapping

Column letters below refer to original spreadsheet positions. Preserve all source columns in the archive and in `cards.source_fields`, even when a value has no current normalized target. Normalize values only into the explicit typed/text columns when the mapping is established; retain the original representation regardless.

### Master

| Source | Target |
|---|---|
| Tab and original row | `source_archive.source_tab = 'Master'`, `source_row_number`; each ordinary card row gets `cards.source_archive_row_id` |
| A `Card ID` | `cards.source_card_id` as text; also retain original cell in archive/source_fields. Null, blank, duplicate, or malformed IDs are permitted |
| B `Year` | `cards.year` as text |
| C `Card Set` | `cards.card_set` as text |
| D `Card No.` | `cards.card_no` as text |
| E `Player Name` | `cards.player_name` as text |
| F `Card Description` | `cards.card_description` as text |
| G `Variant` | `cards.variant` as text |
| H `Collecting` | `cards.collecting` only if its source value can be converted without ambiguity; preserve original typed value in archive/source_fields |
| I `Got` | `cards.got` only if unambiguous; preserve original typed value |
| J `Image URL` | `cards.image_url` as text |
| K, blank header | No semantic mapping yet. Preserve by source column position and raw cell data in archive and `source_fields`; do not assign it to a named business field until its meaning is confirmed |
| L:Z and all remaining captured columns | Preserve all non-empty/typed source cells in `source_fields` under stable column-position keys (for example `L`, `M`, etc.) and in the raw archive row |
| R formulas | Preserve formula, evaluated/display values and error in `raw_cell_data`; only normalize into a card field if a documented business meaning is approved |
| Collection | `cards.collection_key` must be a stable configured key for Master; collection display name can be `Master` |

The snapshot contains 24 rows (original rows 18,560–18,583) with formula content in R but no card ID or A:Q values. Archive them as source rows with formula evidence and mark them `unmapped`/review-required; do **not** insert them into `cards` merely because a formula is present. The R formulas elsewhere coexist with card data and should be retained for those card rows too. There is one spreadsheet error among the captured R formula results; retain the exact typed error object and its formatted value in the archive and flag it for review. Do not substitute an empty string or treat an error as an ordinary card value.

The snapshot has 73 non-empty K cells, in rows 10,262–10,300 and 12,156–12,189. Their header is blank and meaning is undocumented by inspected application code. Preserve exact cell data and position, and leave semantic interpretation unresolved.

### Donruss

| Source | Target |
|---|---|
| Tab and row | Archive exact title and original row; one card row links to that archive row |
| A `Card ID` | `cards.source_card_id` as text |
| B `Year` | `cards.year` |
| C `Card No.` | `cards.card_no` |
| D `Player ` | `cards.player_name`; preserve header whitespace exactly in archived header |
| E `Team` | `cards.team` as text; preserve source value |
| F `Card` | `cards.variant` only if confirmed to represent the existing card/variant field; otherwise retain in `source_fields` until semantics are settled. The repository parser treats this position as card/variant-like data, but downstream presentation uses a hard-coded Donruss set label |
| G `Got` | `cards.got` if unambiguous; archive original type/value |
| H `Image URL` | `cards.image_url` |
| Collection | Stable `Donruss` key in `cards.collection_key`; preserve the source row independently of display label conventions |
| Other captured columns | Preserve in `source_fields` and full archive row by original column position |

The repository's current mapping does not expose Team as a shared card property. The explicit `cards.team` column preserves it, while `source_fields` provides a second safeguard against mapping changes.

### Topps Now

| Source | Target |
|---|---|
| Tab and row | Archive exact title and original row; link normalized card to archive row |
| A `Card ID` | `cards.source_card_id` as text |
| B `Year` | `cards.year` |
| C `Card Set` | `cards.card_set` |
| D `Card No.` | `cards.card_no` |
| E `Player Name` | `cards.player_name` |
| F `Print Run` | `cards.print_run` as text; never discard because the current shared frontend model omits it |
| G `Variant` | `cards.variant` |
| H `Date & Description` | `cards.card_description` as text, preserving exact original value |
| I `Collecting` | `cards.collecting` only on unambiguous conversion; preserve original typed value |
| J `Got` | `cards.got` only on unambiguous conversion; preserve original typed value |
| K `Image` | `cards.image_url` |
| Other captured columns | Preserve in `source_fields` and archive |
| Collection | Stable `Topps Now` key |

### Extra Collections

| Source | Target |
|---|---|
| Tab and row | Archive exact title and original row; link card rows by archive ID |
| A `Card ID` | `cards.source_card_id` as text, nullable and non-unique |
| B `Year` | `cards.year` |
| C `Card Set` | `cards.card_set` |
| D `Card No.` | `cards.card_no` |
| E `Player Name` | `cards.player_name` |
| F `Variant` | `cards.variant` |
| G `Collecting` | `cards.collecting` only on unambiguous conversion; preserve original typed value |
| H `Got` | `cards.got` only on unambiguous conversion; preserve original typed value |
| I `Image` | `cards.image_url` |
| Other captured columns | Preserve in `source_fields` and archive |
| Collection | Stable `Extra Collections` key |

Archive source row 22 as `row_kind = 'blank'` because it is internal to the captured range; retain rows 21 and 23 as their original source positions. Do not compress source positions when building cards or use a frontend-style incrementing index. This avoids the known row-index shift caused by the current parser filtering/skipping rows. Trailing blank rows in the captured grid should also remain archive rows if full-grid fidelity is selected for this snapshot.

### Orders

The Orders tab has a single header cell in A1 (`data`) and two JSON data cells in column A in this snapshot. Keep each complete source row in `source_archive`, including exact row number and cell position. Preserve the exact original Orders JSON string in `source_archive.raw_payload` and `orders.source_payload_text`; parse a copy into `orders.source_payload` (`jsonb`) for queryable fields. Parsing must not rewrite or replace the original text. Compare canonical parsed content to source text by parsing both representations, while retaining original whitespace/key ordering in the text column.

For each valid Orders JSON object:

| JSON element | Target |
|---|---|
| Source Orders row | `orders.source_archive_row_id` links to exact archive row |
| Source order ID | `orders.source_order_id` as text, including duplicates/missing values without using it as PK |
| Seller, date, price | `orders.seller`, `order_date`, `price` as text when keys and types match the observed format; keep every other/unknown key in `source_payload` |
| Card ID array | One `order_items` row per array position, preserving zero-based source `item_position` and original card ID in `source_card_id` |
| Received status | Preserve the exact corresponding source status in `source_received_value`; set `received` only when the source value has an unambiguous boolean interpretation |
| Unknown order/item fields | Preserve in `orders.source_payload` and `order_items.source_fields`; never discard them during normalization |

Validate the JSON shape before inserting normalized records: top-level object; expected IDs/metadata types; arrays have matching and documented relationships; every item position is retained; received values correspond by the source's actual structure; no item is dropped for an unknown key or invalid optional field. A malformed object remains fully archived with `processing_status = 'malformed'` and a safe diagnostic, rather than being partially normalized without trace. For an otherwise valid object with a field that cannot be normalized safely, keep the full raw object, mark the row for review, and only normalize fields whose mapping is unambiguous.

Do not link an order item to a card by `source_card_id` unless exactly one card matches under a confirmed collection/ID policy. Where the ID is missing, duplicated, or otherwise ambiguous, keep `source_card_id` and the source archive/order-item provenance and leave `order_items.card_id` null. This deliberately avoids linking to an arbitrary duplicate. If the current Orders format has no unique item ID, leave `source_item_id` null; `order_item_id` is the new row's identity and `item_position` preserves source order.

## Missing IDs, duplicates, blank and formula rows

- The database-generated `cards.card_id` is the stable identity for each imported card row. `source_card_id` is nullable and deliberately not unique. Never deduplicate the source rows by card ID.
- Each card's unique `source_archive_row_id` anchors it to one source row. This distinguishes duplicate original IDs and is the back-reference for order resolution and audits.
- Missing or blank source card IDs do not prevent card-row insertion when the row otherwise qualifies as a card. Preserve the empty/null source value exactly in `raw_values`/`raw_cell_data`; set normalized `source_card_id` null rather than inventing an ID.
- Formula-only Master rows do not qualify as cards under the current mapping. Retain as archived source rows with the formula, result and original position; mark for review/unmapped. A formula result or error must not fabricate an ordinary card.
- Internal and captured-range blank rows are retained in the archive. They do not create card/order rows.
- Master K remains semantically unknown. Preserve its raw value and column coordinate; do not rename it or derive business behavior from it.
- Boolean-looking values must be converted to PostgreSQL booleans only where the exact source representation and established app behavior support the conversion. Keep exact source types in the archive regardless.

## Generated identity and traceability

Insert archive rows first and retain the database-returned `archive_row_id` keyed to the exact `(snapshot_id, source_tab, source_row_number)`. Insert cards using that archive ID and retain returned `card_id`; insert each order against its archive ID and each item against its generated `order_record_id`. Record a private migration manifest (outside source data or in a migration-run record only if separately approved) mapping source tab/row to generated database IDs. The authoritative persistent relationship remains `cards.source_archive_row_id`, `orders.source_archive_row_id`, and `order_items.order_record_id`; order item resolution uses nullable `card_id`. Never derive generated IDs from row ordering or assume identity sequences start at a particular number.

## Pre-import checks and reconciliation

Before any import (on a separate non-production branch):

1. Verify database identity in the Neon dashboard and connection context; ensure it is the approved development/preview branch and not production. Inspect current objects/data and schema version without printing credentials. Do not assume empty.
2. Validate the snapshot file parses and has the expected export format, tabs, captured dimensions, and row counts. Keep its hash and filename in the run record. Confirm that no fresh-source comparison is implied.
3. Confirm the migration file version/hash and six target tables; check schema constraints/indexes on the target. If objects already exist, stop and investigate; do not drop/replace them.
4. Produce a dry-run classification report: counts per tab for header/data/blank/formula-only/error/malformed rows, counts of card candidates by collection, missing and duplicated source card IDs, counts of K values, formulas/results/errors, valid/malformed Orders rows, order-item entries, received values, and resolvable/ambiguous/unmatched card IDs. Report counts and source positions, not personal/card details.
5. Review all assumptions (especially Master K, R, Donruss F, type conversion and Orders key/card matching policy). Hold import if any material mapping is unresolved.

After import, reconcile at minimum:

- Source rows archived per tab equal captured rows per tab; each tab has exactly one row-1 header and all original row numbers are unique/continuous for the captured grid. Blank and formula-only rows are accounted for, not lost.
- For each collection: source card candidates = inserted cards + explicitly excluded/archive-only rows, with the exclusion reasons and counts reconciled; no duplicate/missing IDs were dropped. Compare per-tab card counts and source-ID duplicate/missing counts to the dry run.
- Master R formulas, evaluated results, formatted values, and the single observed error are preserved at matching row/column coordinates; K's observed cells are preserved exactly.
- Orders: source JSON record count = archived Orders data record count; valid records = inserted orders + reviewed/malformed exceptions; source item count equals inserted order_items plus explicitly flagged item exceptions; item positions, original IDs and received statuses reconcile exactly. Parsed JSON content must match source text semantically, and `source_payload_text` must be byte-for-byte the original exported JSON string.
- Every normalized row points to the correct `source_archive_row_id`; every non-null order-item `card_id` resolves to exactly one intended card. Ambiguous IDs remain unlinked.
- Check nulls, duplicate source IDs, boolean conversion counts, failed constraints, unexpected defaults, and SQL warnings. Review representative rows by source coordinates without displaying personal data in logs.
- Run read-only application-level smoke tests only after data validation and only against a preview deployment configured exclusively for the development database. Compare collection views, filters, card updates, and order rendering/status behavior with the source snapshot. Production frontend/API routing and production database must remain untouched during this phase.

## Rollback and recovery

- Preserve the original export file read-only and retain a verified backup copy plus cryptographic hash. Keep the Google Sheet unchanged as the source of truth until the new flow has passed reconciliation and preview testing.
- Import only to an explicitly approved non-production branch first. Use a transaction for each controlled import; on any failure, roll back the transaction and retain the error/count report. Do not rerun blindly if the transaction outcome is uncertain; inspect the snapshot and rows first.
- Keep imports snapshot-scoped and record their run/snapshot ID. If recovery requires removing a test import, delete only rows belonging to that explicitly identified test snapshot, in a reviewed transaction, after verifying foreign-key cascade/restrict behavior. Never use broad table truncation or apply a destructive reset to a shared branch.
- Production cutover is a separate later approval. Before it, take/retain a production backup or Neon restore point, establish a write freeze or dual-write/catch-up strategy, verify final source freshness and reconciliation, and document the exact rollback switch. Preserve Sheets and the old API path until production read/write parity is demonstrated; rollback must restore the old live configuration without deleting or rewriting the spreadsheet.
- This planning work did not modify the spreadsheet, live site, API routes, export, schema, or any database, and did not connect to Google Sheets or Neon.

## Decisions still requiring review

1. What business meaning Master column K has; it is populated but has a blank header and the inspected code does not explain it.
2. Whether Master R's same-row B/C concatenation formula is purely derived display/search data or has another use. Preserve its formula/result/error now; do not promote it to a card field without confirmation.
3. Whether the Donruss F `Card` value should normalize into `variant` or a separate explicit field. Preserve it regardless in raw archive/source fields.
4. The exact accepted source encodings for `Collecting`, `Got`, and Orders received status, and the rule for card IDs that match more than one collection/card.
5. Whether the full captured grid including large trailing blank ranges should all be archived, or whether a separately defined source-used-range boundary may be adopted after user approval and a fresh source read. For this snapshot-faithful plan, archive every captured row.
6. A fresh read-only source snapshot and hash comparison are needed before actual import, because the reviewed export is only a dated snapshot.

No import or database action is authorized by this document. Resolve the decisions and approve the preview-branch dry run before implementation proceeds.

