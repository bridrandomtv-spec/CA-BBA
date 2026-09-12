-- Fidélité du Jarrad : ledger de points (chaque point a sa raison
-- et sa pièce : scan à la porte, commande, pronostic, gratification).
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  reason VARCHAR(60) NOT NULL,
  ref VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_ledger(user_id, created_at DESC);
