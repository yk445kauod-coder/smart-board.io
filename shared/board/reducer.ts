import {
  BoardCommand,
  BoardDoc,
  type BoardElement,
  BOARD_VERSION,
} from './model';
import { clampElement, nextZ, normalizeZ, translateElement } from './geometry';

export class BoardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BoardError';
  }
}

function requireElement(doc: BoardDoc, id: string): BoardElement {
  const el = doc.elements.find((e) => e.id === id);
  if (!el) throw new BoardError(`element not found: ${id}`);
  return el;
}

/**
 * The only mutation path for the board. Users, tools and (later) the agent all
 * produce BoardCommand values; undo/redo, autosave and replay derive from here.
 */
export function applyCommand(doc: BoardDoc, command: BoardCommand): BoardDoc {
  switch (command.type) {
    case 'element.add': {
      if (doc.elements.some((e) => e.id === command.element.id)) {
        throw new BoardError(`duplicate element id: ${command.element.id}`);
      }
      if (doc.elements.length >= 2000) throw new BoardError('board is full');
      const element = clampElement({ ...command.element, z: command.element.z ?? nextZ(doc) });
      return { ...doc, elements: [...doc.elements, element] };
    }
    case 'element.replace': {
      const existing = requireElement(doc, command.element.id);
      const element = clampElement({ ...command.element, z: command.element.z ?? existing.z });
      return { ...doc, elements: doc.elements.map((e) => (e.id === element.id ? element : e)) };
    }
    case 'element.move': {
      const ids = new Set(command.ids);
      for (const id of ids) requireElement(doc, id);
      return {
        ...doc,
        elements: doc.elements.map((e) =>
          ids.has(e.id) ? clampElement(translateElement(e, command.dx, command.dy)) : e,
        ),
      };
    }
    case 'element.delete': {
      const ids = new Set(command.ids);
      for (const id of ids) requireElement(doc, id);
      return { ...doc, elements: doc.elements.filter((e) => !ids.has(e.id)) };
    }
    case 'element.duplicate': {
      const source = requireElement(doc, command.id);
      if (doc.elements.some((e) => e.id === command.newId)) {
        throw new BoardError(`duplicate element id: ${command.newId}`);
      }
      if (doc.elements.length >= 2000) throw new BoardError('board is full');
      const copy = clampElement({
        ...structuredClone(source),
        id: command.newId,
        z: nextZ(doc),
      });
      const moved = clampElement(translateElement(copy, command.dx ?? 24, command.dy ?? 24));
      return { ...doc, elements: [...doc.elements, moved] };
    }
    case 'element.reorder': {
      const index = doc.elements.findIndex((e) => e.id === command.id);
      if (index < 0) throw new BoardError(`element not found: ${command.id}`);
      const elements = [...doc.elements];
      const [target] = elements.splice(index, 1);
      if (!target) throw new BoardError(`element not found: ${command.id}`);
      if (command.direction === 'front') elements.push(target);
      else if (command.direction === 'back') elements.unshift(target);
      else if (command.direction === 'forward') {
        elements.splice(Math.min(index + 1, elements.length), 0, target);
      } else {
        elements.splice(Math.max(index - 1, 0), 0, target);
      }
      return normalizeZ({ ...doc, elements });
    }
    case 'board.clear':
      return { ...doc, elements: [] };
    case 'board.background':
      return { ...doc, background: command.color };
    case 'board.title':
      return { ...doc, title: command.title };
    default: {
      const exhaustive: never = command;
      throw new BoardError(`unsupported command: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export interface History {
  past: BoardDoc[];
  present: BoardDoc;
  future: BoardDoc[];
}

export const HISTORY_LIMIT = 100;

export function createHistory(doc: BoardDoc): History {
  return { past: [], present: doc, future: [] };
}

export function commit(history: History, input: unknown): History {
  const command = BoardCommand.parse(input);
  const next = applyCommand(history.present, command);
  const past = [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [] };
}

export function undo(history: History): History {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: next,
    future: rest,
  };
}

export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/** Remote/agent sync replaces the present without touching local history. */
export function replacePresent(history: History, doc: BoardDoc): History {
  return { ...history, present: { ...doc, version: BOARD_VERSION } };
}
