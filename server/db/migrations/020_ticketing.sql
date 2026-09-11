-- Billetterie électronique : contrôle des entrées au stade par mobile.
-- Phase 1 : émission par le club + scanneur (sons OK/rejet) + journal des
-- scans. Le QR encode un jeton aléatoire à usage unique vérifié serveur :
-- une capture d'écran rescannee hurle « déjà utilisée » avec l'heure du
-- premier passage. Phase 2 (devis) : vente en ligne au supporter.

-- Rôle « scanner » : agent de porte, unique droit = scanner.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'scanner'));

CREATE TABLE IF NOT EXISTS match_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL UNIQUE,
  holder_name VARCHAR(100) NOT NULL DEFAULT '',
  category VARCHAR(50) NOT NULL DEFAULT 'tribune',
  price_dzd INTEGER NOT NULL DEFAULT 0 CHECK (price_dzd >= 0),
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'used', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tickets_match ON match_tickets(match_id);
CREATE INDEX IF NOT EXISTS idx_tickets_owner ON match_tickets(owner_id);

CREATE TABLE IF NOT EXISTS ticket_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES match_tickets(id) ON DELETE CASCADE,
  code VARCHAR(64) NOT NULL,
  gate VARCHAR(50) NOT NULL DEFAULT '',
  scanner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  result VARCHAR(20) NOT NULL
    CHECK (result IN ('ok', 'already_used', 'invalid', 'cancelled', 'wrong_match')),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scans_recent ON ticket_scans(scanned_at DESC);
