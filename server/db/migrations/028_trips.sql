-- تنقلات الأنصار : bus organisés pour les matchs à l'extérieur.
-- La vie du fan-club digitalisée : trajet, point de rendez-vous,
-- prix, places limitées, inscription en un tap.
CREATE TABLE IF NOT EXISTS away_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  meeting_point VARCHAR(200) NOT NULL,
  departure_at TIMESTAMPTZ NOT NULL,
  seats_total INTEGER NOT NULL CHECK (seats_total > 0),
  price_dzd INTEGER NOT NULL CHECK (price_dzd >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS trip_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES away_trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 6),
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trip_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_trips_active ON away_trips(active, departure_at);
CREATE INDEX IF NOT EXISTS idx_trip_bookings_trip ON trip_bookings(trip_id, status);
