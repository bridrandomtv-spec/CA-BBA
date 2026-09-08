-- Correctif d'audit n°7 : révocation des sessions.
-- Un jeton volé restait valide 7 jours sans aucun moyen de l'invalider.
-- `token_version` est signé dans le JWT (claim `tv`) et relu en base à chaque
-- requête : incrémenter la colonne révoque immédiatement toutes les sessions
-- existantes du compte (logout, suppression de compte, compte compromis).
-- Les jetons émis avant cette migration (sans claim `tv`) sont acceptés
-- contre la version 1 par requireAuth, le temps qu'ils expirent.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1;
