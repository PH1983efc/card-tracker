-- Allow website-created orders that do not originate from a Sheets archive row.
ALTER TABLE orders
  ALTER COLUMN source_archive_row_id DROP NOT NULL;
