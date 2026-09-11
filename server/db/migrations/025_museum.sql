-- المتحف : mémoire officielle du club (titres, légendes, événements).
-- Contenu géré depuis le panel ; affichage public en frise chronologique.
CREATE TABLE IF NOT EXISTS museum_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  kind VARCHAR(20) NOT NULL DEFAULT 'event'
    CHECK (kind IN ('title', 'legend', 'event')),
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_url VARCHAR(500) NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_museum_order ON museum_entries(year DESC, position);
