import { canonicalLabel } from './canonical-text.js';
import { CsfSectionLabel } from './csf-labels.js';
import type { CsfTaxRegime } from './csf.models.js';
import { collapseWhitespace } from './csf-text.js';
import { mapTaxRegimeCode } from './csf-tax-regimes.js';
import { requiredGroup } from './required-group.js';
import { CsfValidationError, CsfValidationErrorCode } from './csf-validation-error.js';

/** Regímenes vigentes de la constancia, separados según se reconozca o no su clave SAT. */
export interface CsfRegimesSection {
  readonly active: readonly CsfTaxRegime[];
  readonly unrecognized: readonly string[];
}

const SECTION_START = canonicalLabel(CsfSectionLabel.Regimes);
const SECTION_ENDS = [CsfSectionLabel.Obligations, CsfSectionLabel.PersonalDataNotice, CsfSectionLabel.SealChain].map(canonicalLabel);
const TABLE_HEADER = canonicalLabel(CsfSectionLabel.RegimesTableHeader);
/** "descripción dd/mm/aaaa [dd/mm/aaaa]": la descripción puede ocupar varias líneas y la fecha fin es opcional. */
const REGIME_ROW = /(.+?)\s+(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\/\d{2}\/\d{4}))?(?=\s|$)/g;

function isSectionEnd(canonicalLine: string): boolean {
  return SECTION_ENDS.some(end => canonicalLine.startsWith(end));
}

/** Renglones de la sección "Regímenes:" sin el encabezado de la tabla, unidos en un solo texto (original). */
function sectionBody(lines: readonly string[]): string {
  const start = lines.findIndex(line => canonicalLabel(line).startsWith(SECTION_START));
  if (start < 0) {
    throw new CsfValidationError(CsfValidationErrorCode.MissingRegimesSection, 'La constancia no contiene la sección de regímenes.');
  }

  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const canonicalLine = canonicalLabel(line);
    if (isSectionEnd(canonicalLine)) break;
    if (canonicalLine !== TABLE_HEADER) body.push(line);
  }
  return body.join(' ');
}

/** dd/mm/aaaa → aaaa-mm-dd, para comparar fechas como texto. */
function toIsoDate(ddmmyyyy: string): string {
  return ddmmyyyy.split('/').reverse().join('-');
}

/**
 * Extrae los regímenes de la sección "Regímenes:". Un régimen es vigente si no tiene fecha fin o esta es
 * posterior a la fecha de emisión; un régimen con clave repetida se conserva solo la primera vez.
 */
export function readRegimesSection(lines: readonly string[], issueDate: string): CsfRegimesSection {
  const active: CsfTaxRegime[] = [];
  const unrecognized: string[] = [];
  for (const row of sectionBody(lines).matchAll(REGIME_ROW)) {
    const description = collapseWhitespace(requiredGroup(row, 1)).replace(/\.$/, '');
    const endDate = row[3];
    if (endDate !== undefined && toIsoDate(endDate) <= issueDate) continue;

    const code = mapTaxRegimeCode(description);
    if (code === null) unrecognized.push(description);
    else if (!active.some(regime => regime.code === code)) active.push({ code, description, startDate: requiredGroup(row, 2) });
  }
  return { active, unrecognized };
}
