-- Sondages (« استطلاعات ») : l'écran FanPolls n'avait AUCUN backend.
--  - un vote par compte et par sondage (PK (poll_id, user_id)) : modifiable
--    (upsert), jamais dupliqué ;
--  - options en table enfant avec UNIQUE(poll_id, label) ;
--  - fermeture douce (status + closed_at) : résultats lisibles 30 jours.

CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question VARCHAR(500) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  -- SET NULL : un admin anonymisé (RGPD) ne supprime pas ses sondages.
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_polls_status_created ON polls(status, created_at DESC);

CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  label VARCHAR(200) NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  UNIQUE (poll_id, label)
);

CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (poll_id, user_id)
);
