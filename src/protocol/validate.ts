import { COLORS, EXTENDED_OPS, V1_OPS, type ProtocolColor, type ProtocolOp, type ProtocolScript } from './types';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isColor = (v: unknown): v is ProtocolColor => typeof v === 'string' && v in COLORS;
const isPos = (v: unknown): v is number => isNum(v) && v > 0;

export interface ValidateOptions {
  /** Allow SmartBoard extension ops (image/table/graph/atlas/periodic/widget/update). */
  extended?: boolean;
}

export function validateOp(op: unknown, options: ValidateOptions = {}): string | null {
  if (!op || typeof op !== 'object') return 'not an object';
  const o = op as Record<string, unknown>;
  const kind = o.op;
  if (typeof kind !== 'string') return 'missing op';
  const known = new Set<string>([...V1_OPS, ...(options.extended === false ? [] : EXTENDED_OPS)]);
  if (!known.has(kind)) return `unknown op ${JSON.stringify(kind)}`;

  if (kind === 'erase') {
    const n = ['ids', 'region', 'all'].filter((f) => o[f] !== undefined && o[f] !== null && o[f] !== false).length;
    if (n !== 1) return 'erase needs exactly one of ids/region/all';
    if (o.ids !== undefined) {
      if (!Array.isArray(o.ids) || !o.ids.every((s) => typeof s === 'string' && s.length > 0)) return 'ids must be a string array';
    }
    if (o.region !== undefined) {
      const r = o.region as Record<string, unknown>;
      if (!r || !['x', 'y', 'w', 'h'].every((f) => isNum(r[f]))) return 'region needs numeric x,y,w,h';
    }
    if (o.all !== undefined && typeof o.all !== 'boolean') return 'all must be boolean';
    return null;
  }

  if (!isStr(o.id)) return 'missing id';
  if (o.color !== undefined && !isColor(o.color)) return `bad color ${JSON.stringify(o.color)}`;
  if (o.width !== undefined && !isPos(o.width)) return 'width must be positive';

  switch (kind) {
    case 'write':
      if (!isNum(o.x) || !isNum(o.y)) return 'write needs numeric x,y';
      if (!isStr(o.text)) return 'write needs text';
      if (o.size !== undefined && !isPos(o.size)) return 'size must be positive';
      if (o.anchor !== undefined && o.anchor !== 'start' && o.anchor !== 'middle') return 'bad anchor';
      if (o.underline !== undefined && typeof o.underline !== 'boolean') return 'underline must be boolean';
      return null;
    case 'line':
      if (!['x1', 'y1', 'x2', 'y2'].every((f) => isNum(o[f]))) return 'line needs numeric x1,y1,x2,y2';
      if (o.arrow !== undefined && o.arrow !== true && o.arrow !== false && o.arrow !== 'both') return 'bad arrow';
      if (o.dash !== undefined && typeof o.dash !== 'boolean' && typeof o.dash !== 'string') return 'bad dash';
      return null;
    case 'rect':
      if (!['x', 'y', 'w', 'h'].every((f) => isNum(o[f]))) return 'rect needs numeric x,y,w,h';
      if ((o.w as number) <= 0 || (o.h as number) <= 0) return 'rect w/h must be positive';
      if (o.fill !== undefined && !isColor(o.fill)) return 'bad fill';
      return null;
    case 'ellipse':
      if (!['cx', 'cy', 'rx', 'ry'].every((f) => isNum(o[f]))) return 'ellipse needs numeric cx,cy,rx,ry';
      if ((o.rx as number) <= 0 || (o.ry as number) <= 0) return 'ellipse rx/ry must be positive';
      if (o.rotate !== undefined && !isNum(o.rotate)) return 'rotate must be numeric';
      if (o.fill !== undefined && !isColor(o.fill)) return 'bad fill';
      return null;
    case 'path':
      if (!isStr(o.d)) return 'path needs d';
      if (o.fill !== undefined && !isColor(o.fill)) return 'bad fill';
      return null;
    case 'image':
      if (!['x', 'y', 'w', 'h'].every((f) => isNum(o[f]))) return 'image needs numeric x,y,w,h';
      if ((o.w as number) <= 0 || (o.h as number) <= 0) return 'image w/h must be positive';
      if (!isStr(o.src)) return 'image needs src';
      return null;
    case 'table':
      if (!isNum(o.x) || !isNum(o.y)) return 'table needs numeric x,y';
      if (!Array.isArray(o.columns) || !o.columns.every((c) => typeof c === 'string')) return 'table columns must be strings';
      if (!Array.isArray(o.rows) || !o.rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === 'string'))) return 'table rows must be string arrays';
      return null;
    case 'graph':
      if (!isNum(o.x) || !isNum(o.y)) return 'graph needs numeric x,y';
      if (!['mindmap', 'flowchart', 'timeline', 'diagram'].includes(String(o.kind))) return 'bad graph kind';
      if (!Array.isArray(o.nodes) || !o.nodes.every((n) => n && typeof n === 'object' && isStr((n as Record<string, unknown>).id) && typeof (n as Record<string, unknown>).label === 'string')) {
        return 'graph nodes need id + label';
      }
      if (o.edges !== undefined && (!Array.isArray(o.edges) || !o.edges.every((e) => e && typeof e === 'object' && typeof (e as Record<string, unknown>).from === 'string' && typeof (e as Record<string, unknown>).to === 'string'))) {
        return 'graph edges need from + to';
      }
      return null;
    case 'atlas':
      if (!['x', 'y', 'w', 'h'].every((f) => isNum(o[f]))) return 'atlas needs numeric x,y,w,h';
      if (!isStr(o.region)) return 'atlas needs region';
      return null;
    case 'periodic':
      if (!isNum(o.x) || !isNum(o.y)) return 'periodic needs numeric x,y';
      if (!isNum(o.element) || o.element < 1 || o.element > 118) return 'periodic element must be 1..118';
      return null;
    case 'widget':
      if (!['x', 'y', 'w', 'h'].every((f) => isNum(o[f]))) return 'widget needs numeric x,y,w,h';
      if (!isStr(o.kind)) return 'widget needs kind';
      return null;
    case 'update':
      if (!isStr(o.id)) return 'update needs id';
      if (o.text === undefined && o.x === undefined && o.y === undefined && o.color === undefined) return 'update needs text/x/y/color';
      return null;
    default:
      return `unknown op ${JSON.stringify(kind)}`;
  }
}

export function isProtocolOp(op: unknown, options: ValidateOptions = {}): op is ProtocolOp {
  return validateOp(op, options) === null;
}

export function validateScript(script: unknown, options: ValidateOptions = {}): string[] {
  if (!script || typeof script !== 'object') return ['script is not an object'];
  const s = script as Record<string, unknown>;
  if (s.title !== undefined && typeof s.title !== 'string') return ['title must be a string'];
  if (s.lang !== undefined && typeof s.lang !== 'string') return ['lang must be a string'];
  if (!Array.isArray(s.steps)) return ['no steps array'];
  if (s.steps.length === 0) return ['steps array is empty'];
  const errors: string[] = [];
  s.steps.forEach((step, si) => {
    if (!step || typeof step !== 'object') {
      errors.push(`step ${si + 1}: not an object`);
      return;
    }
    const st = step as Record<string, unknown>;
    if (st.title !== undefined && typeof st.title !== 'string') errors.push(`step ${si + 1}: title must be a string`);
    if (st.say !== undefined && typeof st.say !== 'string') errors.push(`step ${si + 1}: say must be a string`);
    if (!Array.isArray(st.ops)) {
      errors.push(`step ${si + 1}: ops missing`);
      return;
    }
    st.ops.forEach((op, oi) => {
      const err = validateOp(op, options);
      if (err) errors.push(`step ${si + 1} op ${oi + 1}: ${err}`);
    });
  });
  return errors;
}

export function isProtocolScript(script: unknown, options: ValidateOptions = {}): script is ProtocolScript {
  return validateScript(script, options).length === 0;
}
