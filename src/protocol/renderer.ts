import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  COLORS,
  FILLS,
  type BoardObjectState,
  type BoardState,
  type ProtocolColor,
  type ProtocolOp,
} from './types';

const NS = 'http://www.w3.org/2000/svg';

type Tracked = {
  op: ProtocolOp;
  node: SVGGElement;
  bbox: { x: number; y: number; w: number; h: number };
  text?: string;
};

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

const colorOf = (c?: ProtocolColor): string => COLORS[c || 'ink'] || COLORS.ink;
const fillOf = (c?: ProtocolColor): string => (c ? FILLS[c] : 'none');

const estimateText = (text: string, size: number, anchor: 'start' | 'middle' = 'start') => {
  const lines = text.split('\n');
  const width = Math.max(...lines.map((l) => l.length * size * 0.55), size);
  const height = lines.length * size * 1.3;
  return { width, height, lines, anchor };
};

/**
 * Imperative SVG renderer for the whiteboard protocol.
 *
 * The React wrapper owns the <svg> element; this class applies ops as they
 * arrive from the stream. Keeping the renderer imperative makes it easy to
 * port the reference player's animation code without rewriting it in React.
 */
export class ProtocolRenderer {
  readonly svg: SVGSVGElement;
  private layer: SVGGElement;
  private objects = new Map<string, Tracked>();
  private markerId: string;
  private seq = 0;

  constructor(svg: SVGSVGElement) {
    this.svg = svg;
    this.markerId = `sb-arrow-${Math.random().toString(36).slice(2, 8)}`;
    svg.setAttribute('viewBox', `0 0 ${BOARD_WIDTH} ${BOARD_HEIGHT}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.replaceChildren();

    const defs = el('defs');
    const marker = el('marker', {
      id: this.markerId,
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 7,
      markerHeight: 7,
      orient: 'auto-start-reverse',
    });
    marker.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'context-stroke' }));
    defs.appendChild(marker);
    svg.appendChild(defs);

    this.layer = el('g');
    svg.appendChild(this.layer);
  }

  reset(): void {
    this.objects.clear();
    this.layer.replaceChildren();
  }

  apply(op: ProtocolOp): void {
    try {
      if (op.op === 'erase') {
        this.erase(op);
        return;
      }
      if (op.op === 'update') {
        this.update(op);
        return;
      }
      const g = el('g', { 'data-id': 'id' in op ? op.id : `anon-${++this.seq}` });
      const tracked = this.build(op, g);
      this.layer.appendChild(g);
      if ('id' in op && op.id) this.objects.set(op.id, tracked);
    } catch (err) {
      // A malformed op should never take the whole board down.
      console.warn('ProtocolRenderer: skipped op', op, err);
    }
  }

  getState(atStep = 0): BoardState {
    const objects: BoardObjectState[] = [];
    for (const [id, t] of this.objects) {
      objects.push({ id, type: t.op.op, bbox: t.bbox, text: t.text });
    }
    return { atStep, objects };
  }

  private build(op: Exclude<ProtocolOp, { op: 'erase' } | { op: 'update' }>, g: SVGGElement): Tracked {
    switch (op.op) {
      case 'write': {
        const size = op.size || 40;
        const est = estimateText(op.text, size, op.anchor || 'start');
        const text = el('text', {
          x: op.x,
          y: op.y + size,
          fill: colorOf(op.color),
          'font-size': size,
          'font-family': "'Kalam', 'Playpen Sans Arabic', 'Segoe UI', cursive",
          'text-anchor': op.anchor === 'middle' ? 'middle' : 'start',
          'data-op': 'write',
        });
        est.lines.forEach((line, i) => {
          const tspan = el('tspan', { x: op.x, dy: i === 0 ? 0 : size * 1.3 });
          tspan.textContent = line;
          text.appendChild(tspan);
        });
        if (op.underline) {
          const y = op.y + size + 6;
          const x1 = op.anchor === 'middle' ? op.x - est.width / 2 : op.x;
          g.appendChild(el('line', { x1, y1: y, x2: x1 + est.width, y2: y, stroke: colorOf(op.color), 'stroke-width': 2 }));
        }
        g.appendChild(text);
        this.reveal(g);
        return { op, node: g, bbox: { x: op.x, y: op.y, w: est.width, h: est.height }, text: op.text };
      }
      case 'line': {
        const line = el('line', {
          x1: op.x1,
          y1: op.y1,
          x2: op.x2,
          y2: op.y2,
          stroke: colorOf(op.color),
          'stroke-width': op.width || 5,
          'stroke-linecap': 'round',
          'stroke-dasharray': typeof op.dash === 'string' ? op.dash : op.dash ? '10 8' : '',
          'marker-end': op.arrow === true || op.arrow === 'both' ? `url(#${this.markerId})` : '',
          'marker-start': op.arrow === 'both' ? `url(#${this.markerId})` : '',
        });
        g.appendChild(line);
        this.revealStroke(line);
        return {
          op,
          node: g,
          bbox: {
            x: Math.min(op.x1, op.x2),
            y: Math.min(op.y1, op.y2),
            w: Math.abs(op.x2 - op.x1),
            h: Math.abs(op.y2 - op.y1),
          },
        };
      }
      case 'rect': {
        const rect = el('rect', {
          x: op.x,
          y: op.y,
          width: op.w,
          height: op.h,
          fill: fillOf(op.fill),
          stroke: colorOf(op.color),
          'stroke-width': op.width || 5,
          rx: 8,
        });
        g.appendChild(rect);
        this.revealStroke(rect);
        return { op, node: g, bbox: { x: op.x, y: op.y, w: op.w, h: op.h } };
      }
      case 'ellipse': {
        const ellipse = el('ellipse', {
          cx: op.cx,
          cy: op.cy,
          rx: op.rx,
          ry: op.ry,
          fill: fillOf(op.fill),
          stroke: colorOf(op.color),
          'stroke-width': op.width || 5,
          transform: op.rotate ? `rotate(${op.rotate} ${op.cx} ${op.cy})` : '',
        });
        g.appendChild(ellipse);
        this.revealStroke(ellipse);
        return { op, node: g, bbox: { x: op.cx - op.rx, y: op.cy - op.ry, w: op.rx * 2, h: op.ry * 2 } };
      }
      case 'path': {
        const path = el('path', {
          d: op.d,
          fill: op.fill ? fillOf(op.fill) : 'none',
          stroke: colorOf(op.color),
          'stroke-width': op.width || 5,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'stroke-dasharray': typeof op.dash === 'string' ? op.dash : op.dash ? '10 8' : '',
          'marker-end': op.arrow === true || op.arrow === 'both' ? `url(#${this.markerId})` : '',
          'marker-start': op.arrow === 'both' ? `url(#${this.markerId})` : '',
        });
        g.appendChild(path);
        this.revealStroke(path);
        const box = (path as unknown as SVGGraphicsElement).getBBox();
        return { op, node: g, bbox: { x: box.x, y: box.y, w: box.width, h: box.height } };
      }
      case 'image': {
        const image = el('image', {
          x: op.x,
          y: op.y,
          width: op.w,
          height: op.h,
          href: op.src,
          preserveAspectRatio: 'xMidYMid meet',
        });
        g.appendChild(image);
        this.reveal(g);
        return { op, node: g, bbox: { x: op.x, y: op.y, w: op.w, h: op.h } };
      }
      case 'table': {
        const tracked = this.buildTable(op, g);
        this.reveal(g);
        return tracked;
      }
      case 'graph': {
        const tracked = this.buildGraph(op, g);
        this.reveal(g);
        return tracked;
      }
      case 'atlas':
      case 'periodic':
      case 'widget': {
        const w = 'w' in op ? op.w : 420;
        const h = 'h' in op ? op.h : 280;
        const box = el('rect', {
          x: op.x,
          y: op.y,
          width: w,
          height: h,
          fill: 'rgba(37,99,235,.06)',
          stroke: colorOf('blue'),
          'stroke-width': 3,
          'stroke-dasharray': '10 8',
          rx: 10,
        });
        const label = el('text', {
          x: op.x + 16,
          y: op.y + 32,
          fill: colorOf('blue'),
          'font-size': 22,
          'font-family': 'system-ui, sans-serif',
        });
        label.textContent =
          op.op === 'atlas'
            ? `Atlas · ${op.region}`
            : op.op === 'periodic'
              ? `Periodic table · element ${op.element}`
              : `Widget · ${op.kind}`;
        g.append(box, label);
        this.reveal(g);
        return { op, node: g, bbox: { x: op.x, y: op.y, w, h } };
      }
      default: {
        const never: never = op;
        throw new Error(`unsupported op ${JSON.stringify(never)}`);
      }
    }
  }

  private buildTable(op: Extract<ProtocolOp, { op: 'table' }>, g: SVGGElement): Tracked {
    const cols = Math.max(op.columns.length, 1);
    const cellW = 180;
    const rowH = 42;
    const w = cols * cellW;
    const h = (op.rows.length + 1) * rowH + (op.title ? 40 : 0);
    const top = op.y + (op.title ? 40 : 0);
    if (op.title) {
      const title = el('text', { x: op.x, y: op.y + 26, fill: colorOf(op.color), 'font-size': 26, 'font-family': 'system-ui, sans-serif', 'font-weight': 700 });
      title.textContent = op.title;
      g.appendChild(title);
    }
    const table = el('g');
    for (let r = 0; r <= op.rows.length; r++) {
      table.appendChild(el('rect', {
        x: op.x,
        y: top + r * rowH,
        width: w,
        height: rowH,
        fill: r === 0 ? 'rgba(37,99,235,.10)' : r % 2 ? 'rgba(0,0,0,.02)' : 'none',
        stroke: colorOf(op.color),
        'stroke-width': 1.5,
      }));
    }
    for (let c = 1; c < cols; c++) {
      table.appendChild(el('line', { x1: op.x + c * cellW, y1: top, x2: op.x + c * cellW, y2: top + (op.rows.length + 1) * rowH, stroke: colorOf(op.color), 'stroke-width': 1.5 }));
    }
    const cell = (text: string, r: number, c: number, bold = false) => {
      const t = el('text', {
        x: op.x + c * cellW + 10,
        y: top + r * rowH + 27,
        fill: colorOf(op.color),
        'font-size': 18,
        'font-family': 'system-ui, sans-serif',
        'font-weight': bold ? 700 : 400,
      });
      t.textContent = text;
      table.appendChild(t);
    };
    op.columns.forEach((c, i) => cell(c, 0, i, true));
    op.rows.forEach((row, r) => row.forEach((c, i) => cell(c, r + 1, i)));
    g.appendChild(table);
    return { op, node: g, bbox: { x: op.x, y: op.y, w, h } };
  }

  private buildGraph(op: Extract<ProtocolOp, { op: 'graph' }>, g: SVGGElement): Tracked {
    const nodeW = 160;
    const nodeH = 52;
    const gapX = 60;
    const gapY = 40;
    const perRow = Math.max(1, Math.min(4, Math.ceil(Math.sqrt(op.nodes.length))));
    const positions = new Map<string, { x: number; y: number }>();
    op.nodes.forEach((n, i) => {
      const col = i % perRow;
      const row = Math.floor(i / perRow);
      positions.set(n.id, { x: op.x + col * (nodeW + gapX), y: op.y + 40 + row * (nodeH + gapY) });
    });
    if (op.title) {
      const title = el('text', { x: op.x, y: op.y + 26, fill: colorOf(op.color), 'font-size': 26, 'font-family': 'system-ui, sans-serif', 'font-weight': 700 });
      title.textContent = op.title;
      g.appendChild(title);
    }
    for (const edge of op.edges || []) {
      const a = positions.get(edge.from);
      const b = positions.get(edge.to);
      if (!a || !b) continue;
      g.appendChild(el('line', {
        x1: a.x + nodeW / 2,
        y1: a.y + nodeH / 2,
        x2: b.x + nodeW / 2,
        y2: b.y + nodeH / 2,
        stroke: colorOf('gray'),
        'stroke-width': 2,
        'marker-end': `url(#${this.markerId})`,
      }));
    }
    for (const n of op.nodes) {
      const p = positions.get(n.id)!;
      g.appendChild(el('rect', { x: p.x, y: p.y, width: nodeW, height: nodeH, rx: 10, fill: 'rgba(37,99,235,.06)', stroke: colorOf(n.color || 'blue'), 'stroke-width': 2 }));
      const t = el('text', { x: p.x + nodeW / 2, y: p.y + 32, fill: colorOf(n.color || 'ink'), 'font-size': 18, 'font-family': 'system-ui, sans-serif', 'text-anchor': 'middle' });
      t.textContent = n.label;
      g.appendChild(t);
    }
    const rows = Math.ceil(op.nodes.length / perRow);
    return { op, node: g, bbox: { x: op.x, y: op.y, w: perRow * (nodeW + gapX), h: 40 + rows * (nodeH + gapY) } };
  }

  private update(op: Extract<ProtocolOp, { op: 'update' }>): void {
    const tracked = this.objects.get(op.id);
    if (!tracked) return;
    if (op.text !== undefined) {
      const text = tracked.node.querySelector('text');
      if (text) text.textContent = op.text;
      tracked.text = op.text;
    }
    if (op.color !== undefined) {
      tracked.node.querySelectorAll('[stroke]').forEach((n) => n.setAttribute('stroke', colorOf(op.color)));
      tracked.node.querySelectorAll('text').forEach((n) => n.setAttribute('fill', colorOf(op.color)));
    }
    if (op.x !== undefined || op.y !== undefined) {
      const dx = (op.x ?? tracked.bbox.x) - tracked.bbox.x;
      const dy = (op.y ?? tracked.bbox.y) - tracked.bbox.y;
      tracked.node.setAttribute('transform', `translate(${dx} ${dy})`);
      tracked.bbox = { ...tracked.bbox, x: tracked.bbox.x + dx, y: tracked.bbox.y + dy };
    }
  }

  private erase(op: Extract<ProtocolOp, { op: 'erase' }>): void {
    if (op.all) {
      this.reset();
      return;
    }
    if (op.ids) {
      for (const id of op.ids) {
        const t = this.objects.get(id);
        if (t) {
          t.node.remove();
          this.objects.delete(id);
        }
      }
      return;
    }
    if (op.region) {
      const { x, y, w, h } = op.region;
      for (const [id, t] of [...this.objects]) {
        const cx = t.bbox.x + t.bbox.w / 2;
        const cy = t.bbox.y + t.bbox.h / 2;
        if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) {
          t.node.remove();
          this.objects.delete(id);
        }
      }
    }
  }

  private reveal(node: SVGElement): void {
    node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'both' });
  }

  private revealStroke(node: SVGElement): void {
    const geometry = node as unknown as SVGGeometryElement;
    if (typeof geometry.getTotalLength !== 'function') {
      this.reveal(node);
      return;
    }
    try {
      const len = geometry.getTotalLength();
      if (!Number.isFinite(len) || len <= 0) {
        this.reveal(node);
        return;
      }
      const dash = node.getAttribute('stroke-dasharray');
      if (dash) {
        this.reveal(node);
        return;
      }
      node.setAttribute('stroke-dasharray', String(len));
      node.setAttribute('stroke-dashoffset', String(len));
      geometry.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: Math.min(900, 180 + len * 0.6), easing: 'ease-out', fill: 'both' },
      );
    } catch {
      this.reveal(node);
    }
  }
}
