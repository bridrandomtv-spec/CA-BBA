-- Stockage objet Cloudflare R2.
-- PostgreSQL conserve uniquement les métadonnées et la clé objet ; les octets
-- ne transitent jamais par Express et ne sont donc pas limités par express.json().

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('image','video','audio')),
  status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','uploaded')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_owner_created ON media_assets(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_pending ON media_assets(status, created_at)
  WHERE status = 'pending';
