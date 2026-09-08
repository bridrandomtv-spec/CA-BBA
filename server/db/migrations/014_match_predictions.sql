-- Jeu de pronostics (« لعبة التوقعات » du README) : l'écran affichait un
-- placeholder statique depuis l'origine. Un pronostic par compte et par
-- match, modifiable jusqu'au coup d'envoi. Le score (50 points par résultat
-- exact) est calculé À LA LECTURE en joignant les matchs terminés — aucun
-- crochet dans le scheduler football, aucune colonne de points à maintenir.

CREATE TABLE IF NOT EXISTS match_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  predicted_home INTEGER NOT NULL CHECK (predicted_home BETWEEN 0 AND 30),
  predicted_away INTEGER NOT NULL CHECK (predicted_away BETWEEN 0 AND 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_match_predictions_match ON match_predictions(match_id);
