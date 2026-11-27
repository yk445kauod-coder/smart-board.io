import type { ProtocolOp } from './types';
import { validateOp, type ValidateOptions } from './validate';

export interface ScanResult {
  /** Ops that became complete in this chunk, in order. */
  ops: ProtocolOp[];
  /** Steps whose closing brace was seen in this chunk. */
  completedSteps: number;
  /** Invalid op objects that were skipped. */
  errors: string[];
}

/**
 * Incremental scanner for the whiteboard JSON protocol.
 *
 * It tracks JSON depth (root = 1, step = 2, op = 3) and emits an op as soon as
 * its object closes, so the renderer can start drawing before the model has
 * finished the whole lesson. This mirrors `bench/common.py::OpScanner`, but
 * returns parsed objects instead of only counting them.
 */
export class OpScanner {
  private buffer = '';
  private cursor = 0;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private opStart = -1;
  private readonly options: ValidateOptions;

  constructor(options: ValidateOptions = { extended: true }) {
    this.options = options;
  }

  feed(chunk: string): ScanResult {
    const result: ScanResult = { ops: [], completedSteps: 0, errors: [] };
    if (!chunk) return result;
    this.buffer += chunk;

    for (; this.cursor < this.buffer.length; this.cursor++) {
      const ch = this.buffer[this.cursor];

      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (ch === '\\') this.escaped = true;
        else if (ch === '"') this.inString = false;
        continue;
      }

      if (ch === '"') {
        this.inString = true;
        continue;
      }

      if (ch === '{') {
        if (this.depth === 2) this.opStart = this.cursor;
        this.depth++;
        continue;
      }

      if (ch === '}') {
        if (this.depth === 3 && this.opStart >= 0) {
          const raw = this.buffer.slice(this.opStart, this.cursor + 1);
          this.opStart = -1;
          try {
            const parsed = JSON.parse(raw) as unknown;
            const err = validateOp(parsed, this.options);
            if (err) result.errors.push(err);
            else result.ops.push(parsed as ProtocolOp);
          } catch (err) {
            result.errors.push(`op JSON error: ${(err as Error).message}`);
          }
        } else if (this.depth === 2) {
          result.completedSteps++;
        }
        this.depth--;
        if (this.depth < 0) {
          this.reset();
          break;
        }
      }
    }

    return result;
  }

  /** Full text seen so far (useful for parsing narration at the end). */
  get text(): string {
    return this.buffer;
  }

  reset(): void {
    this.buffer = '';
    this.cursor = 0;
    this.depth = 0;
    this.inString = false;
    this.escaped = false;
    this.opStart = -1;
  }
}
