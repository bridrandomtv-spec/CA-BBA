-- « اختيار رجل المباراة » : le vote MVP vivait dans un useState local avec
-- une liste de candidats vide — rien n'était agrégé. Persistance : un vote
-- par compte et par match (modifiable), candidats issus des compositions
-- réelles synchronisées depuis API-Football (match_lineups), jamais d'une
-- liste saisie par le client.

CREATE TABLE IF NOT EXISTS match_mvp_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player_api_id INTEGER NOT NULL,
  -- Nom figé au moment du vote : l'affichage ne dépend pas d'une
  -- resynchronisation ultérieure des compositions.
  player_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_mvp_votes_match ON match_mvp_votes(match_id);
