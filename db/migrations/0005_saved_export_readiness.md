# Saved export readiness for a Neon test import

## Assessment

The saved export is readable JSON in `google-sheets-grid-v1` format and contains all five expected tabs. Its row counts match the captured grid dimensions:

| Tab | Captured rows × columns |
|---|---:|
| Master | 53,071 × 26 |
| Donruss | 2,376 × 22 |
| Topps Now | 999 × 26 |
| Extra Collections | 998 × 24 |
| Orders | 1,000 × 26 |

The export contains typed cell data, including entered values, calculated values, formatted values, and formula details where present. It is enough to prepare a **dry-run import specification and classification report**. It is not yet enough to safely run the normalized import: the snapshot has not been compared with a fresh source read, and several mapping decisions remain open. The user reports no spreadsheet edits since this export; that is useful context but is not an independently verified source comparison.

## Decisions already established

The schema and planning documents establish these preservation requirements:

- Keep the source archive and original tab/row provenance; retain original cells and formulas rather than relying only on normalized fields.
- Give each imported card row a generated database identity. Preserve missing and duplicate original card IDs without deduplicating; link an order item only when its card match is unambiguous.
- Keep formula-only Master rows archive-only rather than turning them into ordinary cards.
- Preserve Orders JSON text as well as a parsed representation; preserve order/item positions, original IDs, and received information.
- Use the separate Neon test branch first and inspect it before applying/importing; do not assume it is empty.

The current decisions document also proposes that typed Sheets booleans map directly to PostgreSQL booleans and that Orders received status is derived by membership in the order's received-ID list. These are documented proposals, not confirmed owner approvals.

## Questions still open before normalized import

- Confirm the proposed status conversions, including Donruss `collecting = true`, which is application behavior rather than a source column.
- Decide how Donruss F (`Card`) should feed the existing UI. Current code uses it as `variant`, but the source meaning is not established. Original values can be preserved regardless.
- Decide how received status should work if an order contains the same card ID more than once.
- Approve the data-row archive boundary, especially whether trailing blank grid rows are omitted from PostgreSQL while retained in the unchanged snapshot.
- Define which eligible rows become cards, including rows with missing IDs, and confirm the collection-scoped match rule for order items.
- Select this saved snapshot explicitly or require a fresh comparison. No fresh comparison report exists, so the file’s contents should remain labelled as a dated snapshot.

Master K's meaning and R's business purpose can remain deferred if the importer archives their exact positions, raw values, formulas, evaluated/formatted values, and errors and does not normalize them. Unknown fields can likewise remain in the archive/source fields.

## Safest next step

Prepare a no-write dry-run against this export: validate its structure, classify source rows, count card candidates and archive-only rows, inspect duplicate/missing IDs and Orders item matching outcomes, and produce reconciliation totals without connecting to Neon. Resolve the open normalization questions from that report. Before any test import, verify in Neon that the connection targets the separate testing branch, inspect existing objects/data, and confirm collection seed handling (the schema defines `collections` but does not seed its rows). Only then authorize a transaction-scoped test import, followed by count and provenance reconciliation. Keep the source export, spreadsheet, and live site unchanged.

This report was prepared from local files only. No Sheets/Neon access, SQL, import, or application change occurred.
