-- Paiements : déclaration BaridiMob/CCP par référence + file de
-- validation admin. Chaque paiement est une pièce traçable, reliée
-- à sa commande / son don ; l'interface passerelle accueillera plus
-- tard SATIM ou Chargily sans rien réécrire.
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('order','donation','ticket')),
  ref_id UUID NOT NULL,
  method VARCHAR(20) NOT NULL CHECK (method IN ('ccp','cash','cod_cib')),
  bank_ref VARCHAR(64) NOT NULL DEFAULT '',
  amount INTEGER NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','rejected')),
  payer_name VARCHAR(120) NOT NULL DEFAULT '',
  checked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, created_at DESC);
