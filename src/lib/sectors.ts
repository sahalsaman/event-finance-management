export const SECTORS = [
  'Cheruvadi',
  'Kodiyathur',
  'Eranjimavu',
  'Karassery',
  'Mukkam',
  'Koodaranji',
  'Karamoola',
  'Anayamkunnu',
] as const;

export type Sector = (typeof SECTORS)[number];

export const UNITS_BY_SECTOR: Record<Sector, readonly string[]> = {
  Karassery: [
    'Nellikkaparamba',
    'North Karassery',
    'Kakkad',
    'Sarkarparamba',
    'Karuthaparamba',
    'Karassery',
    'Valiyaparamba',
    'Chonad',
  ],
  Mukkam: ['Thungumpuram', 'Poolappoyil', 'Mangapoyil', 'Kathiyode'],
  Anayamkunnu: [
    'Muringampurayi',
    'Thekkumkutty',
    'Vallathayippara',
    'Malamkunnu',
    'Edalampad',
    'Kuttiparamba',
  ],
  Karamoola: ['Thadaparamba', 'Karamoola', 'Kumaranallur', 'Mukkam Kadavu', 'Gateumpadi'],
  Cheruvadi: [
    'Kannamparamba',
    'Alungal',
    'Cheruvadi',
    'Edavazhikkadavu',
    'Chullikkaparamba',
    'Pazhamparamba',
    'Thenangaparamba',
    'Karalipparamba',
    'West Cheruvadi',
    'Pottammal',
  ],
  Kodiyathur: [
    'Swalath Mahal',
    'Karakkutti',
    'West Kodiyathur',
    'West Chennamangallur',
    'South Kodiyathur',
    'Kodiyathur',
    'Pulparamba',
    'Kunnummal',
    'Karatt',
  ],
  Eranjimavu: [
    'Eranjimavu',
    'Mysore Patta',
    'Pannikkode',
    'Mattummuri',
    'Kulangara',
    'Thottumukkam',
    'Gothamb Road',
  ],
  Koodaranji: [
    'Maranchatty',
    'Kuliramuttu',
    'Urummi',
    'Koompara',
    'Koodaranji',
    'Poovaranthode',
    'Mele Koompara',
  ],
};

export function isSector(value: string): value is Sector {
  return SECTORS.some((sector) => sector === value);
}

export function isUnitForSector(sector: string, unit: string): boolean {
  return isSector(sector) && UNITS_BY_SECTOR[sector].includes(unit);
}
