import { describe, expect, it } from 'vitest';
import { canonicalLabel } from '../src/canonical-text.js';
import { CSF_FIELD_LABELS, CsfSectionLabel } from '../src/csf-labels.js';
import { parseCsf } from '../src/csf-parser.js';
import { mapTaxRegimeCode } from '../src/csf-tax-regimes.js';
import { pfLines, pmLines } from './fixtures/synthetic-csf-lines.js';

/*
 * Resiliencia a cambios cosméticos del SAT en las etiquetas: acentos, mayúsculas y espacios.
 * Los valores extraídos no deben cambiar. Texto sintético (ver fixtures); ningún dato real.
 */

const NO_BREAK_SPACE = String.fromCodePoint(0x00a0);
const NARROW_NO_BREAK_SPACE = String.fromCodePoint(0x202f);
const EM_SPACE = String.fromCodePoint(0x2003);
const ACUTE = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' } as const;

type Variation = (label: string) => string;

function isAccentableVowel(letter: string): letter is keyof typeof ACUTE {
  return letter in ACUTE;
}

function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');
}

/** Acentúa la primera vocal que no lo tenga ("Primer" → "Prímer"). */
function addAccent(text: string): string {
  return text.replace(/[aeiouAEIOU](?!\p{M})/u, vowel => (isAccentableVowel(vowel) ? ACUTE[vowel] : vowel));
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|[\s(/])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}

const VARIATIONS: Record<string, Variation> = {
  'sin acentos': stripAccents,
  'con acento extra': addAccent,
  'MAYÚSCULAS': label => label.toUpperCase(),
  'minúsculas': label => label.toLowerCase(),
  'Título': titleCase,
  'espacios dobles': label => label.replaceAll(' ', '  '),
  'espacio no separable U+00A0': label => label.replaceAll(' ', NO_BREAK_SPACE),
  'espacio angosto no separable U+202F': label => label.replaceAll(' ', NARROW_NO_BREAK_SPACE),
  'espacios al inicio y al final': label => `${EM_SPACE}${label}${NO_BREAK_SPACE} `,
  'espacio antes de los dos puntos': label => label.replace(/:$/, ' :'),
  'combinada (sin acentos, Título y U+202F)': label => titleCase(stripAccents(label)).replaceAll(' ', NARROW_NO_BREAK_SPACE),
};

/** Etiquetas presentes en los renglones sintéticos de persona física y de persona moral. */
const PF_LABELS = [
  'CÉDULA DE IDENTIFICACIÓN FISCAL', 'CONSTANCIA DE SITUACIÓN FISCAL', 'Lugar y Fecha de Emisión', 'idCIF:',
  'Datos de Identificación del Contribuyente:', 'RFC:', 'CURP:', 'Nombre (s):', 'Primer Apellido:', 'Segundo Apellido:',
  'Fecha inicio de operaciones:', 'Estatus en el padrón:', 'Fecha de último cambio de estado:', 'Nombre Comercial:',
  'Datos del domicilio registrado', 'Código Postal:', 'Tipo de Vialidad:', 'Nombre de Vialidad:', 'Número Exterior:',
  'Página', 'Regímenes:', 'Régimen Fecha Inicio Fecha Fin', 'Sus datos personales', 'Cadena Original Sello:', 'Sello Digital:',
];
const PM_LABELS = ['Denominación/Razón Social:', 'Régimen Capital:', 'Obligaciones:'];

interface LabelCase {
  readonly label: string;
  readonly variation: string;
  readonly vary: Variation;
}

/** Combinaciones etiqueta × variación que sí cambian el texto (una variación sin efecto no prueba nada). */
function labelCases(labels: readonly string[]): LabelCase[] {
  return labels.flatMap(label => Object.entries(VARIATIONS)
    .filter(([, vary]) => vary(label) !== label)
    .map(([variation, vary]) => ({ label, variation, vary })));
}

function varyLabel(lines: readonly string[], { label, vary }: LabelCase): string[] {
  return lines.map(line => line.replaceAll(label, vary(label)));
}

describe('canonicalLabel', () => {
  it.each([
    ['Régimen Capital:', 'regimen capital:'],
    ['RÉGIMEN  CAPITAL :', 'regimen capital:'],
    [`${EM_SPACE}régimen${NARROW_NO_BREAK_SPACE}capital:${NO_BREAK_SPACE}`, 'regimen capital:'],
    ['Estatus en el\npadrón:', 'estatus en el padron:'],
    ['Denominación/Razón Social:', 'denominacion/razon social:'],
  ])('%j → %j', (label, canonical) => {
    expect(canonicalLabel(label)).toBe(canonical);
  });

  it('ninguna etiqueta colapsa con otra en su forma canónica', () => {
    const labels = [...CSF_FIELD_LABELS, ...Object.values(CsfSectionLabel)];
    expect(new Set(labels.map(canonicalLabel)).size).toBe(labels.length);
  });
});

describe('parseCsf con variaciones cosméticas en las etiquetas', () => {
  it.each(labelCases(PF_LABELS))('persona física: "$label" $variation', labelCase => {
    expect(parseCsf(varyLabel(pfLines(), labelCase))).toStrictEqual(parseCsf(pfLines()));
  });

  it.each(labelCases(PM_LABELS))('persona moral: "$label" $variation', labelCase => {
    expect(parseCsf(varyLabel(pmLines(), labelCase))).toStrictEqual(parseCsf(pmLines()));
  });

  it('quita el pie de página aunque cambie de forma y caiga dentro de la tabla de regímenes', () => {
    const regimes = [
      'Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios 29/03/2016',
      `PAGINA${NARROW_NO_BREAK_SPACE}[2]${NARROW_NO_BREAK_SPACE}De [3]`,
      'Régimen Simplificado de Confianza 01/01/2022',
    ];
    const csf = parseCsf(pfLines({ regimes }));
    expect(csf.activeRegimes).toStrictEqual([
      { code: '605', description: 'Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios', startDate: '29/03/2016' },
      { code: '626', description: 'Régimen Simplificado de Confianza', startDate: '01/01/2022' },
    ]);
  });
});

describe('corte del valor en la siguiente etiqueta del mismo renglón', () => {
  const NEXT_LABEL = 'Régimen Capital:';

  /** Une la razón social y la etiqueta siguiente en un solo renglón, como en algunas versiones de la CSF. */
  function sharedLine(nextLabel: string): string[] {
    return pmLines()
      .filter(line => !line.startsWith(NEXT_LABEL))
      .map(line => (line.startsWith('Denominación/Razón Social:') ? `${line} ${nextLabel} SOCIEDAD CIVIL` : line));
  }

  // Mata: quitar la etiqueta siguiente como límite del valor (la razón social absorbería "Régimen Capital: …").
  it('la razón social termina donde empieza la etiqueta siguiente', () => {
    expect(parseCsf(sharedLine(NEXT_LABEL)).legalName).toBe('ESCUELA KEMPER URGATE');
  });

  // Mata: delimitar con la etiqueta literal en vez de su forma canónica.
  it.each(Object.entries(VARIATIONS).filter(([, vary]) => vary(NEXT_LABEL) !== NEXT_LABEL))(
    'con la etiqueta siguiente en variación %s',
    (_, vary) => {
      expect(parseCsf(sharedLine(vary(NEXT_LABEL))).legalName).toBe('ESCUELA KEMPER URGATE');
    },
  );
});

describe('mapTaxRegimeCode con variaciones cosméticas de la descripción', () => {
  // Descripciones de c_RegimenFiscal tal como las publica el SAT (catCFDI 4.0), más el prefijo que imprime la CSF.
  const SAT_DESCRIPTIONS = [
    ['601', 'Régimen General de Ley Personas Morales'],
    ['603', 'Régimen de las Personas Morales con Fines no Lucrativos'],
    ['605', 'Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios'],
    ['606', 'Régimen de Arrendamiento'],
    ['607', 'Régimen de Enajenación o Adquisición de Bienes'],
    ['608', 'Régimen de los Demás ingresos'],
    ['610', 'Residentes en el Extranjero sin Establecimiento Permanente en México'],
    ['611', 'Régimen de Ingresos por Dividendos (socios y accionistas)'],
    ['612', 'Régimen de las Personas Físicas con Actividades Empresariales y Profesionales'],
    ['614', 'Régimen de los Ingresos por intereses'],
    ['615', 'Régimen de los ingresos por obtención de premios'],
    ['616', 'Sin obligaciones fiscales'],
    ['620', 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos'],
    ['621', 'Régimen de Incorporación Fiscal'],
    ['622', 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras'],
    ['623', 'Opcional para Grupos de Sociedades'],
    ['624', 'Coordinados'],
    ['625', 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas'],
    ['626', 'Régimen Simplificado de Confianza'],
  ] as const;

  const cases = SAT_DESCRIPTIONS.flatMap(([code, description]) => Object.entries(VARIATIONS)
    .filter(([, vary]) => vary(description) !== description)
    .map(([variation, vary]) => ({ code, variation, description: vary(description) })));

  it.each(cases)('$code $variation', ({ code, description }) => {
    expect(mapTaxRegimeCode(description)).toBe(code);
  });
});
