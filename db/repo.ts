import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import type { Pool } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';
import type { BoardDoc } from '../shared/board/model';
import type { OrgKind, Role } from '../shared/auth/roles';
import {
  auditLog,
  boards,
  libraryItems,
  memberships,
  organizations,
  projects,
} from './schema';
import { withOrg, withUser, type OrgContext } from './scoped';

export class RepoError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'RepoError';
    this.status = status;
    this.code = code;
  }
}

function pgCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export interface OrgSummary {
  id: string;
  name: string;
  kind: OrgKind;
  role: Role;
}

export interface UserIdentity {
  id: string;
  email: string;
  name: string;
}

export async function listOrgs(pool: Pool, userId: string): Promise<OrgSummary[]> {
  return withUser(pool, userId, async (db) => {
    const rows = await db
      .select({ id: organizations.id, name: organizations.name, kind: organizations.kind, role: memberships.role })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.orgId, organizations.id))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(organizations.createdAt));
    return rows.map((r) => ({ ...r, kind: r.kind as OrgKind, role: r.role as Role }));
  });
}

export async function ensureWorkspace(pool: Pool, user: UserIdentity): Promise<OrgSummary[]> {
  const existing = await listOrgs(pool, user.id);
  if (existing.length > 0) return existing;
  const orgId = randomUUID();
  const display = user.name.trim() || user.email.split('@')[0] || 'مدرّس';
  const name = `مساحة ${display}`;
  await withOrg(pool, { orgId, userId: user.id, role: 'owner' }, async (db) => {
    await db.insert(organizations).values({ id: orgId, name, kind: 'independent', ownerUserId: user.id });
    await db.insert(memberships).values({ orgId, userId: user.id, email: user.email, role: 'owner' });
    await db.insert(auditLog).values({
      orgId,
      actorUserId: user.id,
      action: 'org.create',
      target: orgId,
      meta: { name, kind: 'independent' },
    });
  });
  return listOrgs(pool, user.id);
}

export async function createOrg(
  pool: Pool,
  user: UserIdentity,
  input: { name: string; kind: OrgKind },
): Promise<OrgSummary> {
  const orgId = randomUUID();
  await withOrg(pool, { orgId, userId: user.id, role: 'owner' }, async (db) => {
    await db.insert(organizations).values({ id: orgId, name: input.name, kind: input.kind, ownerUserId: user.id });
    await db.insert(memberships).values({ orgId, userId: user.id, email: user.email, role: 'owner' });
    await db.insert(auditLog).values({
      orgId,
      actorUserId: user.id,
      action: 'org.create',
      target: orgId,
      meta: { name: input.name, kind: input.kind },
    });
  });
  return { id: orgId, name: input.name, kind: input.kind, role: 'owner' };
}

export async function resolveUserId(pool: Pool, ctx: OrgContext, email: string): Promise<string | null> {
  return withOrg(pool, ctx, async (db) => {
    const result = await db.execute<{ id: string | null }>(sql`select public.resolve_user_id(${email}) as id`);
    return result.rows[0]?.id ?? null;
  });
}

export async function getMembership(pool: Pool, userId: string, orgId: string): Promise<Role | null> {
  return withUser(pool, userId, async (db) => {
    const [row] = await db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
    return row ? (row.role as Role) : null;
  });
}

export async function listMembers(pool: Pool, ctx: OrgContext) {
  return withOrg(pool, ctx, async (db) =>
    db
      .select({ id: memberships.id, userId: memberships.userId, email: memberships.email, role: memberships.role, createdAt: memberships.createdAt })
      .from(memberships)
      .where(eq(memberships.orgId, ctx.orgId))
      .orderBy(asc(memberships.createdAt)),
  );
}

export async function addMember(
  pool: Pool,
  ctx: OrgContext,
  input: { userId: string; email: string; role: Role },
) {
  try {
    return await withOrg(pool, ctx, async (db) => {
      const [row] = await db
        .insert(memberships)
        .values({ orgId: ctx.orgId, userId: input.userId, email: input.email, role: input.role })
        .returning();
      await db.insert(auditLog).values({
        orgId: ctx.orgId,
        actorUserId: ctx.userId,
        action: 'member.add',
        target: input.userId,
        meta: { role: input.role },
      });
      return row;
    });
  } catch (error) {
    if (pgCode(error) === '23505') throw new RepoError(409, 'already_member', 'already a member');
    throw error;
  }
}

export async function updateMemberRole(pool: Pool, ctx: OrgContext, memberId: string, role: Role) {
  return withOrg(pool, ctx, async (db) => {
    const [target] = await db.select().from(memberships).where(and(eq(memberships.id, memberId), eq(memberships.orgId, ctx.orgId)));
    if (!target) throw new RepoError(404, 'not_found', 'member not found');
    if (target.role === 'owner' && role !== 'owner') {
      const [{ value } = { value: 0 }] = await db
        .select({ value: count() })
        .from(memberships)
        .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.role, 'owner')));
      if (Number(value) <= 1) throw new RepoError(409, 'last_owner', 'cannot demote the last owner');
    }
    const [row] = await db.update(memberships).set({ role }).where(eq(memberships.id, memberId)).returning();
    await db.insert(auditLog).values({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'member.role',
      target: memberId,
      meta: { from: target.role, to: role },
    });
    return row;
  });
}

export async function removeMember(pool: Pool, ctx: OrgContext, memberId: string) {
  return withOrg(pool, ctx, async (db) => {
    const [target] = await db.select().from(memberships).where(and(eq(memberships.id, memberId), eq(memberships.orgId, ctx.orgId)));
    if (!target) throw new RepoError(404, 'not_found', 'member not found');
    if (target.role === 'owner') {
      const [{ value } = { value: 0 }] = await db
        .select({ value: count() })
        .from(memberships)
        .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.role, 'owner')));
      if (Number(value) <= 1) throw new RepoError(409, 'last_owner', 'cannot remove the last owner');
    }
    await db.delete(memberships).where(eq(memberships.id, memberId));
    await db.insert(auditLog).values({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'member.remove',
      target: target.userId,
    });
    return { ok: true };
  });
}

export async function listProjects(pool: Pool, ctx: OrgContext) {
  return withOrg(pool, ctx, async (db) =>
    db
      .select()
      .from(projects)
      .where(eq(projects.orgId, ctx.orgId))
      .orderBy(desc(projects.updatedAt)),
  );
}

export async function createProject(pool: Pool, ctx: OrgContext, input: { title: string; description: string }) {
  return withOrg(pool, ctx, async (db) => {
    const [row] = await db
      .insert(projects)
      .values({ orgId: ctx.orgId, title: input.title, description: input.description, createdBy: ctx.userId })
      .returning();
    await db.insert(auditLog).values({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'project.create',
      target: row?.id ?? '',
    });
    return row;
  });
}

export async function getProject(pool: Pool, ctx: OrgContext, id: string) {
  return withOrg(pool, ctx, async (db) => {
    const [row] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.orgId, ctx.orgId)));
    return row ?? null;
  });
}

export async function updateProject(
  pool: Pool,
  ctx: OrgContext,
  id: string,
  input: { title?: string; description?: string },
) {
  return withOrg(pool, ctx, async (db) => {
    const [row] = await db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.orgId, ctx.orgId)))
      .returning();
    if (!row) throw new RepoError(404, 'not_found', 'project not found');
    return row;
  });
}

export async function deleteProject(pool: Pool, ctx: OrgContext, id: string) {
  return withOrg(pool, ctx, async (db) => {
    const deleted = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.orgId, ctx.orgId)))
      .returning({ id: projects.id });
    if (deleted.length === 0) throw new RepoError(404, 'not_found', 'project not found');
    await db.insert(auditLog).values({ orgId: ctx.orgId, actorUserId: ctx.userId, action: 'project.delete', target: id });
    return { ok: true };
  });
}

export async function listBoards(pool: Pool, ctx: OrgContext, projectId: string) {
  return withOrg(pool, ctx, async (db) =>
    db
      .select({ id: boards.id, title: boards.title, projectId: boards.projectId, updatedAt: boards.updatedAt, createdAt: boards.createdAt })
      .from(boards)
      .where(and(eq(boards.orgId, ctx.orgId), eq(boards.projectId, projectId)))
      .orderBy(asc(boards.createdAt)),
  );
}

export async function createBoard(
  pool: Pool,
  ctx: OrgContext,
  input: { projectId: string; title: string; doc: BoardDoc },
) {
  return withOrg(pool, ctx, async (db) => {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, input.projectId), eq(projects.orgId, ctx.orgId)));
    if (!project) throw new RepoError(404, 'project_not_found', 'project not found');
    const [row] = await db
      .insert(boards)
      .values({
        orgId: ctx.orgId,
        projectId: input.projectId,
        title: input.title,
        doc: input.doc,
        createdBy: ctx.userId,
      })
      .returning();
    await db.insert(auditLog).values({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'board.create',
      target: row?.id ?? '',
    });
    return row;
  });
}

export async function getBoard(pool: Pool, ctx: OrgContext, id: string) {
  return withOrg(pool, ctx, async (db) => {
    const [row] = await db.select().from(boards).where(and(eq(boards.id, id), eq(boards.orgId, ctx.orgId)));
    return row ?? null;
  });
}

export async function updateBoard(
  pool: Pool,
  ctx: OrgContext,
  id: string,
  input: { title?: string; doc?: BoardDoc },
) {
  return withOrg(pool, ctx, async (db) => {
    const [row] = await db
      .update(boards)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(boards.id, id), eq(boards.orgId, ctx.orgId)))
      .returning({ id: boards.id, title: boards.title, updatedAt: boards.updatedAt });
    if (!row) throw new RepoError(404, 'not_found', 'board not found');
    return row;
  });
}

export async function deleteBoard(pool: Pool, ctx: OrgContext, id: string) {
  return withOrg(pool, ctx, async (db) => {
    const deleted = await db
      .delete(boards)
      .where(and(eq(boards.id, id), eq(boards.orgId, ctx.orgId)))
      .returning({ id: boards.id });
    if (deleted.length === 0) throw new RepoError(404, 'not_found', 'board not found');
    await db.insert(auditLog).values({ orgId: ctx.orgId, actorUserId: ctx.userId, action: 'board.delete', target: id });
    return { ok: true };
  });
}

export async function listLibrary(pool: Pool, ctx: OrgContext) {
  return withOrg(pool, ctx, async (db) =>
    db
      .select()
      .from(libraryItems)
      .where(eq(libraryItems.orgId, ctx.orgId))
      .orderBy(desc(libraryItems.createdAt)),
  );
}

export async function createLibraryItem(
  pool: Pool,
  ctx: OrgContext,
  input: { title: string; kind: 'board' | 'template'; payload: BoardDoc; boardId?: string | null },
) {
  return withOrg(pool, ctx, async (db) => {
    const [row] = await db
      .insert(libraryItems)
      .values({
        orgId: ctx.orgId,
        title: input.title,
        kind: input.kind,
        payload: input.payload,
        boardId: input.boardId ?? null,
        createdBy: ctx.userId,
      })
      .returning();
    await db.insert(auditLog).values({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: 'library.create',
      target: row?.id ?? '',
    });
    return row;
  });
}

export async function deleteLibraryItem(pool: Pool, ctx: OrgContext, id: string) {
  return withOrg(pool, ctx, async (db) => {
    const deleted = await db
      .delete(libraryItems)
      .where(and(eq(libraryItems.id, id), eq(libraryItems.orgId, ctx.orgId)))
      .returning({ id: libraryItems.id });
    if (deleted.length === 0) throw new RepoError(404, 'not_found', 'item not found');
    return { ok: true };
  });
}

export async function listAudit(pool: Pool, ctx: OrgContext, limit = 100) {
  return withOrg(pool, ctx, async (db) =>
    db
      .select()
      .from(auditLog)
      .where(eq(auditLog.orgId, ctx.orgId))
      .orderBy(desc(auditLog.createdAt))
      .limit(Math.min(limit, 200)),
  );
}

export async function healthCheck(pool: Pool): Promise<boolean> {
  const result = await pool.query('select 1 as ok');
  return result.rows[0]?.ok === 1;
}
