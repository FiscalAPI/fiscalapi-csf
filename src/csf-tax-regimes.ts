import { canonicalLabel } from './canonical-text.js';

/**
 * Mapeo determinista de la descripción del régimen (como la imprime la CSF) a la clave SAT c_RegimenFiscal.
 * Las claves son las del catálogo del backend (SatTaxRegimeSeeder / SatCatalogs.InvoiceTaxRegimeCodes).
 * La comparación es exacta tras normalizar (ver normalizeRegimeDescription); no hay coincidencia difusa.
 */
const REGIME_CATALOG = [
  { code: '601', descriptions: ['general de ley personas morales'] },
  { code: '603', descriptions: ['personas morales con fines no lucrativos'] },
  { code: '605', descriptions: ['sueldos y salarios e ingresos asimilados a salarios'] },
  { code: '606', descriptions: ['arrendamiento'] },
  { code: '607', descriptions: ['enajenacion o adquisicion de bienes'] },
  { code: '608', descriptions: ['demas ingresos'] },
  {
    code: '610',
    descriptions: [
      'residentes en el extranjero sin establecimiento permanente en mexico',
      'residentes en extranjero sin establecimiento permanente en mexico',
    ],
  },
  { code: '611', descriptions: ['ingresos por dividendos socios y accionistas', 'ingresos por dividendos'] },
  {
    code: '612',
    descriptions: [
      'personas fisicas con actividades empresariales y profesionales',
      'actividades empresariales y profesionales',
    ],
  },
  { code: '614', descriptions: ['ingresos por intereses'] },
  { code: '615', descriptions: ['ingresos por obtencion de premios'] },
  { code: '616', descriptions: ['sin obligaciones fiscales'] },
  { code: '620', descriptions: ['sociedades cooperativas de produccion que optan por diferir sus ingresos'] },
  { code: '621', descriptions: ['incorporacion fiscal'] },
  { code: '622', descriptions: ['actividades agricolas ganaderas silvicolas y pesqueras'] },
  { code: '623', descriptions: ['opcional para grupos de sociedades'] },
  { code: '624', descriptions: ['coordinados'] },
  {
    code: '625',
    descriptions: [
      'actividades empresariales con ingresos a traves de plataformas tecnologicas',
      'actividades empresariales a traves de plataformas tecnologicas',
    ],
  },
  { code: '626', descriptions: ['simplificado de confianza'] },
] as const;

/** Clave SAT c_RegimenFiscal que el lector reconoce. */
export type SatTaxRegimeCode = (typeof REGIME_CATALOG)[number]['code'];

/**
 * Forma canónica de la descripción (ver canonicalLabel), sin puntuación y sin el prefijo "Régimen de (las|los)",
 * que la CSF imprime y el catálogo no. Se aplica igual a la descripción del PDF y a las del catálogo.
 */
export function normalizeRegimeDescription(description: string): string {
  return canonicalLabel(description)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
    .replace(/^regimen (de (las |los |la |el )?|del )?/, '');
}

/** Índice descripción canónica → clave, calculado una sola vez al cargar el módulo. */
const CODE_BY_DESCRIPTION = new Map<string, SatTaxRegimeCode>(
  REGIME_CATALOG.flatMap(({ code, descriptions }) =>
    descriptions.map(description => [normalizeRegimeDescription(description), code] as const))
);

/** Clave SAT del régimen, o null si la descripción no se reconoce. */
export function mapTaxRegimeCode(description: string): SatTaxRegimeCode | null {
  return CODE_BY_DESCRIPTION.get(normalizeRegimeDescription(description)) ?? null;
}
