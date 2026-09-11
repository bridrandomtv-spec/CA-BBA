-- مراقبة التذاكر الإلكترونية عند أبواب الملعب (retour terrain :
-- « juste un mobile » par agent, son OK / son rejet).
-- Nouveau rôle 'scanner' pour les agents de porte (pas admin, pas
-- supporter) : droit unique de scanner et consulter les compteurs.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'scanner'));

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  code VARCHAR(24) NOT NULL UNIQUE,
  holder_name VARCHAR(100) NOT NULL DEFAULT '',
  category VARCHAR(40) NOT NULL DEFAULT 'virage'
    CHECK (category IN ('virage', 'tribune', 'vip')),
  price_dzd INTEGER NOT NULL DEFAULT 0 CHECK (price_dzd >= 0),
  status VARCHAR(12) NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'used', 'cancelled')),
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  used_gate VARCHAR(40),
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_match ON tickets(match_id, status);

-- Journal de CHAQUE passage (même rejeté) : preuve anti-fraude et
-- comptage par porte en temps réel.
CREATE TABLE IF NOT EXISTS ticket_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  raw_code VARCHAR(64) NOT NULL,
  result VARCHAR(20) NOT NULL
    CHECK (result IN ('ok', 'used', 'invalid', 'cancelled')),
  gate VARCHAR(40) NOT NULL DEFAULT '',
  scanner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_time ON ticket_scans(created_at DESC);
