BEGIN;
CREATE TABLE IF NOT EXISTS journal_summary_versions (
  session_id text NOT NULL REFERENCES journal_sessions(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  status text NOT NULL CHECK (status IN ('draft', 'approved')),
  action text NOT NULL CHECK (action IN ('save', 'approve', 'restore')),
  sections jsonb NOT NULL,
  sources jsonb NOT NULL,
  source_fingerprint text NOT NULL,
  created_at text NOT NULL,
  restored_from integer,
  PRIMARY KEY (session_id, revision)
);
COMMIT;
