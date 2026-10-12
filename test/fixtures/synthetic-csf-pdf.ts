/*
 * Constancia de Situación Fiscal SINTÉTICA para las pruebas. El repositorio es público: ningún dato proviene
 * de una constancia real. Se usa el RFC de pruebas del SAT EKU9003173C9 (ESCUELA KEMPER URGATE) y valores
 * ficticios (idCIF, domicilio, cadena original y sello). El PDF se genera en memoria con la estructura de
 * texto de una CSF: renglones con coordenadas, etiquetas que comparten renglón y dos páginas.
 */

export const SYNTHETIC_CSF_RFC = 'EKU9003173C9';
export const SYNTHETIC_CSF_LEGAL_NAME = 'ESCUELA KEMPER URGATE';

/** Fragmento de texto en una posición de la página (puntos PDF, origen abajo a la izquierda). */
export interface PdfTextFragment {
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export type PdfPageText = readonly PdfTextFragment[];

const FONT_SIZE = 9;
const LEFT = 40;
const VALUE_COLUMN = 300;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
/** Las CSF reales pesan más de 10 KB por el QR y los logotipos; un comentario PDF alcanza el mínimo sin afectar el texto. */
const MIN_REALISTIC_SIZE = 12 * 1024;

/** Renglones apilados de arriba hacia abajo; cada renglón puede tener varios fragmentos (columnas). */
function stackRows(rows: readonly (readonly string[])[], top: number): PdfPageText {
  return rows.flatMap((row, index) =>
    row.map((text, column) => ({ text, x: column === 0 ? LEFT : VALUE_COLUMN, y: top - index * 14 })));
}

/** Página 1: cédula, datos de identificación y domicilio. */
export function syntheticCsfIdentityPage(): PdfPageText {
  return stackRows([
    ['CÉDULA DE IDENTIFICACIÓN FISCAL'],
    ['CONSTANCIA DE SITUACIÓN FISCAL'],
    [SYNTHETIC_CSF_RFC],
    ['Registro Federal de Contribuyentes'],
    [SYNTHETIC_CSF_LEGAL_NAME],
    ['Nombre, denominación o razón', 'Lugar y Fecha de Emisión'],
    ['social', 'ZAPOPAN , JALISCO A 15 DE ENERO DE 2026'],
    ['idCIF: 19010012345'],
    ['VALIDA TU INFORMACIÓN FISCAL'],
    [SYNTHETIC_CSF_RFC],
    ['Datos de Identificación del Contribuyente:'],
    [`RFC: ${SYNTHETIC_CSF_RFC}`],
    [`Denominación/Razón Social: ${SYNTHETIC_CSF_LEGAL_NAME}`],
    ['Régimen Capital: SOCIEDAD CIVIL'],
    ['Nombre Comercial:'],
    ['Fecha inicio de operaciones: 17 DE MARZO DE 1990'],
    ['Estatus en el padrón: ACTIVO'],
    ['Fecha de último cambio de estado: 17 DE MARZO DE 1990'],
    ['Datos del domicilio registrado'],
    ['Código Postal:42501', 'Tipo de Vialidad: CALLE'],
    ['Nombre de Vialidad: FICTICIA', 'Número Exterior: 100'],
    ['Página [1] de [2]'],
  ], 750);
}

/** Página 2: regímenes (uno ya concluido y uno vigente), obligaciones, cadena original y sello. */
export function syntheticCsfRegimesPage(): PdfPageText {
  return stackRows([
    ['Regímenes:'],
    ['Régimen', 'Fecha Inicio Fecha Fin'],
    ['Régimen de Incorporación Fiscal', '01/01/2014 31/12/2021'],
    ['Régimen General de Ley Personas Morales', '17/03/1990'],
    ['Obligaciones:'],
    ['Declaración anual de ISR del ejercicio Personas morales.'],
    ['Sus datos personales son incorporados y protegidos en los sistemas del SAT'],
    [`Cadena Original Sello: ||2026/01/15 10:20:30|${SYNTHETIC_CSF_RFC}|CONSTANCIA DE SITUACIÓN FISCAL|`],
    ['200001088888800000031||'],
    ['Sello Digital: FICTICIO-SELLO-DIGITAL-SIN-VALOR-FISCAL'],
    ['Página [2] de [2]'],
  ], 750);
}

export function syntheticCsfPages(): readonly PdfPageText[] {
  return [syntheticCsfIdentityPage(), syntheticCsfRegimesPage()];
}

/** Escapa un texto como string literal PDF; los acentos van en WinAnsiEncoding (octal), igual que Latin-1. */
function pdfLiteral(text: string): string {
  let literal = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char === '(' || char === ')' || char === '\\') literal += `\\${char}`;
    else if (code >= 0x20 && code < 0x7f) literal += char;
    else if (code >= 0xa0 && code <= 0xff) literal += `\\${code.toString(8)}`;
    else throw new Error(`Carácter fuera de WinAnsiEncoding en el fixture: U+${code.toString(16)}`);
  }
  return `(${literal})`;
}

function contentStream(page: PdfPageText): string {
  return page
    .map(f => `BT /F1 ${String(FONT_SIZE)} Tf 1 0 0 1 ${String(f.x)} ${String(f.y)} Tm ${pdfLiteral(f.text)} Tj ET`)
    .join('\n');
}

/**
 * Arma un PDF 1.4 mínimo y válido (catálogo, páginas, fuente estándar Helvetica y una tabla xref exacta).
 * El texto es ASCII tras escapar, así que cada carácter ocupa un byte y los offsets de la xref son exactos.
 */
export function buildPdf(pages: readonly PdfPageText[], minSize = MIN_REALISTIC_SIZE): Uint8Array<ArrayBuffer> {
  const fontId = 3;
  const firstPageId = 4;
  const pageIds = pages.map((_, index) => firstPageId + index * 2);
  const objects = new Map<number, string>([
    [1, '<< /Type /Catalog /Pages 2 0 R >>'],
    [2, `<< /Type /Pages /Kids [${pageIds.map(id => `${String(id)} 0 R`).join(' ')}] /Count ${String(pages.length)} >>`],
    [fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'],
  ]);
  pages.forEach((page, index) => {
    const pageId = firstPageId + index * 2;
    const stream = contentStream(page);
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${String(PAGE_WIDTH)} ${String(PAGE_HEIGHT)}] `
      + `/Resources << /Font << /F1 ${String(fontId)} 0 R >> >> /Contents ${String(pageId + 1)} 0 R >>`);
    objects.set(pageId + 1, `<< /Length ${String(stream.length)} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const padding = Math.max(0, minSize - 2048);
  if (padding > 0) pdf += `%${'0'.repeat(padding)}\n`;

  // Los ids son consecutivos desde 1, así que la xref lista los offsets en el mismo orden.
  const offsets: number[] = [];
  for (const [id, body] of [...objects.entries()].sort(([a], [b]) => a - b)) {
    offsets.push(pdf.length);
    pdf += `${String(id)} 0 obj\n${body}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  const size = offsets.length + 1;
  pdf += `xref\n0 ${String(size)}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${String(size)} /Root 1 0 R >>\nstartxref\n${String(xrefOffset)}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}
