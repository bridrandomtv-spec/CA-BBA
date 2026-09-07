-- Cache API-Football league/season coverage and access state.
-- The provider can advertise a season while the current plan cannot access it.
CREATE TABLE IF NOT EXISTS football_competition_coverage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_api_id INTEGER NOT NULL,
  season INTEGER NOT NULL,
  fixtures BOOLEAN NOT NULL DEFAULT FALSE,
  standings BOOLEAN NOT NULL DEFAULT FALSE,
  players BOOLEAN NOT NULL DEFAULT FALSE,
  top_scorers BOOLEAN NOT NULL DEFAULT FALSE,
  events BOOLEAN NOT NULL DEFAULT FALSE,
  lineups BOOLEAN NOT NULL DEFAULT FALSE,
  statistics_fixtures BOOLEAN NOT NULL DEFAULT FALSE,
  statistics_players BOOLEAN NOT NULL DEFAULT FALSE,
  season_listed BOOLEAN NOT NULL DEFAULT FALSE,
  api_access_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  last_error TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_api_id, season)
);

CREATE INDEX IF NOT EXISTS football_competition_coverage_checked_idx
  ON football_competition_coverage(checked_at DESC);
