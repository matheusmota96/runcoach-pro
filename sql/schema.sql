-- Mota 70.3 Coach - Postgres schema
-- Single-user app, JSONB-backed for flexibility against client shape

CREATE TABLE IF NOT EXISTS athlete (
  id INT PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT athlete_singleton CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS logs (
  id INT PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS logs_date_idx ON logs(date DESC);
CREATE INDEX IF NOT EXISTS logs_type_idx ON logs(type);

CREATE TABLE IF NOT EXISTS meals (
  id INT PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS meals_date_idx ON meals(date DESC);

CREATE TABLE IF NOT EXISTS races (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planejada',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS races_date_idx ON races(date);
CREATE INDEX IF NOT EXISTS races_status_idx ON races(status);

CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INT NOT NULL DEFAULT 1
);

INSERT INTO counters (key, value) VALUES
  ('logs', 1), ('meals', 1), ('races', 3)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS migration_marker (
  key TEXT PRIMARY KEY,
  value TEXT,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);
