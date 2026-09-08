-- « عدسة الجماهير » : les photos uploadées vers R2 vivaient dans un useState
-- LOCAL — un rechargement vidait la galerie pendant que les octets restaient
-- orphelines dans le bucket. Une publication référence un media_asset déjà
-- validé (presign → PUT → complete), et les likes passent en table de
-- jointure (idempotent, compteur exact, un like par utilisateur).

CREATE TABLE IF NOT EXISTS fan_gallery_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNIQUE : une image uploadée ne peut être publiée qu'une fois. CASCADE :
  -- supprimer le média (purge admin, RGPD) retire la publication.
  media_id UUID NOT NULL UNIQUE REFERENCES media_assets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption VARCHAR(500) NOT NULL DEFAULT 'من عدسة الجماهير 🟡⚫',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fan_gallery_created ON fan_gallery_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS fan_gallery_likes (
  post_id UUID NOT NULL REFERENCES fan_gallery_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);
