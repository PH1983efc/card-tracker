-- Rename the user-facing collection label only.
-- Keep collection_key='master' and source_archive.source_tab='Master' unchanged.
BEGIN;

UPDATE collections
SET display_name = 'Everton Cards'
WHERE collection_key = 'master'
  AND display_name <> 'Everton Cards';

COMMIT;
