-- Pack sponsors : les partenaires du club financent la plateforme.
-- Logos par URL (hébergés où le club veut), ordre et activation gérés
-- depuis le panel ; affichage public sur l'accueil.
CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  url VARCHAR(500) NOT NULL DEFAULT '',
  logo_url VARCHAR(500) NOT NULL,
  position INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sponsors_order ON sponsors(position, created_at);
