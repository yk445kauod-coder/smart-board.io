import { textToBoardCommands } from '../services/ai/omnirouter/providers';
import { layoutCommands } from '../services/ai/omnirouter/boardSchema';

// Text captured verbatim from the LIVE deployed /api/chat just now.
const live = JSON.stringify({
  commands: [
    { command: 'addWordArt', content: 'الخلية النباتية' },
    { command: 'addNote', content: 'الخلية هي وحدة بناء الكائن الحي.' },
    { command: 'addList', content: ['الجدار الخلوي', 'البلاستيدات', 'الفجوة العصارية'] },
  ],
});

const cmds = textToBoardCommands(live);
let fail = 0;
const ok = (n: string, c: boolean, extra = '') => {
  if (!c) { fail++; console.log('FAIL', n, extra); } else console.log('ok  ', n, extra);
};

ok('disc key canonicalized to action', cmds.every(c => (c as any).action) && cmds[0].action === 'addWordArt');
ok('no type/command leak', cmds.every(c => (c as any).type === undefined && (c as any).command === undefined));
ok('wordArt text derived from content', (cmds[0] as any).text === 'الخلية النباتية');
ok('note keeps content', (cmds[1] as any).content?.includes('الخلية'));
ok('addList items from array content', Array.isArray((cmds[2] as any).items) && (cmds[2] as any).items.length === 3);

const laid = layoutCommands(cmds);
ok('all 3 actionable after layout', laid.filter(c => (c as any).action && !(c as any).skip).length === 3);

console.log(fail ? `\nRESULT: FAIL ${fail}` : '\nRESULT: ALL OK');
process.exit(fail ? 1 : 0);