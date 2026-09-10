-- صندوق دعم النادي : campagne réelle et administrable (le bloc de
-- l'accueil était un placeholder mort hérité du code d'origine).
-- Pas de paiement en ligne (inexistant pour ce contexte en Algérie) :
-- l'encaissement reste physique (espèces / CCP / virement) et l'admin
-- consigne chaque don ; le montant collecté est TOUJOURS la somme du
-- registre — aucune dérive possible entre affichage et comptabilité.

CREATE TABLE IF NOT EXISTS support_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  goal_dzd INTEGER NOT NULL DEFAULT 0 CHECK (goal_dzd >= 0),
  bank_info TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES support_campaigns(id) ON DELETE CASCADE,
  amount_dzd INTEGER NOT NULL CHECK (amount_dzd > 0 AND amount_dzd <= 100000000),
  donor_name VARCHAR(100) NOT NULL DEFAULT 'متبرع مجهول',
  method VARCHAR(20) NOT NULL DEFAULT 'cash'
    CHECK (method IN ('cash', 'ccp', 'transfer', 'other')),
  note VARCHAR(500) NOT NULL DEFAULT '',
  recorded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_donations_campaign
  ON support_donations(campaign_id, created_at DESC);
