CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  method TEXT NOT NULL,
  reference TEXT,
  amount_egp INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_at INTEGER,
  reviewed_by TEXT,
  activation_code_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_org ON payment_requests(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS activation_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  plan TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 1,
  days INTEGER NOT NULL DEFAULT 30,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_by TEXT,
  expires_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activation_codes_created ON activation_codes(created_at DESC);
