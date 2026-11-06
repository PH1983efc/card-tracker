# Saved export migration dry-run report

## Scope and method

This is a no-write classification of the saved `google-sheets-grid-v1` snapshot exported at `2026-10-29T12:51:45.079Z`. The JSON parsed successfully. It contains the five expected tabs with all captured grid rows and columns. No Google Sheets or Neon connection, SQL, or import was used. Values, card identifiers, and order payloads were processed locally for counts only and are not reproduced here.

Classification used source positions and the original grid. A card candidate is a populated row in one of the four card tabs with a value in that tab's mapped card columns (excluding a formula-only cell). An archive-only row is a populated/formula-bearing row that is not a card candidate. Blank rows between row 1 and the last entered/formula cell are retained. Trailing grid-only blanks are omitted from the proposed database archive but remain in the unchanged full export.

## Tab row classification

| Tab | Grid | Last non-empty/formula row | Card candidates | Populated archive-only rows | Internal blank rows | Trailing blank rows omitted |
|---|---:|---:|---:|---:|---:|---:|
| Master | 53,071 × 26 | 18,583 | 18,558 | 24 formula-only | 0 | 34,488 |
| Donruss | 2,376 × 22 | 1,952 | 1,951 | 0 | 0 | 424 |
| Topps Now | 999 × 26 | 75 | 74 | 0 | 0 | 924 |
| Extra Collections | 998 × 24 | 130 | 128 | 0 | 1 (row 22) | 868 |
| Orders | 1,000 × 26 | 3 | 0 | 2 order records (rows 2–3) | 0 | 997 |

The archive-only Master rows are 18,560–18,583. They contain formulas in R but no card-column data; they must not become cards. Extra Collections row 22 is blank, with populated rows immediately before and after. The Extra Collections formula cells are in column I and occur on card candidate rows, so they do not add archive-only rows.

## Card ID counts

| Collection | Candidate rows | Missing IDs on card candidates | Duplicate ID groups within tab | Excess duplicate rows within tab |
|---|---:|---:|---:|---:|
| Master | 18,558 | 0 | 0 | 0 |
| Donruss | 1,951 | 0 | 0 | 0 |
| Topps Now | 74 | 0 | 0 | 0 |
| Extra Collections | 128 | 0 | 0 | 0 |
| **Total** | **20,711** | **0** | **0** | **0** |

The 24 formula-only Master rows have no original card ID, but are not eligible card rows. Across collections, 1,951 original ID values appear in more than one collection, with 2,025 excess occurrences overall; there are no within-tab duplicate groups. Do not deduplicate these rows. Each candidate should receive its own generated database ID and source-row link.

## Orders inspection

Both populated Orders cells (source rows 2 and 3, column A) contain valid JSON objects with the expected application fields and array types. Exact source cell text is retained in the export; this dry run did not rewrite it.

| Orders source row | Card ID entries | Received ID entries | Duplicate IDs within order | Received IDs absent from that order's card list | Snapshot card-link results by exact ID |
|---|---:|---:|---:|---:|---|
| 2 | 5 | 0 | 0 | 0 | 5 unique, 0 ambiguous, 0 unmatched |
| 3 | 7 | 7 | 0 | 0 | 7 unique, 0 ambiguous, 0 unmatched |
| **Total** | **12** | **7** | **0** | **0** | **12 unique, 0 ambiguous, 0 unmatched** |

No repeated card ID occurs inside either order, and all seven received IDs are represented in that order's `cardIds` list. Thus received membership is unambiguous for these two records. The 12 order IDs each match exactly one candidate card by exact ID in this snapshot. The policy for collection-scoped matching should still be confirmed before setting foreign keys; retain unmatched or ambiguous references without linking if future data produces them.

## Status encodings

All source `Collecting` and `Got` cells counted below are typed Sheets booleans, not text strings. These are observed source encodings; the original typed cells should remain archived.

| Source column | True | False | Other/missing among counted rows |
|---|---:|---:|---:|
| Master H `Collecting` | 2,214 | 16,344 | 0 |
| Master I `Got` | 1,334 | 17,224 | 0 |
| Donruss G `Got` | 710 | 1,241 | 0 |
| Topps Now I `Collecting` | 14 | 60 | 0 |
| Topps Now J `Got` | 11 | 63 | 0 |
| Extra Collections G `Collecting` | 128 | 0 | 0 |
| Extra Collections H `Got` | 81 | 47 | 0 |

Donruss has no source `Collecting` column. Current application code supplies `true` as a default; this is an application default, not imported source data, and needs owner approval before storing it as normalized status. Orders `received` is an array of card-ID strings, not booleans: there are seven received-ID entries, all matched within their respective order in this snapshot. Proposed per-item boolean conversion is membership in that array, preserving the original JSON text and array in the archive. Duplicate IDs within a future order would make that membership interpretation ambiguous.

## Formulae, errors, and blank rows

- Master has 16,004 formula-bearing cells, all in column R. 15,980 occur on card candidate rows; 24 are formula-only rows 18,560–18,583. Preserve formula text, effective value, formatted value, error details, and coordinates; do not normalize R as a card field.
- Extra Collections has 100 formula-bearing cells in column I on candidate rows. Preserve the formula and cell metadata at their original coordinates; do not infer additional semantics from the formula.
- The export contains nine spreadsheet error cells at Master coordinates B16383, R16383, E17234, E17305, E17306, E18345, E18346, E18347, and E18410. Preserve the error objects and coordinates; do not coerce errors into ordinary values.
- Extra Collections row 22 is the only internal blank row. All other tabs have no blank rows before their last non-empty/formula row.
- Under the proposed archive boundary, retain headers, every populated/formula-bearing row, and the internal blank row. Proposed retained `source_archive` rows: Master 18,583; Donruss 1,952; Topps Now 75; Extra Collections 130; Orders 3; total **20,743**. Omit **37,701** trailing blank grid rows from PostgreSQL while keeping the unchanged export as the complete captured-grid snapshot.

## Reconciliation totals for a later test import

These totals define the current dry-run baseline under the stated row boundary:

- Five headers + 20,711 card candidates + 24 archive-only formula rows + one internal blank row + two Orders records = **20,743 archived source rows**.
- Card candidates by collection total **20,711**; preserve all 20,711 as distinct rows, including repeated IDs across collections.
- Orders records **2**; order items **12**; received-ID entries **7**; current within-order duplicate/unmatched received counts **0**.
- Formula-bearing cells **16,104** (Master 16,004 + Extra Collections 100); formula-only rows **24**; spreadsheet error cells **9**.
- Trailing blank rows omitted from database archive **37,701**, still present in the saved source export.

A future import must reconcile each total and each row's `(tab, original row number)` provenance, all 12 order-item positions and received states, formula/error coordinates, and generated database IDs back to source archive rows. Any changed baseline should stop the import for investigation.

## Unresolved decisions and recommendation

Measured facts above are from this saved export only; they do not establish that the snapshot is current. The user reports no spreadsheet edits since export, but there has been no independent fresh-source comparison. Donruss F currently feeds the UI's `variant` property, but whether to retain that compatibility mapping is not approved. Donruss's `collecting=true` default, the Orders matching scope, and how to handle duplicate card IDs within a future order also remain decisions. Master K's meaning is unknown and R remains archive-only. These meanings can be deferred if raw cells and coordinates are preserved.

The safe next step is to review and approve these unresolved mapping choices, then prepare an importer dry-run manifest and reconciliation output from this same snapshot. Before any database write, independently verify the Neon connection targets the separate testing branch and inspect its existing tables/data. Do not execute the import until that target and the dry-run counts are explicitly approved.
