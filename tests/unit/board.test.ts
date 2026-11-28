import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BoardCommand,
  BoardDoc,
  emptyDoc,
  type BoardElement,
} from '../../shared/board/model';
import { applyCommand, canRedo, canUndo, commit, createHistory, redo, undo, BoardError } from '../../shared/board/reducer';
import { elementBounds, findFreeSpot, hitTest } from '../../shared/board/geometry';

const stroke = (id: string, x = 100, y = 100): BoardElement => ({
  id,
  kind: 'stroke',
  tool: 'pen',
  points: [{ x, y }, { x: x + 60, y: y + 20 }],
  color: '#111827',
  width: 4,
});

const sticky = (id: string, x = 200, y = 200): BoardElement => ({
  id,
  kind: 'sticky',
  x,
  y,
  w: 200,
  h: 140,
  text: 'ملاحظة',
  color: '#fef08a',
  textColor: '#111827',
  fontSize: 22,
});

describe('BoardDoc contract', () => {
  it('accepts a valid empty doc', () => {
    expect(BoardDoc.parse(emptyDoc()).version).toBe(1);
  });

  it('rejects non-hex colors', () => {
    expect(BoardDoc.safeParse({ ...emptyDoc(), background: 'red' }).success).toBe(false);
  });

  it('rejects unknown element kinds', () => {
    expect(BoardDoc.safeParse({ ...emptyDoc(), elements: [{ id: 'a', kind: 'wat' }] }).success).toBe(false);
  });

  it('rejects a command without its payload', () => {
    expect(BoardCommand.safeParse({ type: 'element.add' }).success).toBe(false);
    expect(BoardCommand.safeParse({ type: 'nope' }).success).toBe(false);
  });
});

describe('applyCommand', () => {
  it('adds elements with increasing z', () => {
    let doc = emptyDoc();
    doc = applyCommand(doc, { type: 'element.add', element: stroke('a') });
    doc = applyCommand(doc, { type: 'element.add', element: stroke('b') });
    expect(doc.elements.map((e) => e.id)).toEqual(['a', 'b']);
    expect(doc.elements[1]?.z).toBeGreaterThan(doc.elements[0]?.z ?? 0);
  });

  it('refuses duplicate ids and missing elements', () => {
    const doc = applyCommand(emptyDoc(), { type: 'element.add', element: stroke('a') });
    expect(() => applyCommand(doc, { type: 'element.add', element: stroke('a') })).toThrow(BoardError);
    expect(() => applyCommand(doc, { type: 'element.delete', ids: ['zzz'] })).toThrow(BoardError);
    expect(() => applyCommand(doc, { type: 'element.move', ids: ['zzz'], dx: 1, dy: 1 })).toThrow(BoardError);
  });

  it('moves, replaces, duplicates and deletes', () => {
    let doc = applyCommand(emptyDoc(), { type: 'element.add', element: sticky('s1', 100, 100) });
    doc = applyCommand(doc, { type: 'element.move', ids: ['s1'], dx: 40, dy: 20 });
    const moved = doc.elements[0];
    expect(moved?.kind === 'sticky' && moved.x).toBe(140);
    doc = applyCommand(doc, { type: 'element.duplicate', id: 's1', newId: 's2' });
    expect(doc.elements).toHaveLength(2);
    doc = applyCommand(doc, { type: 'element.delete', ids: ['s1'] });
    expect(doc.elements.map((e) => e.id)).toEqual(['s2']);
  });

  it('reorders by paint order', () => {
    let doc = emptyDoc();
    for (const id of ['a', 'b', 'c']) doc = applyCommand(doc, { type: 'element.add', element: stroke(id) });
    doc = applyCommand(doc, { type: 'element.reorder', id: 'a', direction: 'front' });
    expect(doc.elements.map((e) => e.id)).toEqual(['b', 'c', 'a']);
    doc = applyCommand(doc, { type: 'element.reorder', id: 'a', direction: 'back' });
    expect(doc.elements.map((e) => e.id)).toEqual(['a', 'b', 'c']);
    doc = applyCommand(doc, { type: 'element.reorder', id: 'a', direction: 'forward' });
    expect(doc.elements.map((e) => e.id)).toEqual(['b', 'a', 'c']);
    doc = applyCommand(doc, { type: 'element.reorder', id: 'a', direction: 'backward' });
    expect(doc.elements.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('updates board metadata', () => {
    const doc = applyCommand(emptyDoc(), { type: 'board.title', title: 'درس الكسور' });
    const colored = applyCommand(doc, { type: 'board.background', color: '#f8fafc' });
    expect(colored.title).toBe('درس الكسور');
    expect(colored.background).toBe('#f8fafc');
    expect(applyCommand(colored, { type: 'board.clear' }).elements).toEqual([]);
  });

  it('keeps elements inside the board', () => {
    let doc = applyCommand(emptyDoc(), { type: 'element.add', element: sticky('s', -500, -500) });
    const b = elementBounds(doc.elements[0]!);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.y).toBeGreaterThanOrEqual(0);
    doc = applyCommand(doc, { type: 'element.move', ids: ['s'], dx: 99999, dy: 99999 });
    const b2 = elementBounds(doc.elements[0]!);
    expect(b2.x + b2.w).toBeLessThanOrEqual(BOARD_WIDTH);
    expect(b2.y + b2.h).toBeLessThanOrEqual(BOARD_HEIGHT);
  });
});

describe('history', () => {
  it('undoes and redoes exactly', () => {
    const start = emptyDoc();
    let h = createHistory(start);
    h = commit(h, { type: 'element.add', element: stroke('a') });
    h = commit(h, { type: 'element.add', element: sticky('b') });
    expect(canUndo(h)).toBe(true);
    const two = structuredClone(h.present);
    h = undo(h);
    expect(h.present.elements).toHaveLength(1);
    h = undo(h);
    expect(h.present.elements).toHaveLength(0);
    h = redo(h);
    h = redo(h);
    expect(h.present).toEqual(two);
    expect(canRedo(h)).toBe(false);
  });

  it('caps history at 100 steps', () => {
    let h = createHistory(emptyDoc());
    for (let i = 0; i < 150; i += 1) {
      h = commit(h, { type: 'element.add', element: stroke(`e${i}`) });
    }
    expect(h.past).toHaveLength(100);
  });

  it('rejects invalid commands without corrupting state', () => {
    const h = createHistory(emptyDoc());
    expect(() => commit(h, { type: 'element.delete', ids: ['missing'] })).toThrow(BoardError);
    expect(h.present.elements).toEqual([]);
  });
});

describe('geometry', () => {
  it('hits the topmost element first', () => {
    let doc = applyCommand(emptyDoc(), { type: 'element.add', element: sticky('bottom', 0, 0) });
    doc = applyCommand(doc, { type: 'element.add', element: sticky('top', 0, 0) });
    expect(hitTest(doc, { x: 50, y: 50 })?.id).toBe('top');
  });

  it('hits a freehand stroke near its path, not its bounding box', () => {
    const doc = applyCommand(emptyDoc(), { type: 'element.add', element: stroke('s', 0, 0) });
    expect(hitTest(doc, { x: 30, y: 10 })?.id).toBe('s');
    expect(hitTest(doc, { x: 55, y: 2 })).toBeNull();
  });

  it('finds a free spot that does not overlap', () => {
    let doc = emptyDoc();
    for (let i = 0; i < 6; i += 1) doc = applyCommand(doc, { type: 'element.add', element: sticky(`s${i}`, 100, 100) });
    const spot = findFreeSpot(doc, 200, 140, { x: 100, y: 100 });
    const box = { x: spot.x, y: spot.y, w: 200, h: 140 };
    for (const el of doc.elements) {
      const b = elementBounds(el);
      const overlap = !(box.x + box.w <= b.x || b.x + b.w <= box.x || box.y + box.h <= b.y || b.y + b.h <= box.y);
      expect(overlap).toBe(false);
    }
  });
});
