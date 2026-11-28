import { Pool } from 'pg';
import { emptyDoc } from '../../shared/board/model';
import {
  createBoard,
  createProject,
  ensureWorkspace,
  getProject,
  listProjects,
  type UserIdentity,
} from '../../db/repo';
import { withOrg } from '../../db/scoped';
import { sql } from 'drizzle-orm';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.log('ISOLATION SKIP - DATABASE_URL is not set');
  process.exit(0);
}
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: true } });
let failures = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'ok' : 'FAIL'} - ${name}`);
  if (!ok) failures += 1;
}

const stamp = Date.now().toString(36);
const userA: UserIdentity = { id: `test-a-${stamp}`, email: `a-${stamp}@example.test`, name: 'أ' };
const userB: UserIdentity = { id: `test-b-${stamp}`, email: `b-${stamp}@example.test`, name: 'ب' };
const orgIds: string[] = [];

try {
  const orgsA = await ensureWorkspace(pool, userA);
  const orgsB = await ensureWorkspace(pool, userB);
  check('ensureWorkspace creates one org per user', orgsA.length === 1 && orgsB.length === 1);
  const orgA = orgsA[0]!;
  const orgB = orgsB[0]!;
  orgIds.push(orgA.id, orgB.id);
  check('listOrgs returns own org only', (await ensureWorkspace(pool, userA)).every((o) => o.id === orgA.id));

  const ctxA = { orgId: orgA.id, userId: userA.id, role: 'owner' as const };
  const ctxB = { orgId: orgB.id, userId: userB.id, role: 'owner' as const };
  const projectA = await createProject(pool, ctxA, { title: 'مشروع أ', description: '' });
  const projectB = await createProject(pool, ctxB, { title: 'مشروع ب', description: '' });
  check('project created in org A', Boolean(projectA?.id));
  await createBoard(pool, ctxA, { projectId: projectA!.id, title: 'سبورة أ', doc: emptyDoc() });

  const aProjects = await listProjects(pool, ctxA);
  check('org A sees only its project', aProjects.length === 1 && aProjects[0]?.id === projectA!.id);
  check('org A cannot read org B project via repo', (await getProject(pool, ctxA, projectB!.id)) === null);

  const rlsCross = await withOrg(pool, ctxA, (db) =>
    db.execute<{ n: number }>(sql`select count(*)::int as n from projects where org_id = ${orgB.id}`),
  );
  check('RLS hides org B rows from org A', rlsCross.rows[0]?.n === 0);

  const rlsOwn = await withOrg(pool, ctxA, (db) =>
    db.execute<{ n: number }>(sql`select count(*)::int as n from projects where org_id = ${orgA.id}`),
  );
  check('RLS exposes org A rows to org A', rlsOwn.rows[0]?.n === 1);

  let blocked = false;
  try {
    await withOrg(pool, ctxA, (db) =>
      db.execute(sql`insert into projects (org_id, title, created_by) values (${orgB.id}, 'تسريب', ${userA.id})`),
    );
  } catch {
    blocked = true;
  }
  check('RLS rejects writing into another org', blocked);

  let missingCtx = false;
  try {
    await withOrg(pool, { orgId: '', userId: userA.id, role: 'owner' }, async () => undefined);
  } catch {
    missingCtx = true;
  }
  check('query layer rejects missing org context', missingCtx);
} catch (error) {
  console.error('ERROR', error);
  failures += 1;
} finally {
  const client = await pool.connect();
  try {
    for (const orgId of orgIds) {
      await client.query('BEGIN');
      await client.query("select set_config('app.current_org_id', $1, true)", [orgId]);
      await client.query('delete from audit_log where org_id = $1', [orgId]);
      await client.query('delete from organizations where id = $1', [orgId]);
      await client.query('COMMIT');
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('cleanup failed', error);
  } finally {
    client.release();
    await pool.end();
  }
}
console.log(failures === 0 ? 'ISOLATION PASS' : `ISOLATION FAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
