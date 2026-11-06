# Everton Card Tracker: no-write import manifest

## Purpose and basis

This manifest describes a possible test import from the existing saved export only. It does not run an import. The export parsed successfully as `google-sheets-grid-v1` and contains all five tabs. Counts below follow `0006_dry_run_report.md` and the proposed policy to omit trailing blank grid rows from PostgreSQL while retaining the complete unchanged export. All source row numbers are one-based.

**Measured snapshot facts:** 20,711 card candidates; 24 Master formula-only rows; one internal blank row; two Orders records with 12 items and 7 received IDs; 16,104 formula cells; nine spreadsheet error cells. The snapshot has not been independently compared with a fresh Sheets read.

## Expected inserts

| Target | Expected rows | Notes |
|---|---:|---|
| `source_snapshots` | 1 | One row identifying this export, timestamp, filename/format, and tab dimensions; no credentials |
| `source_archive` | 20,743 | Headers, populated/formula-bearing rows, both Orders rows, and the one internal blank row; excludes trailing grid-only blanks |
| `cards` | 20,711 | One per eligible source card row, each with a generated `card_id` |
| `orders` | 2 | Source rows Orders!A2 and Orders!A3 |
| `order_items` | 12 | 5 items from Orders row 2 and 7 from row 3 |
| `collections` | 0–4 | Conditional: insert only missing approved keys after inspecting the target. Expected keys: `master`, `donruss`, `topps-now`, `extra-collections` |

### Source archive rows by tab

| Source tab | Expected archived rows | Included source positions |
|---|---:|---|
| Master | 18,583 | Header row 1; all populated/formula rows through row 18,583, including formula-only rows 18,560–18,583 |
| Donruss | 1,952 | Header row 1 and populated rows 2–1,952 |
| Topps Now | 75 | Header row 1 and populated rows 2–75 |
| Extra Collections | 130 | Header row 1, rows 2–130 including internal blank row 22 |
| Orders | 3 | Header row 1 and JSON records in rows 2–3 |
| **Total** | **20,743** | Five headers + 20,711 card rows + 24 formula-only rows + one internal blank row + two Orders rows |

The remaining 37,701 trailing blank grid rows stay in the original full export and are not proposed as database archive rows. This boundary is a **working decision from the dry-run report** and must be explicitly confirmed before import. If the owner instead requires complete row-for-row grid archival in PostgreSQL, these counts change and the import must stop for a revised manifest.

## Expected card rows and source mapping

| Collection key | Source tab | Expected cards |
|---|---|---:|
| `master` | Master | 18,558 |
| `donruss` | Donruss | 1,951 |
| `topps-now` | Topps Now | 74 |
| `extra-collections` | Extra Collections | 128 |
| **Total** |  | **20,711** |

Every card candidate gets its own `cards.card_id`, regardless of repeated source IDs. It links to its exact `source_archive.archive_row_id`; `source_row_number` also records the original row. `source_card_id` remains the original value (nullable, non-unique). The 24 formula-only Master rows are archive-only and have no card ID; they are not inserted in `cards`.

| Source tab and columns | Normalized target |
|---|---|
| Master A:J: Card ID, Year, Card Set, Card No., Player Name, Card Description, Variant, Collecting, Got, Image URL | `source_card_id`, `year`, `card_set`, `card_no`, `player_name`, `card_description`, `variant`, `collecting`, `got`, `image_url` respectively |
| Master K and all additional columns | Preserve at original column positions in archive and `source_fields`; no invented mapping for blank-header K |
| Master R formula cells | Archive only in `raw_cell_data`; no normalized card field |
| Donruss A:E and G:H: Card ID, Year, Card No., Player, Team, Got, Image URL | `source_card_id`, `year`, `card_no`, `player_name`, `team`, `got`, `image_url` |
| Donruss F (`Card`) | Preserve exact original value in archive and `source_fields.F`; **agreed compatibility choice:** continue deriving the application `variant` from F, with the existing `Base` fallback for blank F. Do not claim that this defines the source column’s business meaning |
| Donruss Collecting | **Agreed choice:** no source value exists. Keep it out of imported source data; the application may continue to supply `true` as its existing Donruss default |
| Topps Now A:K: Card ID, Year, Card Set, Card No., Player Name, Print Run, Variant, Date & Description, Collecting, Got, Image | `source_card_id`, `year`, `card_set`, `card_no`, `player_name`, `print_run`, `variant`, `card_description`, `collecting`, `got`, `image_url` |
| Extra Collections A:I: Card ID, Year, Card Set, Card No., Player Name, Variant, Collecting, Got, Image | `source_card_id`, `year`, `card_set`, `card_no`, `player_name`, `variant`, `collecting`, `got`, `image_url` |

For all tabs, retain every original source column in the archive and `source_fields` even when a normalized target is listed. **Approved by the user:** map typed Sheets `TRUE`/`FALSE` booleans directly to PostgreSQL booleans in `collecting`/`got`; preserve each original typed cell in `source_archive.raw_cell_data` and the archived source row. Do not coerce other or missing encodings; leave normalized value null and flag for review. Missing values stay missing/null and are not filled with invented source values. Only Donruss F's `Base` fallback is an application compatibility default, not a value written back to source.

## Orders and order-item mapping

The Orders tab has one header in row 1 and two JSON text records in column A. The import would preserve the exact original JSON strings in `source_archive.raw_payload` and `orders.source_payload_text`, and parse a copy into `orders.source_payload`. It would not serialize parsed JSON over the original text.

| Source | Target / expected result |
|---|---|
| Orders row 2 JSON | One `orders` row linked to archive row `(Orders, 2)`; 5 `order_items`; 0 received and 5 not received |
| Orders row 3 JSON | One `orders` row linked to archive row `(Orders, 3)`; 7 `order_items`; 7 received and 0 not received |
| Original order ID | `orders.source_order_id`; generated `order_record_id` remains the database primary key |
| `cardIds` array | One generated `order_item_id` per entry; zero-based `item_position` preserves array order; original ID in `source_card_id`; no source per-item ID is present, so `source_item_id` remains null |
| `received` array | **Approved by the user:** `order_items.received` is true when the item's source ID occurs in its order's `received` list and false when absent. Preserve the exact original array/text in `orders.source_payload_text` and the source archive; `order_items.source_received_value` stores the matching original ID string when present, otherwise null |

**Order-card match rule (proposed, conservative):** the source Orders objects contain card IDs but no collection key. Search candidate cards by exact original ID across the four collection keys. Set `order_items.card_id` only if that exact ID resolves to one card in exactly one collection. If it resolves to no card, multiple cards, or no unambiguous collection, leave `card_id` null and mark the item/order for review. The dry-run found all 12 current order items have one exact candidate match, zero ambiguous matches, and zero unmatched matches. This is a proposed inference rule, not source-supplied collection metadata; approve it before import. If an order repeats the same card ID, the current `received` ID-list format cannot identify a specific repeated position; stop and flag rather than assign received status by guesswork. No such repetition occurs in the current two records.

## Raw source preservation and generated identity links

For every included source row, `source_archive` should retain exact `source_tab`, one-based `source_row_number`, row kind, a position-preserving source-values array, and typed `raw_cell_data`. Formula text, effective/calculated values, formatted values, number formats, and spreadsheet error objects stay at their original cell coordinates. Preserve blank cells as null array entries rather than shifting columns. Orders JSON text also goes in `raw_payload`.

Measured source exceptions:

- Master: 16,004 formulas in R; 24 formula-only rows at 18,560–18,583; 9 spreadsheet errors at B16383, R16383, E17234, E17305, E17306, E18345, E18346, E18347, and E18410.
- Extra Collections: 100 formula-bearing cells in I on candidate rows; blank source row 22 is archived with its original position.
- Card IDs are present on all 20,711 card candidates. No within-tab duplicate ID groups were found. Across tabs, 1,951 ID values occur in multiple collections (2,025 excess occurrences). Preserve every row; do not impose uniqueness on `source_card_id`.

Insert archive rows first and retain the returned `archive_row_id` keyed by `(snapshot_id, source_tab, source_row_number)`. Insert each card/order with its corresponding archive ID and capture generated `card_id`/`order_record_id`; create item rows with generated `order_item_id` and returned `order_record_id`. The durable audit links are `cards.source_archive_row_id`, `orders.source_archive_row_id`, and `order_items.order_record_id`; use nullable `order_items.card_id` only after the unambiguous matching check. Never derive a database ID from an original ID or row number. Keep a run manifest of returned IDs keyed by source coordinates during the import for reconciliation.

## Pre-import checklist

- [ ] Confirm this saved export is the approved migration snapshot. It has not been freshly compared; user-reported no edits since capture are not an independent comparison.
- [ ] Verify the connection points to the explicitly named separate Neon testing branch, not production; check project and branch identity in the dashboard and connection context without displaying the connection string.
- [ ] Inspect existing database objects and rows before schema/import. Do not assume empty. If schema objects already exist, stop and verify their version/state; never drop or overwrite them.
- [ ] Confirm the six expected tables and constraints match the validated migration on that testing branch.
- [ ] Inspect `collections` seed rows. The migration creates the table but does not seed it. Insert only missing approved keys; if an existing key has an unexpected display name or duplicates cannot be resolved, stop.
- [ ] Approve the trailing-blank omission boundary and the order matching rule above.
- [ ] Keep the application-level Donruss default separate from source values; implement the user-approved typed-boolean and Orders received-membership mappings without coercing other encodings.
- [ ] Use one transaction-scoped, snapshot-identified test import with explicit rollback handling; do not use truncate/reset or production credentials.

## Reconciliation and stop conditions

After an approved test import, verify exactly:

- [ ] `source_snapshots`: 1; `source_archive`: 20,743 with per-tab counts 18,583 / 1,952 / 75 / 130 / 3 and unique original tab/row positions.
- [ ] `cards`: 20,711 with per-collection counts 18,558 / 1,951 / 74 / 128. Every card points to one correct archive row; every original row is represented once; no source ID deduplication occurred.
- [ ] `orders`: 2 linked to Orders rows 2 and 3; `order_items`: 12 with positions 0–4 and 0–6 respectively; 7 received and 5 not received; exact source JSON text unchanged.
- [ ] All 12 current item references resolve under the approved exact-ID/unique-collection rule. Any future missing or multiple match remains unlinked and is reconciled as a review exception.
- [ ] Formula counts/coordinates: 16,104 formula cells, 24 formula-only Master rows, Extra Collections I formulas included; all 9 spreadsheet error coordinates preserved. Master K remains unnormalized and all original cells remain in the archive.
- [ ] One internal blank row (Extra Collections 22) is archived; 37,701 trailing blank grid rows are omitted from database archive but remain in the untouched export.
- [ ] Source status booleans and counts reconcile; Donruss's default does not masquerade as a source value. No constraint failures, unexpected coercions, missing provenance links, or unreviewed parse errors.

Stop before writing if the export structure differs, counts do not match, Orders JSON fails validation, a mapping assumption lacks approval, collection seeds conflict, the database target is uncertain, any order link is ambiguous, or any source row/cell would be discarded. Roll back the test transaction on failure and investigate before retrying. Keep the spreadsheet, saved export, live site, and production database untouched.

## Explicit assumptions and unresolved decisions

- **Agreed per current user instruction:** preserve Donruss F's original `Card` value, keep its current UI compatibility mapping to `variant`, and treat Donruss `collecting=true` as application default rather than source data. Map source `Collecting`/`Got` boolean values directly to PostgreSQL booleans, and derive `order_items.received` by membership in the corresponding order's `received` list while preserving the original source received evidence and exact Orders JSON text.
- **Working assumption requiring approval:** omit trailing blank grid rows from PostgreSQL while retaining the full export; archive every non-empty/formula-bearing row and internal blank row.
- **Proposed rule requiring approval:** infer an item's collection only when exact ID yields one candidate across all collections; otherwise leave its `card_id` null.
- **Still unresolved:** accept the saved snapshot without a fresh comparison; approve duplicate card ID handling for repeated IDs within a future single order; confirm four collection keys/display names if target rows differ.
- Master K's meaning and R's business purpose remain deferred: preserve exact source evidence, do not normalize either without later confirmation.

This manifest is a plan only. It does not implement an importer or perform database writes.
