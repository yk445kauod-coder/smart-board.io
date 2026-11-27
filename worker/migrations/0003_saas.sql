PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN is_platform_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE lessons ADD COLUMN org_id TEXT;
ALTER TABLE usage_events ADD COLUMN org_id TEXT;
ALTER TABLE runs ADD COLUMN org_id TEXT;

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_orgs_plan ON organizations(plan);
CREATE INDEX IF NOT EXISTS idx_orgs_status ON organizations(status);

CREATE TABLE IF NOT EXISTS memberships (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'teacher',
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, user_id),
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  seats INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'manual',
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  current_period_start INTEGER,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Default key',
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT NOT NULL DEFAULT 'read,write',
  last_used_at INTEGER,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(org_id, revoked_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  org_id TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  meta_json TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log(org_id, created_at DESC);

INSERT OR IGNORE INTO organizations (id, name, slug, plan, status, owner_id, created_at, updated_at)
SELECT 'org_' || u.id,
       CASE WHEN u.name <> '' THEN u.name || ' workspace' ELSE u.email || ' workspace' END,
       lower(replace(u.email, '@', '-')) || '-' || substr(u.id, 1, 6),
       'free', 'active', u.id, u.created_at, u.created_at
FROM users u;

INSERT OR IGNORE INTO memberships (id, org_id, user_id, role, created_at)
SELECT 'mem_' || u.id, 'org_' || u.id, u.id, 'owner', u.created_at FROM users u;

INSERT OR IGNORE INTO subscriptions (id, org_id, plan, status, seats, provider, created_at, updated_at)
SELECT 'sub_' || u.id, 'org_' || u.id, 'free', 'active', 1, 'manual', u.created_at, u.created_at FROM users u;

UPDATE lessons SET org_id = 'org_' || user_id WHERE org_id IS NULL;
UPDATE usage_events SET org_id = 'org_' || user_id WHERE org_id IS NULL;
UPDATE runs SET org_id = 'org_' || user_id WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_org_updated ON lessons(org_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_org_kind_created ON usage_events(org_id, kind, created_at DESC);
