-- 030_donation_declarations.sql
-- تصريحات الأنصار لصندوق الدعم : file d'attente déclarative.
-- Le supporter qui a réellement viré (CCP / BaridiMob) déclare son transfert ;
-- l'admin confirme après pointage du compte, et le don est recopié dans
-- support_donations DANS LA MÊME TRANSACTION — le registre reste l'unique
-- source de vérité du montant collecté (jamais de saisie fantôme).
CREATE TABLE IF NOT EXISTS donation_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES support_campaigns(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  donor_name VARCHAR(200) NOT NULL DEFAULT 'متبرع مجهول',
  amount_dzd INTEGER NOT NULL CHECK (amount_dzd > 0 AND amount_dzd <= 100000000),
  method VARCHAR(20) NOT NULL DEFAULT 'ccp',
  reference VARCHAR(120) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_donation_declarations_status
  ON donation_declarations(status, created_at DESC);
