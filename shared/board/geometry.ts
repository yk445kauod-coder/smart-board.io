import { BOARD_HEIGHT, BOARD_WIDTH, type BoardDoc, type BoardElement } from './model';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

export function normalizeBox(x1: number, y1: number, x2: number, y2: number): Box {
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  };
}

export function elementBounds(el: BoardElement): Box {
  switch (el.kind) {
    case 'stroke': {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of el.points) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const pad = el.width / 2;
      return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
    }
    case 'line': {
      const pad = el.strokeWidth / 2;
      return {
        x: Math.min(el.x1, el.x2) - pad,
        y: Math.min(el.y1, el.y2) - pad,
        w: Math.abs(el.x2 - el.x1) + pad * 2,
        h: Math.abs(el.y2 - el.y1) + pad * 2,
      };
    }
    default:
      return { x: el.x, y: el.y, w: el.w, h: el.h };
  }
}

export function containsPoint(box: Box, p: Pt, tolerance = 0): boolean {
  return (
    p.x >= box.x - tolerance &&
    p.x <= box.x + box.w + tolerance &&
    p.y >= box.y - tolerance &&
    p.y <= box.y + box.h + tolerance
  );
}

export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function hitsElement(el: BoardElement, p: Pt, tolerance: number): boolean {
  if (el.kind === 'stroke') {
    const reach = el.width / 2 + tolerance;
    for (let i = 1; i < el.points.length; i += 1) {
      const a = el.points[i - 1];
      const b = el.points[i];
      if (a && b && distanceToSegment(p, a, b) <= reach) return true;
    }
    return false;
  }
  if (el.kind === 'line') {
    return distanceToSegment(p, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }) <= el.strokeWidth / 2 + tolerance;
  }
  return containsPoint(elementBounds(el), p, tolerance);
}

/** Topmost element under the point (paint order: last element wins). */
export function hitTest(doc: BoardDoc, p: Pt, tolerance = 6): BoardElement | null {
  for (let i = doc.elements.length - 1; i >= 0; i -= 1) {
    const el = doc.elements[i];
    if (el && hitsElement(el, p, tolerance)) return el;
  }
  return null;
}

const MIN_VISIBLE = 32;

function clampAxis(pos: number, size: number, limit: number): number {
  if (size >= limit) return Math.max(limit - size, Math.min(0, pos));
  return Math.max(0, Math.min(limit - size, pos));
}

export function clampElement(el: BoardElement): BoardElement {
  switch (el.kind) {
    case 'stroke': {
      const b = elementBounds(el);
      const x = clampAxis(b.x, b.w, BOARD_WIDTH);
      const y = clampAxis(b.y, b.h, BOARD_HEIGHT);
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx === 0 && dy === 0) return el;
      return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    }
    case 'line': {
      const b = elementBounds(el);
      const x = clampAxis(b.x, b.w, BOARD_WIDTH);
      const y = clampAxis(b.y, b.h, BOARD_HEIGHT);
      const dx = x - b.x;
      const dy = y - b.y;
      if (dx === 0 && dy === 0) return el;
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    }
    default:
      return {
        ...el,
        x: clampAxis(el.x, Math.min(el.w, BOARD_WIDTH - MIN_VISIBLE), BOARD_WIDTH),
        y: clampAxis(el.y, Math.min(el.h, BOARD_HEIGHT - MIN_VISIBLE), BOARD_HEIGHT),
      };
  }
}

export function translateElement(el: BoardElement, dx: number, dy: number): BoardElement {
  if (el.kind === 'stroke') return { ...el, points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  if (el.kind === 'line') {
    return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}

function overlaps(a: Box, b: Box, gap: number): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

/**
 * Finds a free position for a new box, scanning a coarse grid around the preferred
 * spot. Text/sticky overlap avoidance belongs in code, not in the model.
 */
export function findFreeSpot(doc: BoardDoc, w: number, h: number, preferred: Pt, gap = 14): Pt {
  const others = doc.elements.map(elementBounds);
  const startX = clampAxis(preferred.x, w, BOARD_WIDTH);
  const startY = clampAxis(preferred.y, h, BOARD_HEIGHT);
  const candidates: Pt[] = [{ x: startX, y: startY }];
  const step = 40;
  for (let ring = 1; ring <= 12; ring += 1) {
    for (let dy = -ring; dy <= ring; dy += 1) {
      for (let dx = -ring; dx <= ring; dx += 1) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        candidates.push({ x: startX + dx * step, y: startY + dy * step });
      }
    }
  }
  for (const c of candidates) {
    const x = clampAxis(c.x, w, BOARD_WIDTH);
    const y = clampAxis(c.y, h, BOARD_HEIGHT);
    const box = { x, y, w, h };
    if (!others.some((b) => overlaps(box, b, gap))) return { x, y };
  }
  return { x: startX, y: startY };
}

export function nextZ(doc: BoardDoc): number {
  return doc.elements.reduce((max, el) => Math.max(max, el.z ?? 0), 0) + 1;
}

/** Re-numbers z to match paint order so exports and the agent stay deterministic. */
export function normalizeZ(doc: BoardDoc): BoardDoc {
  return { ...doc, elements: doc.elements.map((el, i) => ({ ...el, z: i + 1 })) };
}
