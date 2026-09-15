import { parseFormula, balanceEquation, doesDisplace } from '../data/chemistry';
import { ELEMENT_BY_SYMBOL, ELEMENT_BY_NUMBER } from '../data/periodic';
import { textToBoardCommands } from '../services/ai/omnirouter/providers';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ FAIL: ${description}`);
  }
}

console.log('[qa-deep-edge] Chemistry & Periodic Table Edge Cases');

// Polyatomic & nested brackets chemical formulas
const kMnO4 = parseFormula('KMnO4');
assert(kMnO4 !== null && kMnO4['K'] === 1 && kMnO4['Mn'] === 1 && kMnO4['O'] === 4, 'KMnO4 parsed accurately');

const complexNested = parseFormula('Al2(SO4)3');
assert(complexNested !== null && complexNested['Al'] === 2 && complexNested['S'] === 3 && complexNested['O'] === 12, 'Al2(SO4)3 parsed with polyatomic expansion');

// Unbalanced / Impossible reaction fallback
const invalidEq = balanceEquation(['H2', 'O2'], ['NaCl']);
assert(invalidEq.balanced === false, 'Impossible reaction equation returns balanced: false safely');

// Reactivity series displacement edge cases
assert(doesDisplace('Zn', 'Cu') === true, 'Zinc displaces Copper in reactivity series');
assert(doesDisplace('Ag', 'Fe') === false, 'Silver fails to displace Iron (reactivity rules preserved)');

// Periodic table boundaries
assert(ELEMENT_BY_SYMBOL['O']?.n === 8, 'Oxygen atomic number is 8');
assert(ELEMENT_BY_NUMBER[118]?.sym === 'Og', 'Oganesson element 118 retrieved');
assert(ELEMENT_BY_NUMBER[999] === undefined, 'Out of bound atomic number 999 returns undefined');

console.log('\n[qa-deep-edge] AI Command Normalization Edge Cases');
// AI output with loose schema fields
const malformedInput = JSON.stringify([
  { type: 'addWordArt', content: 'عنوان الدرس' },
  { command: 'addNote', text: 'ملاحظة هامّة للطلاّب' },
  { type: 'addList', items: ['نقطة 1', 'نقطة 2'] }
]);

const normalized = textToBoardCommands(malformedInput);
assert(normalized.length === 3, 'Parsed 3 malformed commands');
assert((normalized[0] as any).action === 'addWordArt' && (normalized[0] as any).text === 'عنوان الدرس', 'Normalized type->action and content->text');
assert((normalized[1] as any).action === 'addNote' && (normalized[1] as any).content === 'ملاحظة هامّة للطلاّب', 'Normalized command->action and text->content');
assert((normalized[2] as any).action === 'addList' && Array.isArray((normalized[2] as any).items), 'Normalized addList items');

console.log(`\nQA EDGE CASE SUMMARY: ${passedTests}/${totalTests} Passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
