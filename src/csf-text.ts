import { CanonicalText, labelPattern } from './canonical-text.js';
import { CSF_FIELD_LABELS, CsfSectionLabel, type CsfFieldLabel } from './csf-labels.js';

/*
 * Consultas sobre el texto de la CSF. Las etiquetas se buscan en la forma canónica (tolerante a acentos,
 * mayúsculas y espacios); los valores se devuelven tal como vienen en el texto original.
 */

const LABEL_BOUNDARY = CSF_FIELD_LABELS.map(labelPattern).join('|');
const PAGE_MARKER = new RegExp(
  `${labelPattern(CsfSectionLabel.Page)} \\[\\d+\\] ${labelPattern(CsfSectionLabel.PageOf)} \\[\\d+\\]`, 'gd');

/** NFC y espacios homogéneos: el PDF puede traer espacio duro (U+00A0), espacios tipográficos (U+2000–U+200B) y tabuladores. */
export function normalizeLine(line: string): string {
  return line.normalize('NFC').replace(/[\u00a0\u2000-\u200b\t]/g, ' ').replace(/ {2,}/g, ' ').trim();
}

export function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Quita el pie "Página [n] de [m]" del renglón; el resto del renglón queda como venía. */
export function removePageMarkers(line: string): string {
  let kept = '';
  let cursor = 0;
  for (const { sourceSpan } of CanonicalText.of(line).findAll(PAGE_MARKER)) {
    kept += line.slice(cursor, sourceSpan.start);
    cursor = sourceSpan.end;
  }
  return kept + line.slice(cursor);
}

/** Valor de una etiqueta en su mismo renglón, hasta la siguiente etiqueta conocida o el fin de línea. */
export function fieldValue(text: CanonicalText, label: CsfFieldLabel): string | null {
  // La etiqueta va al inicio del renglón o después de un espacio; el valor es el texto ORIGINAL que la sigue.
  const pattern = new RegExp(`(?<![^ \\n])${labelPattern(label)} ?(.*?) ?(?=(?:${LABEL_BOUNDARY})|$)`, 'md');
  return text.find(pattern)?.group(1)?.trim() ?? null;
}

/** Posición en el texto original donde aparece la etiqueta por primera vez, o -1 si no aparece. */
export function labelIndex(text: CanonicalText, label: string): number {
  return text.find(new RegExp(labelPattern(label), 'd'))?.sourceSpan.start ?? -1;
}

export function containsLabel(text: CanonicalText, label: string): boolean {
  return new RegExp(labelPattern(label)).test(text.value);
}
