# Row-level security on D1

D1 is SQLite. It does **not** have PostgreSQL-style `ROW LEVEL SECURITY` policies.
SmartBoard therefore enforces tenant isolation in the application layer, with the
same rule everywhere: **a request may only touch rows whose `org_id` is the org
resolved from the authenticated session or API key.**

This is the zero-budget, D1-native equivalent of RLS. It is deliberate, testable,
and does not depend on a paid database.

## 1. The rule

Every tenant-owned table has an `org_id` column:

`lessons`, `usage_events`, `runs`, `api_keys`, `subscriptions`, `payment_requests`,
`push_subscriptions`, and `audit_log` (nullable for platform-level events).

Every read, update, and delete includes `org_id = ?` in the SQL. Every insert takes
`org_id` from `c.get('org').id`, never from the request body.

```ts
// correct
await dbFirst(c.env.DB, 'SELECT * FROM lessons WHERE id = ? AND org_id = ?', id, org.id);

// wrong — leaks another tenant's lesson
await dbFirst(c.env.DB, 'SELECT * FROM lessons WHERE id = ?', id);
```

## 2. How the org is resolved

1. `requireAuth` validates the `sb_session` cookie or `Authorization: Bearer sb_live_…`.
2. `requireOrg` calls `getOrgContext(db, userId, requestedOrgId)`.
3. `getOrgContext` only returns an org where the user has a `memberships` row.
4. The resolved `org`, `membership`, `subscription`, and `plan` are stored in Hono
   context. Route handlers read `c.get('org')`.
5. API keys are bound to one `org_id`; a key cannot select another workspace.

## 3. Write rules

- `POST /v1/lessons` sets `org_id` from context. The body cannot choose an org.
- `PUT /v1/lessons/:id` and `DELETE /v1/lessons/:id` include `org_id` in the
  `WHERE` clause.
- `POST /v1/push/subscribe` stores `org_id` and `user_id` from context.
- Manual payment requests and activation redemptions are org-scoped.
- Admin endpoints use `requirePlatformAdmin`; they are the only routes allowed to
  query across orgs, and every admin mutation writes an `audit_log` row.

## 4. Response codes

Cross-tenant access returns **404**, not 403. This avoids confirming that a lesson
or workspace exists in another tenant.

## 5. Audit checklist for new queries

Before merging a query on a tenant table:

- [ ] Does the table have `org_id`?
- [ ] Does the `WHERE` clause include `org_id = ?`?
- [ ] Is the value from `c.get('org').id`, not from the body or query string?
- [ ] For inserts, is `org_id` set by the server?
- [ ] Is the route behind `requireAuth` + `requireOrg`?
- [ ] Does the response avoid leaking another tenant's existence?

## 6. If you move to PostgreSQL/Supabase later

Native RLS becomes possible. The migration is additive:

```sql
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY lessons_tenant_isolation ON lessons
  USING (org_id = current_setting('app.org_id', true))
  WITH CHECK (org_id = current_setting('app.org_id', true));
```

Set `app.org_id` per request/transaction from the verified session. Keep the
application-level checks as defense in depth; do not remove them.
