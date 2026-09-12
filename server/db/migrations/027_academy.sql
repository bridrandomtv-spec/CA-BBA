-- مدرسة الكرة : inscriptions en ligne des jeunes (U7 → U17).
-- Service aux familles + vivier du club : aucun club de la division
-- ne possède ce guichet numérique.
CREATE TABLE IF NOT EXISTS academy_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_name VARCHAR(120) NOT NULL,
  birth_year INTEGER NOT NULL CHECK (birth_year BETWEEN 2005 AND 2025),
  category VARCHAR(10) NOT NULL CHECK (category IN ('U7','U9','U11','U13','U15','U17')),
  parent_name VARCHAR(120) NOT NULL,
  parent_phone VARCHAR(30) NOT NULL,
  parent_email VARCHAR(254) NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','waitlist','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academy_status ON academy_registrations(status, created_at DESC);
