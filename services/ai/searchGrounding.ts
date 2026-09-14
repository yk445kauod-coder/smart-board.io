export interface GroundingFact {
  title: string;
  snippet: string;
  source?: string;
}

// Educational search grounding lookup for key classroom subjects
export async function getSearchGrounding(query: string, subject?: string): Promise<GroundingFact[]> {
  const clean = query.trim().toLowerCase();
  const facts: GroundingFact[] = [];

  // General science & educational grounding rules
  if (clean.includes('water') || clean.includes('ماء') || clean.includes('دورة')) {
    facts.push({
      title: 'Water Cycle (دورة الماء)',
      snippet: 'Continuous movement of water on, above and below the surface of the Earth involving evaporation, condensation, precipitation, and transpiration.',
      source: 'Educational Knowledge Index',
    });
  }

  if (clean.includes('pythagor') || clean.includes('فيثاغورس') || clean.includes('مثلث')) {
    facts.push({
      title: 'Pythagorean Theorem (نظرية فيثاغورس)',
      snippet: 'In a right-angled triangle, a² + b² = c², where c is the hypotenuse.',
      source: 'Mathematics Index',
    });
  }

  if (clean.includes('photosynthesis') || clean.includes('البناء الضوئي')) {
    facts.push({
      title: 'Photosynthesis (البناء الضوئي)',
      snippet: '6CO2 + 6H2O + Light Energy → C6H12O6 + 6O2. Plants convert light into chemical energy stored in glucose.',
      source: 'Biology Index',
    });
  }

  if (clean.includes('egypt') || clean.includes('مصر') || clean.includes('nile') || clean.includes('النيل')) {
    facts.push({
      title: 'Geography of Egypt (جغرافية مصر)',
      snippet: 'Egypt spans northeastern Africa and southwestern Asia (Sinai). The Nile River flows north through the Sahara into the Mediterranean.',
      source: 'Atlas Index',
    });
  }

  return facts;
}
