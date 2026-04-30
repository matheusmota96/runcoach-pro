-- Mota 70.3 Coach - Postgres schema
-- Multi-user, JSONB-backed for flexibility against client shape.
-- Every statement here is idempotent and runs on cold start (lib/db.js → ensureSchema).

-- Emails are always normalized to lower-case in the app layer (lib/auth.js)
-- so we keep this as plain TEXT and avoid pulling in the CITEXT extension.
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS athlete (
  id INT PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE athlete DROP CONSTRAINT IF EXISTS athlete_singleton;
ALTER TABLE athlete ALTER COLUMN id DROP DEFAULT;
ALTER TABLE athlete ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX IF NOT EXISTS athlete_owner_idx ON athlete(owner_id);

CREATE TABLE IF NOT EXISTS logs (
  id INT PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE logs ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS logs_date_idx  ON logs(date DESC);
CREATE INDEX IF NOT EXISTS logs_type_idx  ON logs(type);
CREATE INDEX IF NOT EXISTS logs_owner_idx ON logs(owner_id);

CREATE TABLE IF NOT EXISTS meals (
  id INT PRIMARY KEY,
  date DATE NOT NULL,
  type TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meals ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS meals_date_idx  ON meals(date DESC);
CREATE INDEX IF NOT EXISTS meals_owner_idx ON meals(owner_id);

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
ALTER TABLE races ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS races_date_idx   ON races(date);
CREATE INDEX IF NOT EXISTS races_status_idx ON races(status);
CREATE INDEX IF NOT EXISTS races_owner_idx  ON races(owner_id);

CREATE TABLE IF NOT EXISTS counters (
  key TEXT PRIMARY KEY,
  value INT NOT NULL DEFAULT 1
);

INSERT INTO counters (key, value) VALUES
  ('logs', 1), ('meals', 1), ('races', 3), ('athletes', 2)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS migration_marker (
  key TEXT PRIMARY KEY,
  value TEXT,
  ran_at TIMESTAMPTZ DEFAULT NOW()
);
