import { balanceEquation, doesDisplace, parseFormula } from '../data/chemistry';
let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`, extra ?? ''); }
}

console.log('\n[lab] chemistry engine smoke');
{
  const eq = balanceEquation(['H2', 'O2'], ['H2O']);
  ok('H2+O2 -> H2O', eq.balanced, eq);
  const map = new Map(eq.products.map(p => [p.formula, p.coeff]));
  ok('H2O coeff=2', map.get('H2O') === 2, eq);

  const eq2 = balanceEquation(['CH4', 'O2'], ['CO2', 'H2O']);
  ok('CH4+O2 -> CO2+H2O', eq2.balanced, eq2);
  const c2 = new Map(eq2.reactants.map(r => [r.formula, r.coeff]));
  ok('O2 coeff=2', c2.get('O2') === 2, eq2);

  const eq3 = balanceEquation(['Fe', 'O2'], ['Fe2O3']);
  ok('Fe+O2 -> Fe2O3', eq3.balanced, eq3);
  const r3 = new Map(eq3.reactants.map(r => [r.formula, r.coeff]));
  ok('Fe coeff=4', r3.get('Fe') === 4, eq3);

  const eq4 = balanceEquation(['N2', 'H2'], ['NH3']);
  ok('N2+H2 -> NH3', eq4.balanced, eq4);
  const r4 = new Map(eq4.reactants.map(r => [r.formula, r.coeff]));
  ok('N2 coeff=1, H2 coeff=3', r4.get('N2') === 1 && r4.get('H2') === 3, eq4);

  ok('Fe displaces Cu', doesDisplace('Fe', 'Cu') === true);
  ok('Cu does not displace Fe', doesDisplace('Cu', 'Fe') === false);

  const p1 = parseFormula('H2O');
  ok('H2O parsed', p1 && p1.H === 2 && p1.O === 1, p1);
  const p2 = parseFormula('Fe2(SO4)3');
  ok('Fe2(SO4)3 parsed', p2 && p2.Fe === 2 && p2.S === 3 && p2.O === 12, p2);
  const p3 = parseFormula('Ca(OH)2');
  ok('Ca(OH)2 parsed', p3 && p3.Ca === 1 && p3.O === 2 && p3.H === 2, p3);
}

console.log(`\nPASS ${passed}  FAIL ${failed}`);
process.exit(failed ? 1 : 0);