-- API-Football synchronization layer.
-- All provider identifiers are nullable so manual/admin-created matches remain valid.
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS api_fixture_id BIGINT,
  ADD COLUMN IF NOT EXISTS api_league_id INTEGER,
  ADD COLUMN IF NOT EXISTS api_season INTEGER,
  ADD COLUMN IF NOT EXISTS api_round VARCHAR(255),
  ADD COLUMN IF NOT EXISTS api_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS elapsed_minute INTEGER,
  ADD COLUMN IF NOT EXISTS extra_minute INTEGER,
  ADD COLUMN IF NOT EXISTS home_team_api_id INTEGER,
  ADD COLUMN IF NOT EXISTS away_team_api_id INTEGER,
  ADD COLUMN IF NOT EXISTS home_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS away_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS venue_api_id INTEGER,
  ADD COLUMN IF NOT EXISTS api_last_synced_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS matches_api_fixture_id_uq ON matches(api_fixture_id) WHERE api_fixture_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_team_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(32),
  country VARCHAR(128),
  logo_url TEXT,
  founded INTEGER,
  national BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_player_id INTEGER NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  firstname VARCHAR(255),
  lastname VARCHAR(255),
  age INTEGER,
  nationality VARCHAR(128),
  position VARCHAR(64),
  photo_url TEXT,
  raw_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  api_event_id BIGINT,
  minute INTEGER,
  extra_minute INTEGER,
  type VARCHAR(64),
  detail VARCHAR(255),
  comments TEXT,
  team_api_id INTEGER,
  player_api_id INTEGER,
  player_name VARCHAR(255),
  assist_player_api_id INTEGER,
  assist_player_name VARCHAR(255),
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, api_event_id)
);

CREATE TABLE IF NOT EXISTS match_lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_api_id INTEGER NOT NULL,
  player_api_id INTEGER NOT NULL,
  player_name VARCHAR(255),
  number INTEGER,
  position VARCHAR(32),
  grid VARCHAR(32),
  starter BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_api_id, player_api_id)
);

CREATE TABLE IF NOT EXISTS match_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_api_id INTEGER NOT NULL,
  statistics JSONB NOT NULL,
  raw_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(match_id, team_api_id)
);

CREATE TABLE IF NOT EXISTS league_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_api_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  team_api_id INTEGER NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  team_logo_url TEXT,
  points INTEGER,
  goals_diff INTEGER,
  played INTEGER,
  win INTEGER,
  draw INTEGER,
  lose INTEGER,
  goals_for INTEGER,
  goals_against INTEGER,
  form VARCHAR(32),
  raw_json JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_api_id, season, team_api_id)
);

CREATE TABLE IF NOT EXISTS football_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation VARCHAR(64) NOT NULL,
  fixture_id BIGINT,
  success BOOLEAN NOT NULL,
  quota_used INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
