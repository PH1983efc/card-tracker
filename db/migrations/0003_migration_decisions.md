# Migration decisions

This note reviews `0002_migration_mapping_plan.md` against the saved export snapshot and current repository behavior. The export remains a dated snapshot; no fresh Google Sheets comparison has been performed. The type findings below were read locally from the export's typed cell data. No card records, personal data, or cell contents are reproduced.

## Proposed decisions

1. **Master K — defer meaning; preserve position.** Keep every K cell at its original column coordinate in the source archive and source-field payload. Do not assign a semantic field until the owner confirms what the blank-header column represents. This interpretation can safely be deferred because exact values and coordinates remain archived.

2. **Master R — archive only.** Preserve the formula text, effective/calculated value (including the spreadsheet error object), formatted value, and original row/column coordinate in the cell archive. Do not map R to a normalized card field. Formula-only rows remain archive-only and reviewable, not cards. This semantic question can be deferred while the raw evidence is retained.

3. **Donruss F (`Card`) — do not normalize to `variant` yet.** The repository's current parser does read F into the UI's `variant` property (with a `Base` fallback), so this is existing application behavior. However, the source header says `Card`; that behavior alone does not establish the intended business meaning. Preserve F in `source_fields` and the complete archive. Before normalized import, decide whether to preserve the current UI mapping as compatibility behavior or introduce a separately named field. Do not silently reinterpret it.

4. **Status values — approved conversions with raw-source preservation.**

   - In the export, Master H (`Collecting`) has 18,558 typed boolean cells: 2,214 `true`, 16,344 `false`; Master I (`Got`) has 18,558: 1,334 `true`, 17,224 `false`.
   - Donruss G (`Got`) has 1,951 typed booleans: 710 `true`, 1,241 `false`. There is no Donruss `Collecting` column; current code sets `collecting: true` for every parsed Donruss row.
   - Topps Now I (`Collecting`) has 74 typed booleans: 14 `true`, 60 `false`; J (`Got`) has 74: 11 `true`, 63 `false`.
   - Extra Collections G (`Collecting`) has 128 typed booleans, all `true`; H (`Got`) has 128: 81 `true`, 47 `false`.
   - Current `useCards.ts` converts textual values by trimming and uppercasing, then considers only the string `TRUE` true; other/empty strings become false. In this export, the source cells are actual boolean values, not strings. **Approved conversion:** map typed Sheets `boolValue: true/false` directly to PostgreSQL `boolean` values in `collecting` and `got`; preserve each original typed cell in `source_archive.raw_cell_data` and the source row. For other encodings or missing values, do not coerce silently—retain raw data and flag for review. For Donruss `collecting`, preserve current application behavior as a derived default (`true`) only if the product owner confirms it; it is not a source value and must not be represented as one.
   - Orders JSON stores `received` as an array of card-ID strings, not per-item booleans. The two snapshot records have 0 and 7 received IDs respectively, across 5 and 7 `cardIds`. Current Orders UI tests `order.received.includes(cardId)` and toggles membership. **Approved normalized conversion:** each order item's `received` is true exactly when its source card ID is present in that order's `received` array, and false when absent. Preserve the original `received` array and exact Orders JSON text in the order payload/archive. Store the original per-item source evidence in `order_items.source_received_value` (the original matching ID string when present; null when absent). If duplicate card IDs occur within one order, this membership representation cannot distinguish which duplicate instance is received; preserve positions/raw JSON and resolve that behavior before normalization.

5. **Card IDs — retain every eligible source row.** Never deduplicate by source card ID. Give each qualifying source row its own generated `cards.card_id`, keep original ID nullable/non-unique, and retain exact archive-row provenance. Missing IDs do not disqualify an otherwise eligible card. An order item may receive a `card_id` foreign key only when the agreed matching rule produces exactly one intended card. Missing, duplicate, or cross-collection ambiguous matches remain unlinked (`card_id` null), with source ID and item position preserved. This operational rule is required before normalized order-item links are imported; any global choice of duplicate-ID resolution policy can be deferred because the safe default is no link.

6. **Blank rows — archive meaningful rows; retain the full snapshot.** Keep the original export unchanged as the full snapshot. In the database archive, include all non-empty rows and all formula-bearing rows, plus internal blank rows within the captured data area (including Extra Collections source row 22). Preserve each original one-based row number; never renumber/compress rows after filtering. Rows with formulas but no card data are archive-only. Treat the large trailing blank grid area separately: do not import every trailing empty grid row by default. The migration owner must approve the definition of the captured data boundary and whether trailing blank rows need archival; if full-grid archival is chosen, archive every captured row. Until approved, retain the full export file as the complete snapshot, so omitted trailing blanks are not lost from the evidence. The boundary decision is required before final archive counts are fixed, but it does not affect card identity.

7. **Fresh source comparison — required before import.** Approve a new read-only export of the same five tabs using the existing exporter, writing a separate timestamped file. Then produce a comparison report against the current snapshot covering tab names/grid dimensions, headers, populated/formula/error cells by coordinate, blank-row positions in the chosen data area, and Orders JSON text changes. Do not overwrite either export and do not import until discrepancies are explained and the new snapshot is explicitly selected. No re-export was run for this document.

## Decisions that can wait vs. decisions needed for import

**Can safely be deferred while raw archive fidelity is maintained:** the business meanings of Master K and R; whether Donruss F deserves a separate normalized field; interpreting any unknown source columns; the trailing-blank archive policy (provided the full export remains preserved and the importer does not claim full-grid row reconciliation); and a policy for resolving ambiguous duplicate card IDs (default is leave links null).

**Resolve before normalized import:** select and compare a fresh source snapshot; define eligible card-row classification (including missing-ID rows and formula-only rows); preserve the approved boolean conversions and keep Donruss's derived `collecting=true` behavior separate from source data; settle whether Donruss F's current UI mapping must be preserved; define the data-row/archive boundary and reconciliation counts; validate Orders structure and duplicate card-ID behavior before setting per-item `received`; and confirm the exact collection-scoped card matching rule. Raw archive rows may be loaded first only if separately approved, with no normalized import implied.

## Review questions

- Should Donruss `collecting=true` remain a derived application default, and should it be stored in `cards.collecting` despite not coming from a source cell?
- Should Donruss F continue feeding the UI `variant` field for compatibility, or be held outside normalized card fields until a product decision?
- How should Orders received status behave if the same card ID appears more than once in a single order?
- What exact row boundary should count as the archive set, and should trailing empty grid rows be archived in PostgreSQL or only retained in the unchanged export?
- Which fresh export should be designated the migration snapshot after its comparison report is reviewed?

No importer was implemented or run. No export, source sheet, application code, schema, database, live site, or deployment was modified or accessed remotely.
