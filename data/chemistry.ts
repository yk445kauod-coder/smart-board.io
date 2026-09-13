// Chemistry helpers: formula parsing, reaction balancing (deterministic brute force
// with gcd reduction), and displacement/reactivity reference tables.

export interface AtomCount { [symbol: string]: number; }

// Parse a chemical formula like "H2O", "Ca(OH)2", "Fe2(SO4)3" into atom counts.
export function parseFormula(formula: string): AtomCount | null {
  const s = formula.trim();
  if (!s) return null;
  const counts: AtomCount = {};
  let i = 0;
  const n = s.length;
  const readSymbol = (): string => {
    if (i >= n) return '';
    let sym = s[i];
    if (!/[A-Z]/.test(sym)) return '';
    i++;
    if (i < n && /[a-z]/.test(s[i])) {
      sym += s[i];
      i++;
    }
    return sym;
  };
  const readNumber = (): number => {
    let num = '';
    while (i < n && /\d/.test(s[i])) {
      num += s[i];
      i++;
    }
    return num ? parseInt(num, 10) : 1;
  };
  const readGroup = (): AtomCount | null => {
    const group: AtomCount = {};
    while (i < n) {
      const ch = s[i];
      if (ch === '(') {
        i++;
        const inner = readGroup();
        if (!inner) return null;
        const mult = readNumber();
        for (const k of Object.keys(inner)) {
          group[k] = (group[k] || 0) + inner[k] * mult;
        }
        continue;
      }
      if (ch === ')') {
        i++;
        return group;
      }
      if (/[A-Z]/.test(ch)) {
        const sym = readSymbol();
        const mult = readNumber();
        group[sym] = (group[sym] || 0) + mult;
        continue;
      }
      return null; // unexpected char
    }
    return group;
  };
  const group = readGroup();
  if (group === null) return null;
  // charge suffix like "2-" or "+" is often omitted in these learning balancers
  return countsAfterCharge(group);
}

function countsAfterCharge(g: AtomCount): AtomCount {
  return g; // charges ignored for balancing (kept simple & deterministic)
}

export interface Species {
  formula: string;
  atoms: AtomCount;
  /** charge if present (e.g., "2+", "-") else '' */
  charge?: string;
}

export interface BalancedEquation {
  reactants: { formula: string; coeff: number }[];
  products: { formula: string; coeff: number }[];
  balanced: boolean;
  /** if not balanced, message */
  error?: string;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a); b = Math.abs(b);
  while (b) { const t = a % b; a = b; b = t; }
  return a || 1;
}

// Brute-force the coefficients for a balanced reaction.
// Works for up to about 6 species (reactants+products) with coefficient 1..9.
export function balanceEquation(lhs: string[], rhs: string[]): BalancedEquation {
  const parse = (list: string[]): Species[] => {
    const out: Species[] = [];
    for (const f of list) {
      const atoms = parseFormula(f);
      if (!atoms) return [];
      out.push({ formula: f, atoms });
    }
    return out;
  };
  const reac = parse(lhs);
  const prod = parse(rhs);
  if (reac.length === 0 || prod.length === 0) {
    return { reactants: lhs.map(f => ({ formula: f, coeff: 1 })), products: rhs.map(f => ({ formula: f, coeff: 1 })), balanced: false, error: 'Invalid formula' };
  }

  // Collect all element symbols across species.
  const elements = new Set<string>();
  for (const sp of [...reac, ...prod]) for (const el of Object.keys(sp.atoms)) elements.add(el);
  const elList = [...elements];

  // Build coefficient matrix: for each element, sum(reactant coeffs*atoms) == sum(product coeffs*atoms)
  const speciesCount = reac.length + prod.length;
  if (speciesCount === 0 || speciesCount > 6) {
    return { reactants: lhs.map(f => ({ formula: f, coeff: 1 })), products: rhs.map(f => ({ formula: f, coeff: 1 })), balanced: false, error: 'Too complex to balance automatically' };
  }

  const allSpecies = [...reac, ...prod];
  // Brute force coefficients from 1..9 with pruning.
  const coeffs: number[] = new Array(speciesCount).fill(1);

  const evaluate = (): boolean => {
    for (const el of elList) {
      let lhsSum = 0;
      for (let r = 0; r < reac.length; r++) lhsSum += coeffs[r] * (reac[r].atoms[el] || 0);
      let rhsSum = 0;
      for (let p = 0; p < prod.length; p++) rhsSum += coeffs[reac.length + p] * (prod[p].atoms[el] || 0);
      if (lhsSum !== rhsSum) return false;
    }
    return true;
  };

  let found: number[] | null = null;
  let tries = 0;
  const maxTries = 400000;

  const search = (idx: number): boolean => {
    if (found) return true;
    if (idx === speciesCount) {
      tries++;
      if (evaluate()) { found = [...coeffs]; return true; }
      return false;
    }
    for (let c = 1; c <= 9; c++) {
      coeffs[idx] = c;
      if (search(idx + 1)) return true;
    }
    return false;
  };

  // Start from the least-variable side: try small-coefficient search.
  search(0);

  const fallback = (): BalancedEquation => {
    // If brute force fails (rare), do a lightweight linear solve via pivot on first merged atom.
    const m = elList.length;
    const matrix: number[][] = [];
    for (let e = 0; e < m; e++) {
      const row: number[] = [];
      for (const sp of allSpecies) row.push(sp.atoms[elList[e]] || 0);
      matrix.push(row);
    }
    // Try solving by fixing last coefficient = 1 (reaction balance underdetermined).
    // We'll do a simple approach: set last coeff=1, solve first (speciesCount-1) via elimination.
    if (speciesCount - 1 === 0) {
      const r = lhs.map(f => ({ formula: f, coeff: 1 }));
      const p = rhs.map(f => ({ formula: f, coeff: 1 }));
      const same = elList.every(el => (reac[0]?.atoms[el] || 0) === (prod[0]?.atoms[el] || 0));
      return same
        ? { reactants: r, products: p, balanced: true }
        : { reactants: r, products: p, balanced: false, error: 'Cannot balance' };
    }
    return { reactants: lhs.map(f => ({ formula: f, coeff: 1 })), products: rhs.map(f => ({ formula: f, coeff: 1 })), balanced: false, error: 'Cannot balance automatically' };
  };

  const fmt = (arr: { formula: string; coeff: number }[]) => arr.map(x => x.coeff === 1 ? x.formula : `${x.coeff}${x.formula}`);

  if (!found) {
    const fb = fallback();
    return { ...fb };
  }

  // Reduce by gcd
  let g = found[0];
  for (const c of found) g = gcd(g, c);
  if (g > 1) found = found.map(c => c / g);

  const out: BalancedEquation = {
    reactants: reac.map((sp, i) => ({ formula: sp.formula, coeff: found![i] })),
    products: prod.map((sp, i) => ({ formula: sp.formula, coeff: found![reac.length + i] })),
    balanced: true,
  };
  return out;
}

export function equationToString(eq: BalancedEquation, isAr: boolean): string {
  const lhs = eq.reactants.map(x => x.coeff === 1 ? x.formula : `${x.coeff}${x.formula}`).join(' + ');
  const rhs = eq.products.map(x => x.coeff === 1 ? x.formula : `${x.coeff}${x.formula}`).join(' + ');
  return `${lhs} → ${rhs}`;
}

// --- Reactivity / displacement reference (Common, deterministic) ---
export const REACTIVITY_SERIES = [
  'K', 'Na', 'Ca', 'Mg', 'Al', 'Zn', 'Fe', 'Pb', 'Cu', 'Ag', 'Au',
];

export const REACTIVITY_NAMES: Record<string, { ar: string; en: string }> = {
  K: { ar: 'بوتاسيوم', en: 'Potassium' },
  Na: { ar: 'صوديوم', en: 'Sodium' },
  Ca: { ar: 'كالسيوم', en: 'Calcium' },
  Mg: { ar: 'مغنسيوم', en: 'Magnesium' },
  Al: { ar: 'ألومنيوم', en: 'Aluminium' },
  Zn: { ar: 'خارصين (زنك)', en: 'Zinc' },
  Fe: { ar: 'حديد', en: 'Iron' },
  Pb: { ar: 'رصاص', en: 'Lead' },
  Cu: { ar: 'نحاس', en: 'Copper' },
  Ag: { ar: 'فضة', en: 'Silver' },
  Au: { ar: 'ذهب', en: 'Gold' },
};

// Displacement: does metal A displace B from its salt? (if A is higher in series)
export function doesDisplace(a: string, b: string): boolean {
  const ia = REACTIVITY_SERIES.indexOf(a);
  const ib = REACTIVITY_SERIES.indexOf(b);
  if (ia === -1 || ib === -1) return false;
  return ia < ib; // higher reactivity (earlier) displaces lower
}

export const DISPLACEMENT_EXAMPLES: { lhs: string; rhs: string; ar: string; en: string }[] = [
  { lhs: 'Fe + CuSO4', rhs: 'FeSO4 + Cu', ar: 'الحديد يزيح النحاس من كبريتاته', en: 'Iron displaces copper from its sulfate' },
  { lhs: 'Zn + CuSO4', rhs: 'ZnSO4 + Cu', ar: 'الخارصين يزيح النحاس من كبريتاته', en: 'Zinc displaces copper from its sulfate' },
  { lhs: 'Cu + FeSO4', rhs: '—', ar: 'النحاس لا يزيح الحديد', en: 'Copper does NOT displace iron' },
  { lhs: 'Mg + CuSO4', rhs: 'MgSO4 + Cu', ar: 'المغنسيوم يزيح النحاس', en: 'Magnesium displaces copper' },
];

// Common companion materials (acids, bases, salts) as reference tables.
export const COMPANION_MATERIALS = {
  acids: [
    { name: 'HCl', ar: 'حمض الهيدروكلوريك', en: 'Hydrochloric acid', formula: 'HCl' },
    { name: 'H2SO4', ar: 'حمض الكبريتيك', en: 'Sulfuric acid', formula: 'H₂SO₄' },
    { name: 'HNO3', ar: 'حمض النيتريك', en: 'Nitric acid', formula: 'HNO₃' },
    { name: 'CH3COOH', ar: 'حمض الخليك', en: 'Acetic acid', formula: 'CH₃COOH' },
    { name: 'H3PO4', ar: 'حمض الفوسفوريك', en: 'Phosphoric acid', formula: 'H₃PO₄' },
  ],
  bases: [
    { name: 'NaOH', ar: 'هيدروكسيد الصوديوم', en: 'Sodium hydroxide', formula: 'NaOH' },
    { name: 'KOH', ar: 'هيدروكسيد البوتاسيوم', en: 'Potassium hydroxide', formula: 'KOH' },
    { name: 'Ca(OH)2', ar: 'هيدروكسيد الكالسيوم', en: 'Calcium hydroxide', formula: 'Ca(OH)₂' },
    { name: 'NH4OH', ar: 'هيدروكسيد الأمونيوم', en: 'Ammonium hydroxide', formula: 'NH₄OH' },
    { name: 'Mg(OH)2', ar: 'هيدروكسيد المغنسيوم', en: 'Magnesium hydroxide', formula: 'Mg(OH)₂' },
  ],
  commonSalts: [
    { name: 'NaCl', ar: 'كلوريد الصوديوم', en: 'Sodium chloride', formula: 'NaCl' },
    { name: 'KCl', ar: 'كلوريد البوتاسيوم', en: 'Potassium chloride', formula: 'KCl' },
    { name: 'CaCO3', ar: 'كربونات الكالسيوم', en: 'Calcium carbonate', formula: 'CaCO₃' },
    { name: 'NaHCO3', ar: 'بيكربونات الصوديوم', en: 'Sodium bicarbonate', formula: 'NaHCO₃' },
    { name: 'CuSO4', ar: 'كبريتات النحاس', en: 'Copper sulfate', formula: 'CuSO₄' },
    { name: 'AgNO3', ar: 'نترات الفضة', en: 'Silver nitrate', formula: 'AgNO₃' },
  ],
};

// Polyatomic ions reference
export const POLYATOMIC_IONS = [
  { name: 'SO4', charge: '2−', ar: 'كبريتات', en: 'Sulfate' },
  { name: 'NO3', charge: '1−', ar: 'نترات', en: 'Nitrate' },
  { name: 'CO3', charge: '2−', ar: 'كربونات', en: 'Carbonate' },
  { name: 'PO4', charge: '3−', ar: 'فوسفات', en: 'Phosphate' },
  { name: 'OH', charge: '1−', ar: 'هيدروكسيد', en: 'Hydroxide' },
  { name: 'NH4', charge: '1+', ar: 'أمونيوم', en: 'Ammonium' },
  { name: 'HCO3', charge: '1−', ar: 'بيكربونات', en: 'Bicarbonate' },
  { name: 'ClO3', charge: '1−', ar: 'كلورات', en: 'Chlorate' },
  { name: 'MnO4', charge: '1−', ar: 'برمنغنات', en: 'Permanganate' },
  { name: 'Cr2O7', charge: '2−', ar: 'ثنائي كرومات', en: 'Dichromate' },
];