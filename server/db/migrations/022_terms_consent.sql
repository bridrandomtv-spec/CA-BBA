-- Pack crédibilité : trace du consentement aux conditions
-- d'utilisation et à la politique de confidentialité (loi 18-07).
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
