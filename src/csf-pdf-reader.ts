import { readCsfFileBytes } from './csf-limits.js';
import { extractPdfLines } from './pdf-text-extractor.js';

/**
 * Valida el archivo y devuelve los renglones de texto del PDF. Carga pdfjs-dist bajo demanda para no engrosar
 * el bundle inicial del consumidor. El worker de pdfjs lo configura el consumidor antes de llamar
 * (GlobalWorkerOptions.workerPort o workerSrc), porque solo su bundler sabe dónde servirlo (ver README).
 */
export async function readCsfPdfLines(file: File): Promise<string[]> {
  const data = await readCsfFileBytes(file);
  return extractPdfLines(await import('pdfjs-dist'), data);
}
