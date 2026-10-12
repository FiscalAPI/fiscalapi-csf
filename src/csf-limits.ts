import { CsfValidationError, CsfValidationErrorCode } from './csf-validation-error.js';

/*
 * Límites que debe cumplir el archivo antes de interpretarlo. Una CSF del SAT es un PDF de pocas páginas
 * y de decenas o cientos de KB; fuera de esos límites no es una constancia y no vale la pena abrirla.
 */

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MIN_FILE_BYTES = 10 * 1024;
const MAX_PAGES = 6;
const PDF_EXTENSION = /\.pdf$/i;
const PDF_SIGNATURE = '%PDF-';

/** Validaciones del archivo que no requieren abrir el PDF: extensión, tamaño y firma %PDF-. */
export async function readCsfFileBytes(file: File): Promise<Uint8Array> {
  if (!PDF_EXTENSION.test(file.name)) {
    throw new CsfValidationError(CsfValidationErrorCode.NotPdfFile, 'Selecciona un archivo PDF.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new CsfValidationError(CsfValidationErrorCode.FileTooLarge, 'El archivo excede el tamaño máximo de 5 MB.');
  }
  if (file.size < MIN_FILE_BYTES) {
    throw new CsfValidationError(CsfValidationErrorCode.FileTooSmall,
      'El archivo es demasiado pequeño para ser una constancia de situación fiscal.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = String.fromCharCode(...bytes.subarray(0, PDF_SIGNATURE.length));
  if (signature !== PDF_SIGNATURE) {
    throw new CsfValidationError(CsfValidationErrorCode.InvalidPdfSignature, 'El archivo no es un PDF válido.');
  }
  return bytes;
}

export function assertCsfPageCount(pageCount: number): void {
  if (pageCount < 1 || pageCount > MAX_PAGES) {
    throw new CsfValidationError(CsfValidationErrorCode.InvalidPageCount,
      'El número de páginas no corresponde a una constancia de situación fiscal.');
  }
}
