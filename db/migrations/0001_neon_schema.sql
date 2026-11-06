-- Initial Neon/PostgreSQL schema for the Everton Card Tracker.
--
-- This file only defines tables and indexes. It does not seed collection rows,
-- import Sheets data, or connect to a database. Apply only after the target
-- database has been inspected and approved. The migration is transactional;
-- existing objects cause an error and are not replaced.

BEGIN;

CREATE TABLE collections (
    collection_key text PRIMARY KEY,
    display_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- A snapshot groups a complete, read-only capture of the source spreadsheet.
-- Keep multiple snapshots so later imports/reconciliations do not overwrite
-- evidence from an earlier capture.
CREATE TABLE source_snapshots (
    snapshot_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_description text NOT NULL,
    captured_at timestamptz NOT NULL DEFAULT now(),
    source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT source_snapshots_metadata_is_object
        CHECK (jsonb_typeof(source_metadata) = 'object')
);

-- One record per source row, including headers, blank rows inside the captured
-- range, malformed records, and rows that cannot be normalized. raw_values
-- stores the source row as an array; raw_cell_data can retain typed cell data
-- such as formulas and number formats; raw_payload can preserve exact JSON text
-- from the Orders sheet when present.
CREATE TABLE source_archive (
    archive_row_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    snapshot_id bigint NOT NULL REFERENCES source_snapshots(snapshot_id),
    source_tab text NOT NULL,
    source_row_number integer NOT NULL CHECK (source_row_number > 0),
    row_kind text NOT NULL DEFAULT 'data',
    raw_values jsonb NOT NULL,
    raw_cell_data jsonb NOT NULL DEFAULT '[]'::jsonb,
    raw_payload text,
    processing_status text NOT NULL DEFAULT 'pending',
    processing_error text,
    archived_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT source_archive_tab_is_known
        CHECK (source_tab IN ('Master', 'Donruss', 'Topps Now', 'Extra Collections', 'Orders')),
    CONSTRAINT source_archive_row_kind_is_known
        CHECK (row_kind IN ('header', 'data', 'blank', 'other')),
    CONSTRAINT source_archive_status_is_known
        CHECK (processing_status IN ('pending', 'imported', 'unmapped', 'malformed', 'reviewed')),
    CONSTRAINT source_archive_raw_values_is_array
        CHECK (jsonb_typeof(raw_values) = 'array'),
    CONSTRAINT source_archive_raw_cell_data_is_array
        CHECK (jsonb_typeof(raw_cell_data) = 'array'),
    CONSTRAINT source_archive_snapshot_tab_row_unique
        UNIQUE (snapshot_id, source_tab, source_row_number)
);

CREATE INDEX source_archive_status_idx
    ON source_archive (processing_status, source_tab);

CREATE TABLE cards (
    -- Database identity is independent of the source card ID. Every imported
    -- card row, including rows with duplicate or missing source IDs, can have
    -- its own stable primary key.
    card_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    collection_key text NOT NULL REFERENCES collections(collection_key),
    source_archive_row_id bigint NOT NULL UNIQUE
        REFERENCES source_archive(archive_row_id),
    source_row_number integer NOT NULL CHECK (source_row_number > 0),
    source_card_id text,
    year text,
    card_set text,
    card_no text,
    player_name text,
    card_description text,
    variant text,
    collecting boolean,
    got boolean,
    image_url text,
    team text,
    print_run text,
    -- Retains source-specific and future columns (including Donruss Team and
    -- Topps Now Print Run) without requiring schema changes for each column.
    source_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT cards_source_fields_is_object
        CHECK (jsonb_typeof(source_fields) = 'object')
);

-- Deliberately no uniqueness constraint on source_card_id: duplicate IDs,
-- including duplicates within a collection, must not discard source rows.
CREATE INDEX cards_collection_lookup_idx
    ON cards (collection_key, source_card_id);

CREATE TABLE orders (
    -- Internal key allows duplicate, missing, or malformed source order IDs to
    -- remain represented without using them as database identity.
    order_record_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_archive_row_id bigint NOT NULL UNIQUE
        REFERENCES source_archive(archive_row_id),
    source_order_id text,
    seller text,
    order_date text,
    price text,
    source_payload jsonb NOT NULL,
    source_payload_text text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT orders_source_payload_is_object
        CHECK (jsonb_typeof(source_payload) = 'object')
);

CREATE INDEX orders_source_id_idx ON orders (source_order_id);

CREATE TABLE order_items (
    -- Each source cardIds entry gets its own row and internal identity. The
    -- source item ID is nullable because the current sheet format stores card
    -- IDs as strings and has no distinct per-item ID field.
    order_item_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_record_id bigint NOT NULL
        REFERENCES orders(order_record_id) ON DELETE CASCADE,
    source_item_id text,
    item_position integer NOT NULL CHECK (item_position >= 0),
    source_card_id text,
    -- Set only when the import can resolve exactly one card. Null preserves
    -- manual IDs and ambiguous duplicate IDs without linking the wrong card.
    card_id bigint REFERENCES cards(card_id) ON DELETE RESTRICT,
    received boolean,
    source_received_value jsonb,
    source_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT order_items_position_unique
        UNIQUE (order_record_id, item_position),
    CONSTRAINT order_items_source_fields_is_object
        CHECK (jsonb_typeof(source_fields) = 'object')
);

CREATE INDEX order_items_card_lookup_idx
    ON order_items (card_id);
CREATE INDEX order_items_source_card_id_idx
    ON order_items (source_card_id);


COMMIT;
