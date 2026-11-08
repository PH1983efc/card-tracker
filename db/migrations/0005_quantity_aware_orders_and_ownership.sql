-- Add quantity-aware order tracking and collection ownership.
-- Existing card.got values are preserved as one owned copy of the card's
-- recorded variant. Existing received order items are preserved as quantity 1.

BEGIN;

ALTER TABLE order_items
  ADD COLUMN quantity integer NOT NULL DEFAULT 1
    CHECK (quantity > 0),
  ADD COLUMN received_quantity integer NOT NULL DEFAULT 0
    CHECK (received_quantity >= 0),
  ADD COLUMN received_variant text;

UPDATE order_items
SET received_quantity = CASE WHEN COALESCE(received, false) THEN 1 ELSE 0 END,
    received_variant = CASE
      WHEN COALESCE(received, false) THEN (
        SELECT COALESCE(c.variant, 'Base')
        FROM cards c
        WHERE c.card_id = order_items.card_id
      )
      ELSE NULL
    END;

ALTER TABLE order_items
  ADD CONSTRAINT order_items_received_not_over_quantity
  CHECK (received_quantity <= quantity);

UPDATE order_items SET received = false WHERE received IS NULL;
ALTER TABLE order_items ALTER COLUMN received SET DEFAULT false;
ALTER TABLE order_items ALTER COLUMN received SET NOT NULL;

CREATE TABLE card_ownership (
  ownership_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  card_id bigint NOT NULL REFERENCES cards(card_id) ON DELETE CASCADE,
  variant text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT card_ownership_card_variant_unique UNIQUE (card_id, variant)
);

-- Preserve every card already marked as got.
INSERT INTO card_ownership (card_id, variant, quantity)
SELECT card_id, COALESCE(variant, 'Base'), 1
FROM cards
WHERE COALESCE(got, false) = true
ON CONFLICT (card_id, variant) DO NOTHING;

COMMIT;
