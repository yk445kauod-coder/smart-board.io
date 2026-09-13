// Atlas data: simplified world/regions overview with selectable regions.
// Uses compact simplified SVG polygons — enough for a classroom overview,
// rendered as interactive outlines. Full precision country borders are
// intentionally omitted (kept pedagogically clean).

export interface AtlasRegion {
  id: string;
  nameAr: string;
  nameEn: string;
  /** simplified polygon points (x,y) in a 1000x500 equirectangular viewBox */
  points: string;
  color: string;
}

// Rough continent/region polygons over a 1000x500 canvas (equirectangular world).
export const WORLD: AtlasRegion[] = [
  {
    id: 'n-america',
    nameAr: 'أمريكا الشمالية',
    nameEn: 'North America',
    color: '#f5a623',
    points: '150,60 175,48 220,52 260,62 262,90 288,95 300,118 292,140 268,150 250,168 240,188 218,190 200,176 185,155 168,148 148,120 138,92 145,74',
  },
  {
    id: 's-america',
    nameAr: 'أمريكا الجنوبية',
    nameEn: 'South America',
    color: '#f5a623',
    points: '230,210 255,205 268,225 292,238 300,262 294,288 270,300 245,290 232,262 226,235',
  },
  {
    id: 'africa',
    nameAr: 'أفريقيا',
    nameEn: 'Africa',
    color: '#4caf50',
    points: '452,152 476,142 498,150 512,170 520,196 528,228 522,262 504,292 482,300 466,278 456,246 452,214 446,186',
  },
  {
    id: 'europe',
    nameAr: 'أوروبا',
    nameEn: 'Europe',
    color: '#4caf50',
    points: '462,72 480,68 500,74 512,90 506,112 488,120 470,114 458,96',
  },
  {
    id: 'asia',
    nameAr: 'آسيا',
    nameEn: 'Asia',
    color: '#ff7043',
    points: '525,60 560,66 600,72 640,78 672,92 660,120 640,136 612,142 588,132 566,118 542,108 524,92',
  },
  {
    id: 'oceania',
    nameAr: 'أوقيانوسيا',
    nameEn: 'Oceania',
    color: '#ff7043',
    points: '700,212 720,206 740,214 748,238 730,256 712,246 702,232',
  },
  {
    id: 'middle-east',
    nameAr: 'الشرق الأوسط',
    nameEn: 'Middle East',
    color: '#ffb74d',
    points: '480,128 508,124 522,138 516,160 498,166 482,152',
  },
];

// Egypt + regions of interest (as pins, because very small on world scale)
export const EGYPT = {
  id: 'egypt',
  nameAr: 'مصر',
  nameEn: 'Egypt',
  // Nile delta shape with Sinai (simplified polygon on a local 400x320 canvas)
  points: [
    [128, 92], [150, 80], [178, 96], [196, 128], [188, 168], [166, 178],
    [142, 150], [132, 122], [126, 104],
  ],
  governorates: {
    cairo: { nameAr: 'القاهرة', nameEn: 'Cairo', x: 138, y: 112 },
    alexandria: { nameAr: 'الإسكندرية', nameEn: 'Alexandria', x: 116, y: 82 },
    aswan: { nameAr: 'أسوان', nameEn: 'Aswan', x: 148, y: 196 },
    luxor: { nameAr: 'الأقصر', nameEn: 'Luxor', x: 150, y: 174 },
    sinai: { nameAr: 'سيناء', nameEn: 'Sinai', x: 224, y: 140 },
    giza: { nameAr: 'الجيزة', nameEn: 'Giza', x: 128, y: 108 },
    sahel: { nameAr: 'الساحل الشمالي', nameEn: 'North Coast', x: 104, y: 76 },
  },
};

// Selectable "regions" quick presets for the atlas panel.
export const ATLAS_PRESETS: { id: string; nameAr: string; nameEn: string }[] = [
  { id: 'world', nameAr: 'خريطة العالم', nameEn: 'World map' },
  { id: 'africa', nameAr: 'قارة أفريقيا', nameEn: 'Africa' },
  { id: 'n-america', nameAr: 'أمريكا الشمالية', nameEn: 'North America' },
  { id: 's-america', nameAr: 'أمريكا الجنوبية', nameEn: 'South America' },
  { id: 'asia', nameAr: 'قارة آسيا', nameEn: 'Asia' },
  { id: 'europe', nameAr: 'قارة أوروبا', nameEn: 'Europe' },
  { id: 'oceania', nameAr: 'أوقيانوسيا', nameEn: 'Oceania' },
  { id: 'middle-east', nameAr: 'الشرق الأوسط', nameEn: 'Middle East' },
  { id: 'egypt', nameAr: 'مصر بالتفصيل', nameEn: 'Egypt detail' },
];

// A small set of famous country pins (world map) for quick selection.
export const WORLD_PINS: { id: string; nameAr: string; nameEn: string; x: number; y: number }[] = [
  { id: 'us', nameAr: 'الولايات المتحدة', nameEn: 'USA', x: 190, y: 110 },
  { id: 'brazil', nameAr: 'البرازيل', nameEn: 'Brazil', x: 262, y: 250 },
  { id: 'uk', nameAr: 'بريطانيا', nameEn: 'United Kingdom', x: 468, y: 80 },
  { id: 'france', nameAr: 'فرنسا', nameEn: 'France', x: 476, y: 96 },
  { id: 'germany', nameAr: 'ألمانيا', nameEn: 'Germany', x: 492, y: 84 },
  { id: 'egypt', nameAr: 'مصر', nameEn: 'Egypt', x: 486, y: 156 },
  { id: 'saudi', nameAr: 'السعودية', nameEn: 'Saudi Arabia', x: 512, y: 150 },
  { id: 'japan', nameAr: 'اليابان', nameEn: 'Japan', x: 650, y: 96 },
  { id: 'china', nameAr: 'الصين', nameEn: 'China', x: 620, y: 110 },
  { id: 'india', nameAr: 'الهند', nameEn: 'India', x: 586, y: 132 },
  { id: 'australia', nameAr: 'أستراليا', nameEn: 'Australia', x: 726, y: 236 },
  { id: 'russia', nameAr: 'روسيا', nameEn: 'Russia', x: 600, y: 62 },
];

// Maps for name lookups
export const PIN_BY_ID: Record<string, (typeof WORLD_PINS)[number]> = Object.fromEntries(WORLD_PINS.map(p => [p.id, p]));