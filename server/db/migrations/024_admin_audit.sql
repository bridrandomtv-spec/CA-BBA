-- Pack gouvernance : journal d'audit des actions admin sensibles.
-- Chaque geste de pouvoir (émission/annulation/assign de ticket,
-- changement de rôle, gestion des sponsors…) laisse une trace
-- horodatée avec son auteur : personne ne peut dire « le chiffre
-- a été manipulé ».
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_name VARCHAR(120) NOT NULL DEFAULT 'système',
  action VARCHAR(60) NOT NULL,
  target VARCHAR(200) NOT NULL DEFAULT '',
  detail VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_time ON admin_audit_log(created_at DESC);
