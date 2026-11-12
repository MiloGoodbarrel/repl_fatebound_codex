CREATE TABLE IF NOT EXISTS pdf_import_receipts (
  owner_user_id text NOT NULL,
  campaign_id integer NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  PRIMARY KEY (owner_user_id, campaign_id, idempotency_key)
);
