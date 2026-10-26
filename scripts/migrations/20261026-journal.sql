BEGIN;
CREATE TABLE IF NOT EXISTS journal_sessions (
  id text PRIMARY KEY,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title text NOT NULL,
  date text NOT NULL,
  notes text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_sessions_campaign ON journal_sessions(campaign_id);
CREATE TABLE IF NOT EXISTS journal_imports (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES journal_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  kind text NOT NULL,
  format text NOT NULL,
  original text NOT NULL,
  suggestions jsonb NOT NULL,
  decisions jsonb NOT NULL DEFAULT '[]',
  revision integer NOT NULL DEFAULT 0,
  edited_text text
);
CREATE INDEX IF NOT EXISTS journal_imports_session ON journal_imports(session_id);
CREATE TABLE IF NOT EXISTS journal_aliases (
  id text PRIMARY KEY,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  phrase text NOT NULL,
  phrase_key text NOT NULL,
  reference_key text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS journal_alias_phrase_unique ON journal_aliases(campaign_id, phrase_key);
CREATE TABLE IF NOT EXISTS journal_recordings (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES journal_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  size integer NOT NULL CHECK(size > 0 AND size <= 20971520),
  digest text NOT NULL,
  bytes bytea NOT NULL,
  CHECK(octet_length(bytes) = size)
);
CREATE INDEX IF NOT EXISTS journal_recordings_session ON journal_recordings(session_id);
COMMIT;
