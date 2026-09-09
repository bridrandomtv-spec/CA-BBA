-- Repli de la galerie sans Cloudflare R2 (retour terrain démo :
-- « Media storage is not configured » bloquait totalement عدسة الجماهير).
-- Une publication porte désormais SOIT un média R2 (media_id), SOIT une
-- image compressée en data-URL (image_data, ≤ 500 Ko — même plafond que la
-- communauté). Avec R2 configuré, le client l'utilise en priorité ; sans
-- R2, la galerie reste utilisable au lieu d'afficher une erreur.
-- (UNIQUE(media_id) tolère plusieurs NULL : pas de conflit entre posts
-- data-URL.)

ALTER TABLE fan_gallery_posts ALTER COLUMN media_id DROP NOT NULL;

ALTER TABLE fan_gallery_posts ADD COLUMN IF NOT EXISTS image_data TEXT;

ALTER TABLE fan_gallery_posts DROP CONSTRAINT IF EXISTS fan_gallery_one_source;
ALTER TABLE fan_gallery_posts
  ADD CONSTRAINT fan_gallery_one_source
  CHECK (media_id IS NOT NULL OR image_data IS NOT NULL);
