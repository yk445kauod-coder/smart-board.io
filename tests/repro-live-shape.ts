import { textToBoardCommands, normalizeBoardCommand } from '../services/ai/omnirouter/providers';
import { layoutCommands } from '../services/ai/omnirouter/boardSchema';

let failed = 0;
const ok = (n: string, c: boolean, e?: unknown) => { console.log(`${c ? '✓' : '✗'} ${n}`, c ? '' : e); if (!c) failed++; };

// Exact shape returned by Cloudflare GLM in the live test:
const live = JSON.stringify({ commands: [
  { type: 'addWordArt', content: 'دورة الماء' },
  { type: 'addList', content: ['التبخر','التكاثف','الهطول'] },
  { type: 'addNote', content: 'شرح المرحلة' },
]});

const cmds = textToBoardCommands(live);
ok('type -> action normalized (addWordArt)', cmds[0]?.action === 'addWordArt');
ok('content -> text for addWordArt', (cmds[0] as any).text === 'دورة الماء');
ok('content[] -> items for addList', Array.isArray((cmds[1] as any).items) && (cmds[1] as any).items.length === 3);
ok('addNote keeps content string', (cmds[2] as any).content === 'شرح المرحلة');
const laid = layoutCommands(cmds as any);
const nodes: any[] = [];
for (const c of laid as any[]) {
  if ((c as any).action === 'connect') { /* edges */ }
  else if ((c as any).action) nodes.push(c);
  else console.log('DROPPED command (no action):', JSON.stringify(c));
}
ok(`commands applied to board: ${nodes.length}`, nodes.length === 3, laid);
ok('no raw `type` key leaks through', laid.every((c: any) => c.type === undefined));

console.log(failed ? `\nFAIL ${failed}` : '\nALL OK');