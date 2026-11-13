CREATE TABLE IF NOT EXISTS campaign_modules (
  id text PRIMARY KEY,
  campaign_id integer REFERENCES campaigns(id) ON DELETE SET NULL,
  owner_user_id text NOT NULL,
  object_key text NOT NULL UNIQUE,
  name text NOT NULL,
  filename text NOT NULL,
  size integer NOT NULL CHECK (size > 0 AND size <= 104857600),
  page integer NOT NULL DEFAULT 1 CHECK (page > 0),
  bookmarks jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','deleting')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_modules_campaign_idx ON campaign_modules(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_modules_owner_idx ON campaign_modules(owner_user_id);
CREATE TABLE IF NOT EXISTS campaign_module_selection (
  campaign_id integer PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  module_id text REFERENCES campaign_modules(id) ON DELETE SET NULL
);
