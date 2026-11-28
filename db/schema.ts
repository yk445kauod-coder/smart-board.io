import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import type { BoardDoc } from '../shared/board/model';

export const ORG_KINDS = ['platform', 'school', 'center', 'independent', 'shared'] as const;
export const ROLES = ['owner', 'admin', 'teacher', 'student'] as const;
export const LIBRARY_KINDS = ['board', 'template'] as const;

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('independent'),
    ownerUserId: text('owner_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('organizations_kind_check', sql`${t.kind} in ('platform','school','center','independent','shared')`),
    index('organizations_owner_idx').on(t.ownerUserId),
  ],
);

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    email: text('email').notNull().default(''),
    role: text('role').notNull().default('teacher'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('memberships_org_user_uq').on(t.orgId, t.userId),
    index('memberships_user_idx').on(t.userId),
    check('memberships_role_check', sql`${t.role} in ('owner','admin','teacher','student')`),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('projects_org_idx').on(t.orgId)],
);

export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    doc: jsonb('doc').$type<BoardDoc>().notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('boards_org_project_idx').on(t.orgId, t.projectId)],
);

/**
 * Denormalised projection of boards for Neon Realtime. Realtime's query
 * compiler refuses relations with row security, so live reads use this table;
 * it carries org_id and every sealed query filters by it.
 */
export const boardLive = pgTable(
  'board_live',
  {
    id: uuid('id').primaryKey().references(() => boards.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').notNull(),
    title: text('title').notNull(),
    doc: jsonb('doc').$type<BoardDoc>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('board_live_org_idx').on(t.orgId)],
);

export const libraryItems = pgTable(
  'library_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    kind: text('kind').notNull().default('board'),
    payload: jsonb('payload').$type<BoardDoc>().notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('library_org_idx').on(t.orgId),
    check('library_kind_check', sql`${t.kind} in ('board','template')`),
  ],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull(),
    actorUserId: text('actor_user_id').notNull(),
    action: text('action').notNull(),
    target: text('target').notNull().default(''),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_org_idx').on(t.orgId)],
);

export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Board = typeof boards.$inferSelect;
export type LibraryItem = typeof libraryItems.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type OrgKind = (typeof ORG_KINDS)[number];
export type Role = (typeof ROLES)[number];
export type LibraryKind = (typeof LIBRARY_KINDS)[number];
