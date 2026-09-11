-- وفاء الجراد : grand livre des points de fidélité.
-- Chaque gain est une ligne (jamais un solde écrasé) : traçable
-- comme une pièce comptable. Sources : scan à la porte, commande
-- confirmée, pronostic juste, geste admin.
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason VARCHAR(60) NOT NULL,
  ref VARCHAR(120) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_user ON loyalty_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loyalty_top ON loyalty_ledger(delta);
