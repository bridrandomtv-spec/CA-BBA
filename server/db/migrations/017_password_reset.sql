-- Récupération de mot de passe par email (fonctionnalité absente du code
-- d'origine : un supporter qui oubliait son mot de passe ne pouvait PAS le
-- récupérer — seule une intervention SQL en base le permettait).
--
-- Modèle classique et sûr :
--  - le jeton (256 bits aléatoires) n'est JAMAIS stocké en clair : seule son
--    empreinte SHA-256 l'est — un vol de la base ne révèle aucun lien de
--    réinitialisation utilisable ;
--  - expiration courte (30 minutes, posée par la route) ;
--  - usage unique (used_at) ;
--  - CASCADE : la suppression/anonymisation RGPD du compte emporte ses jetons.

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recherche des jetons actifs d'un compte (invalidation des anciens liens).
CREATE INDEX IF NOT EXISTS idx_password_reset_user_active
  ON password_reset_tokens(user_id) WHERE used_at IS NULL;

-- Purge éventuelle des jetons expirés.
CREATE INDEX IF NOT EXISTS idx_password_reset_expires
  ON password_reset_tokens(expires_at);
