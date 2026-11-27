import assert from 'node:assert/strict';
import { OpScanner } from '../src/protocol/scanner';
import { parseProtocolScript } from '../src/protocol/parse';
import { validateOp, validateScript } from '../src/protocol/validate';
import { buildSystemPrompt, buildUserPrompt } from '../src/protocol/prompt';

let passed = 0;
let failed = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`, extra ?? '');
  }
}

const script = {
  title: 'Pythagoras',
  lang: 'en',
  steps: [
    {
      title: 'Draw the triangle',
      say: 'Start with a right triangle.',
      ops: [
        { op: 'write', id: 'title', x: 60, y: 40, text: 'Pythagoras', size: 56 },
        { op: 'line', id: 'a', x1: 200, y1: 700, x2: 500, y2: 700 },
        { op: 'line', id: 'b', x1: 500, y1: 700, x2: 500, y2: 400 },
        { op: 'line', id: 'c', x1: 200, y1: 700, x2: 500, y2: 400 },
        { op: 'rect', id: 'sq', x: 500, y: 400, w: 120, h: 120, fill: 'blue' },
      ],
    },
  ],
};

console.log('\n[1] validateOp');
{
  ok('accepts a valid write', validateOp({ op: 'write', id: 't', x: 1, y: 2, text: 'hi' }) === null);
  ok('rejects missing id', validateOp({ op: 'write', x: 1, y: 2, text: 'hi' }) === 'missing id');
  ok('rejects bad colour', validateOp({ op: 'line', id: 'l', x1: 0, y1: 0, x2: 1, y2: 1, color: 'pink' })?.includes('bad color') === true);
  ok('rejects erase with two targets', validateOp({ op: 'erase', ids: ['a'], all: true })?.includes('exactly one') === true);
  ok('accepts erase by region', validateOp({ op: 'erase', region: { x: 0, y: 0, w: 10, h: 10 } }) === null);
  ok('rejects unknown op', validateOp({ op: 'teleport', id: 'x' })?.includes('unknown op') === true);
}

console.log('\n[2] validateScript');
{
  ok('accepts a valid script', validateScript(script).length === 0, validateScript(script));
  ok('rejects missing steps', validateScript({ title: 'x' })[0].includes('steps') === true);
  ok('reports the failing op index', validateScript({ steps: [{ ops: [{ op: 'write', id: 'x', x: 1, y: 1 }] }] })[0].includes('step 1 op 1') === true);
}

console.log('\n[3] parseProtocolScript');
{
  const fenced = 'Here is the board:\n```json\n' + JSON.stringify(script) + '\n```\nEnjoy!';
  const parsed = parseProtocolScript(fenced);
  ok('parses fenced JSON with prose', parsed.script?.steps.length === 1 && parsed.errors.length === 0, parsed.errors);
  ok('keeps the title', parsed.script?.title === 'Pythagoras');
  ok('rejects garbage', parseProtocolScript('no json here').script === null);
}

console.log('\n[4] OpScanner');
{
  const json = JSON.stringify(script);
  const scanner = new OpScanner({ extended: true });
  const all = scanner.feed(json);
  ok('emits 5 ops from a complete script', all.ops.length === 5, all.ops.map((o) => o.op));
  ok('counts the completed step', all.completedSteps === 1);
  ok('parses the first op as write', all.ops[0].op === 'write');

  const split = new OpScanner({ extended: true });
  const collected: string[] = [];
  let steps = 0;
  for (const ch of json) {
    const r = split.feed(ch);
    collected.push(...r.ops.map((o) => `${o.op}:${'id' in o ? o.id : ''}`));
    steps += r.completedSteps;
  }
  ok('handles a chunk split at every character', collected.length === 5, collected);
  ok('does not duplicate ops across chunks', new Set(collected).size === 5, collected);
  ok('counts the step exactly once', steps === 1, steps);
  ok('the accumulated text is the full JSON', split.text === json);
}

console.log('\n[5] Strings with braces');
{
  const tricky = JSON.stringify({
    steps: [{ ops: [{ op: 'write', id: 'x', x: 0, y: 0, text: 'use {curly} and "quotes" \\ backslash' }] }],
  });
  const scanner = new OpScanner();
  const r = scanner.feed(tricky);
  ok('does not count braces inside strings', r.ops.length === 1, r);
  ok('preserves the text', (r.ops[0] as { text: string }).text.includes('{curly}'));
}

console.log('\n[6] Extended ops');
{
  ok('accepts image', validateOp({ op: 'image', id: 'i', x: 0, y: 0, w: 100, h: 80, src: 'https://example.com/a.png' }) === null);
  ok('accepts table', validateOp({ op: 'table', id: 't', x: 0, y: 0, columns: ['a'], rows: [['1']] }) === null);
  ok('accepts graph', validateOp({ op: 'graph', id: 'g', x: 0, y: 0, kind: 'mindmap', nodes: [{ id: 'n', label: 'N' }] }) === null);
  ok('rejects a bad graph kind', validateOp({ op: 'graph', id: 'g', x: 0, y: 0, kind: 'nope', nodes: [{ id: 'n', label: 'N' }] })?.includes('kind') === true);
  ok('rejects periodic outside 1..118', validateOp({ op: 'periodic', id: 'p', x: 0, y: 0, element: 200 })?.includes('1..118') === true);
  ok('v1-only mode rejects image', validateOp({ op: 'image', id: 'i', x: 0, y: 0, w: 10, h: 10, src: 'x' }, { extended: false })?.includes('unknown op') === true);
}

console.log('\n[7] Prompt');
{
  const system = buildSystemPrompt({ extended: true, lang: 'Arabic' });
  ok('mentions the board size', system.includes('1600 x 900'));
  ok('mentions JSON only', system.includes('Output JSON only'));
  ok('includes extended ops when enabled', system.includes('SmartBoard extension operations'));
  ok('omits extended ops when disabled', !buildSystemPrompt({ extended: false }).includes('SmartBoard extension operations'));
  const cont = buildUserPrompt({ question: 'Why?', mode: 'continue', board: { atStep: 2, objects: [] } });
  ok('builds a continuation payload', cont.includes('"mode":"continue"') && cont.includes('"atStep":2'));
}

console.log(`\n${passed} passed, ${failed} failed`);
assert.equal(failed, 0, `${failed} protocol tests failed`);
