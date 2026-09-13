-- 031_sponsors_cover_video.sql
-- Chaque partenaire gagne une image de couverture et une vidéo de promo
-- (YouTube) : la vitrine شركاء النادي devient un écran de vente complet.
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS cover_url TEXT NOT NULL DEFAULT '';
ALTER TABLE sponsors ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';
