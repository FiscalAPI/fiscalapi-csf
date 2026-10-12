import type { DocumentInitParameters, TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api.js';
import { assertCsfPageCount } from './csf-limits.js';
import { CsfValidationError, CsfValidationErrorCode } from './csf-validation-error.js';
import { groupIntoLines, type PositionedText } from './pdf-text-lines.js';

/**
 * Fragmento de texto de pdfjs con la matriz de transformación tipada: pdfjs la declara `Array<any>`;
 * aquí se fija como números para leer las coordenadas sin perder el tipado.
 */
export interface PdfTextItem extends Omit<TextItem, 'transform'> {
  readonly transform: readonly number[];
}

/** Contenido de texto de una página: fragmentos de texto y marcas de contenido (estas se descartan). */
export interface PdfTextContent {
  readonly items: readonly (PdfTextItem | TextMarkedContent)[];
}

export interface PdfPageLike {
  getTextContent(): Promise<PdfTextContent>;
}

export interface PdfDocumentLike {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
}

export interface PdfLoadingTaskLike {
  readonly promise: Promise<PdfDocumentLike>;
  destroy(): Promise<void>;
}

/**
 * Subconjunto de la API de pdfjs-dist que usa el lector. El módulo de pdfjs-dist lo cumple tal cual;
 * existe para inyectar otra build (p. ej. la legacy de Node en pruebas).
 */
export interface PdfJsLike {
  getDocument(params: DocumentInitParameters): PdfLoadingTaskLike;
}

/** Matriz [a, b, c, d, e, f] de pdfjs: `d` es la escala vertical (tamaño de fuente); `e` y `f`, la posición. */
type TextMatrix = readonly [number, number, number, number, number, number];

interface PlacedPdfTextItem extends PdfTextItem {
  readonly transform: TextMatrix;
}

const TEXT_MATRIX_LENGTH = 6;
/** Nombre que pdfjs da a la excepción de un PDF cifrado con contraseña. */
const PASSWORD_EXCEPTION = 'PasswordException';

/** Solo lectura de texto: sin fuentes, sin red por rangos, sin XFA y deteniéndose ante el primer error. */
const TEXT_ONLY_OPTIONS = {
  disableFontFace: true,
  disableAutoFetch: true,
  disableStream: true,
  disableRange: true,
  stopAtErrors: true,
  useSystemFonts: false,
  enableXfa: false,
} as const satisfies DocumentInitParameters;

function hasTextMatrix(transform: readonly number[]): transform is TextMatrix {
  return transform.length === TEXT_MATRIX_LENGTH;
}

/** Distingue un fragmento de texto con posición de una marca de contenido (que no trae `str`). */
function isPlacedTextItem(item: PdfTextItem | TextMarkedContent): item is PlacedPdfTextItem {
  return 'str' in item && hasTextMatrix(item.transform);
}

function toPositionedText(item: PlacedPdfTextItem): PositionedText {
  const [, , , scaleY, x, y] = item.transform;
  return { text: item.str, x, y, width: item.width, fontSize: Math.abs(scaleY) || 1 };
}

/** Abre el documento; si falla, libera la tarea y traduce el error de pdfjs a un CsfValidationError. */
async function openDocument(loadingTask: PdfLoadingTaskLike): Promise<PdfDocumentLike> {
  try {
    return await loadingTask.promise;
  } catch (error) {
    await loadingTask.destroy();
    // Las excepciones de pdfjs heredan de Error y se distinguen por `name`.
    throw error instanceof Error && error.name === PASSWORD_EXCEPTION
      ? new CsfValidationError(CsfValidationErrorCode.PasswordProtected,
        'El PDF está protegido con contraseña; descarga la constancia original del SAT.')
      : new CsfValidationError(CsfValidationErrorCode.UnreadablePdf,
        'No se pudo leer el PDF; el archivo está dañado o no es un PDF válido.');
  }
}

async function readPageLines(pdf: PdfDocumentLike, pageNumber: number): Promise<string[]> {
  const page = await pdf.getPage(pageNumber);
  const { items } = await page.getTextContent();
  return groupIntoLines(items.filter(isPlacedTextItem).map(toPositionedText));
}

/**
 * Extrae el texto del PDF como renglones en orden de lectura, página por página.
 * No renderiza, no ejecuta scripts ni carga fuentes; el documento se destruye siempre.
 */
export async function extractPdfLines(pdfjs: PdfJsLike, data: Uint8Array): Promise<string[]> {
  const loadingTask = pdfjs.getDocument({ data, ...TEXT_ONLY_OPTIONS });
  const pdf = await openDocument(loadingTask);
  try {
    assertCsfPageCount(pdf.numPages);
    const lines: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      lines.push(...await readPageLines(pdf, pageNumber));
    }

    if (lines.join('').trim().length === 0) {
      throw new CsfValidationError(CsfValidationErrorCode.NoText,
        'El PDF no contiene texto (parece un escaneo o imagen); descarga la constancia original del SAT.');
    }
    return lines;
  } finally {
    await loadingTask.destroy();
  }
}
