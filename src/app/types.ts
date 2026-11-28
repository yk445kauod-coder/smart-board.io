import type { Role } from '../../shared/auth/roles';
import type { BoardDoc } from '../../shared/board/model';

export interface OrgSummary {
  id: string;
  name: string;
  kind: string;
  role: Role;
}

export interface Project {
  id: string;
  orgId: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardSummary {
  id: string;
  title: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardRecord extends BoardSummary {
  orgId: string;
  doc: BoardDoc;
  createdBy: string;
}

export interface LibraryItem {
  id: string;
  orgId: string;
  boardId: string | null;
  title: string;
  kind: 'board' | 'template';
  payload: BoardDoc;
  createdBy: string;
  createdAt: string;
}
