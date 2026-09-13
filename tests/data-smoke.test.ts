import { ELEMENTS, ELEMENT_BY_SYMBOL, ELEMENT_BY_NUMBER } from '../data/periodic';
import { WORLD, EGYPT, WORLD_PINS, PIN_BY_ID } from '../data/atlas';
import { THEMES, defaultInk, isDarkTheme } from '../data/themes';
let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, extra ?? ''); }
}

console.log('\n[data] periodic table smoke');
{
  ok('118 elements', ELEMENTS.length === 118, ELEMENTS.length);
  ok('H number 1', ELEMENT_BY_SYMBOL.H && ELEMENT_BY_SYMBOL.H.n === 1);
  ok('Fe number 26', ELEMENT_BY_SYMBOL.Fe && ELEMENT_BY_SYMBOL.Fe.n === 26);
  ok('O has Arabic name', ELEMENT_BY_SYMBOL.O && !!ELEMENT_BY_SYMBOL.O.ar);
  ok('lookup by number 79 -> Au', ELEMENT_BY_NUMBER[79] && ELEMENT_BY_NUMBER[79].sym === 'Au');
  ok('category on element', ELEMENT_BY_NUMBER[6].cat === 'nonmetal');
  ok('grid position on H', ELEMENT_BY_NUMBER[1].r === 1 && ELEMENT_BY_NUMBER[1].c === 1, ELEMENT_BY_NUMBER[1]);

  let gridMissing = 0;
  for (const el of ELEMENTS) if (!el.r || !el.c) gridMissing++;
  ok('all elements have grid pos', gridMissing === 0, gridMissing);
  let dupPos = new Map<string, boolean>(), dupes = 0;
  for (const el of ELEMENTS) { const k = `${el.r},${el.c}`; if (dupPos.has(k)) dupes++; dupPos.set(k, true); }
  ok('no duplicate grid positions', dupes === 0, dupes);
  ok('lanthanide La row 9', ELEMENT_BY_NUMBER[57].r === 9, ELEMENT_BY_NUMBER[57]);
  ok('actinide Ac row 10', ELEMENT_BY_NUMBER[89].r === 10, ELEMENT_BY_NUMBER[89]);
}

console.log('\n[data] atlas smoke');
{
  ok('WORLD regions count >= 7', WORLD.length >= 7, WORLD.length);
  const ids = new Set(WORLD.map(r => r.id));
  ok('has n-america', ids.has('n-america'));
  // every region has a valid non-empty polygon points string (numeric pairs)
  for (const r of WORLD) {
    const okPts = /^[0-9.,\s]+$/.test(r.points) && r.points.split(' ').length >= 3;
    ok(`region ${r.id} has valid polygon points`, okPts, r.points.slice(0, 40));
  }
  ok('EGYPT object exists with governorates', !!EGYPT && EGYPT.id === 'egypt' && Object.keys(EGYPT.governorates).length >= 5);
  // every governorate has coords
  let govBad = 0;
  for (const k of Object.keys(EGYPT.governorates)) {
    const g = EGYPT.governorates[k as keyof typeof EGYPT['governorates']];
    if (typeof g.x !== 'number' || typeof g.y !== 'number') govBad++;
  }
  ok('all Egypt governorates have coords', govBad === 0, govBad);
  ok('PIN_BY_ID resolves', !!PIN_BY_ID[WORLD_PINS[0].id]);
  const dupPinIds = new Set<string>(); let pinDupe = 0;
  for (const p of WORLD_PINS) { if (dupPinIds.has(p.id)) pinDupe++; dupPinIds.add(p.id); }
  ok('no duplicate pin ids', pinDupe === 0, pinDupe);
  ok('Egypt pin exists in world pins', !!PIN_BY_ID.egypt);
}

console.log('\n[data] themes smoke');
{
  ok('themes include green blackboard (chalk)', !!THEMES.chalk, !!THEMES.chalk);
  ok('themes include white', !!THEMES.white);
  ok('themes include black', !!THEMES.black);
  for (const key of Object.keys(THEMES)) {
    const t = THEMES[key as keyof typeof THEMES] as any;
    ok(`theme ${key} has bg+grid+ink`, typeof t.bg === 'string' && typeof t.grid === 'string' && typeof t.ink === 'string', t);
  }
  ok('defaultInk chalk -> white', defaultInk('chalk') === '#ffffff');
  ok('isDarkTheme black', isDarkTheme('black') === true);
}

console.log(`\nPASS ${passed}  FAIL ${failed}`);
process.exit(failed ? 1 : 0);