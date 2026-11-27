const COLORS = new Set(['ink', 'blue', 'red', 'green', 'gray']);

const color = (value: unknown): 'ink' | 'blue' | 'red' | 'green' | 'gray' =>
  typeof value === 'string' && COLORS.has(value) ? (value as 'ink' | 'blue' | 'red' | 'green' | 'gray') : 'ink';

/**
 * LLMs occasionally invent colours or use `r` for a circle radius. Keep the
 * generated protocol valid without hiding structural errors from validation.
 */
export function sanitizeScript(input: unknown): unknown {
  if (!input || typeof input !== 'object') return input;
  const script = input as { steps?: unknown };
  if (!Array.isArray(script.steps)) return input;
  for (const step of script.steps) {
    if (!step || typeof step !== 'object') continue;
    const ops = (step as { ops?: unknown }).ops;
    if (!Array.isArray(ops)) continue;
    for (const op of ops) {
      if (!op || typeof op !== 'object') continue;
      const o = op as Record<string, unknown>;
      if (o.color !== undefined) o.color = color(o.color);
      if (o.fill !== undefined && !COLORS.has(String(o.fill))) delete o.fill;
      if (o.op === 'ellipse' && o.rx === undefined && o.ry === undefined && typeof o.r === 'number') {
        o.rx = o.r;
        o.ry = o.r;
        delete o.r;
      }
      if (o.op === 'write' && typeof o.text === 'number') o.text = String(o.text);
    }
  }
  return script;
}
