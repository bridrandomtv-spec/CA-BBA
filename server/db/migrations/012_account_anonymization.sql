-- RGPD (droit à l'effacement) : la suppression de compte ANONYMISE la ligne
-- users au lieu de la supprimer. Deux raisons :
--   1. `orders.user_id` est en ON DELETE RESTRICT (migration 004 : « une
--      commande est une pièce comptable ») — un DELETE échouerait dès le
--      premier achat ;
--   2. les obligations comptables imposent de conserver les commandes, mais
--      rien n'impose de conserver l'identité de leur auteur.
-- `deleted_at` marque le compte comme supprimé sans casser l'intégrité.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN users.deleted_at IS
  'Date d''anonymisation du compte (RGPD). NULL = compte actif. Les commandes restent liées pour raisons comptables.';

-- Les comptes anonymisés sont exclus des recherches courantes : index partiel.
CREATE INDEX IF NOT EXISTS idx_users_active ON users(created_at DESC)
  WHERE deleted_at IS NULL;
