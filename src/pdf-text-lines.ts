/** Fragmento de texto con su posición en la página, listo para agruparse en renglones. */
export interface PositionedText {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly fontSize: number;
}

interface TextRow {
  readonly y: number;
  readonly items: PositionedText[];
}

/** Tolerancia vertical (pt) para considerar dos fragmentos de texto en el mismo renglón. */
const LINE_TOLERANCE = 2;
/** Hueco horizontal, relativo al tamaño de fuente, a partir del cual dos fragmentos llevan espacio entre sí. */
const WORD_GAP_RATIO = 0.15;

/**
 * Agrupa los fragmentos por coordenada Y y los ordena por X, de modo que el resultado no depende del orden
 * en que el generador del PDF escribió el texto. Devuelve los renglones de arriba hacia abajo.
 */
export function groupIntoLines(items: readonly PositionedText[]): string[] {
  const rows: TextRow[] = [];
  for (const item of items) {
    if (item.text.length === 0) continue;
    const row = rows.find(candidate => Math.abs(candidate.y - item.y) <= LINE_TOLERANCE);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => joinRow(row.items))
    .filter(line => line.length > 0);
}

function joinRow(items: PositionedText[]): string {
  let line = '';
  let previousEnd: number | null = null;
  for (const item of items.sort((a, b) => a.x - b.x)) {
    // Fragmentos contiguos (mismo texto partido) se concatenan; separados por un hueco, llevan espacio.
    if (previousEnd !== null && item.x - previousEnd > item.fontSize * WORD_GAP_RATIO) line += ' ';
    line += item.text;
    previousEnd = item.x + item.width;
  }
  return line.replace(/\s+/g, ' ').trim();
}
