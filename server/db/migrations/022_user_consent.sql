-- Pack crédibilité : preuve horodatée du consentement (loi 18-07).
-- Renseigné à l'inscription quand le client transmet consent=true.
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ;
