import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it } from 'vitest';
import { readCsfFileBytes } from '../src/csf-limits.js';
import { parseCsf } from '../src/csf-parser.js';
import { CsfValidationError, CsfValidationErrorCode } from '../src/csf-validation-error.js';
import { extractPdfLines } from '../src/pdf-text-extractor.js';
import { FakePdfJs, textItem } from './fixtures/fake-pdfjs.js';
import {
  buildPdf,
  SYNTHETIC_CSF_LEGAL_NAME,
  SYNTHETIC_CSF_RFC,
  syntheticCsfIdentityPage,
  syntheticCsfPages,
} from './fixtures/synthetic-csf-pdf.js';

// En Node se inyecta la build legacy de pdfjs-dist: la de navegador necesita un worker real.
const KB = 1024;

function pdfFile(bytes: Uint8Array<ArrayBuffer>, name = 'constancia.pdf'): File {
  return new File([bytes], name, { type: 'application/pdf' });
}

/** La operación falla con un CsfValidationError del código esperado y con el mensaje para el usuario. */
async function expectCsfRejection(
  operation: Promise<Uint8Array | string[]>,
  code: CsfValidationErrorCode,
  message: RegExp,
): Promise<void> {
  await expect(operation).rejects.toBeInstanceOf(CsfValidationError);
  await expect(operation).rejects.toHaveProperty('code', code);
  await expect(operation).rejects.toThrow(message);
}

describe('lectura y parse de una CSF sintética en PDF', () => {
  it('extrae los campos de la constancia de punta a punta', async () => {
    const bytes = await readCsfFileBytes(pdfFile(buildPdf(syntheticCsfPages())));
    const csf = parseCsf(await extractPdfLines(pdfjs, bytes));

    expect(csf).toStrictEqual({
      rfc: SYNTHETIC_CSF_RFC,
      personType: 'PM',
      legalName: SYNTHETIC_CSF_LEGAL_NAME,
      curp: undefined,
      zipCode: '42501',
      activeRegimes: [{ code: '601', description: 'Régimen General de Ley Personas Morales', startDate: '17/03/1990' }],
      unrecognizedRegimes: [],
      idCif: '19010012345',
      issueDate: '2026-01-15',
      status: 'ACTIVO',
    });
  });

  it('une en un renglón los fragmentos con la misma coordenada Y, ordenados por X', async () => {
    const lines = await extractPdfLines(pdfjs, buildPdf(syntheticCsfPages()));

    expect(lines).toContain('Código Postal:42501 Tipo de Vialidad: CALLE');
    expect(lines).toContain('Régimen General de Ley Personas Morales 17/03/1990');
  });
});

describe('readCsfFileBytes', () => {
  it('rechaza un archivo que no es .pdf', async () => {
    await expectCsfRejection(
      readCsfFileBytes(pdfFile(buildPdf(syntheticCsfPages()), 'constancia.png')),
      CsfValidationErrorCode.NotPdfFile,
      /^Selecciona un archivo PDF\.$/,
    );
  });

  it('rechaza un archivo mayor a 5 MB', async () => {
    await expectCsfRejection(
      readCsfFileBytes(pdfFile(buildPdf(syntheticCsfPages(), 5 * KB * KB + KB))),
      CsfValidationErrorCode.FileTooLarge,
      /tamaño máximo de 5 MB/,
    );
  });

  it('rechaza un archivo menor a 10 KB', async () => {
    await expectCsfRejection(
      readCsfFileBytes(pdfFile(buildPdf(syntheticCsfPages(), 0))),
      CsfValidationErrorCode.FileTooSmall,
      /demasiado pequeño/,
    );
  });

  it('rechaza un archivo sin la firma %PDF-', async () => {
    const bytes = new Uint8Array(12 * KB).fill(0x20);
    await expectCsfRejection(
      readCsfFileBytes(pdfFile(bytes)),
      CsfValidationErrorCode.InvalidPdfSignature,
      /no es un PDF válido/,
    );
  });
});

describe('extractPdfLines', () => {
  it('rechaza un PDF con más de 6 páginas', async () => {
    const pages = Array.from({ length: 7 }, syntheticCsfIdentityPage);
    await expectCsfRejection(
      extractPdfLines(pdfjs, buildPdf(pages)),
      CsfValidationErrorCode.InvalidPageCount,
      /número de páginas/,
    );
  });

  it('rechaza un PDF sin texto', async () => {
    await expectCsfRejection(
      extractPdfLines(pdfjs, buildPdf([[]])),
      CsfValidationErrorCode.NoText,
      /no contiene texto/,
    );
  });

  it('rechaza un PDF dañado', async () => {
    const damaged = buildPdf(syntheticCsfPages()).subarray(0, 200);
    await expectCsfRejection(
      extractPdfLines(pdfjs, damaged),
      CsfValidationErrorCode.UnreadablePdf,
      /dañado o no es un PDF válido/,
    );
  });
});

/** Bytes del tamaño exacto pedido con la firma %PDF-: basta para las validaciones previas a abrir el PDF. */
function signedBytes(size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size).fill(0x20);
  bytes.set(new TextEncoder().encode('%PDF-'));
  return bytes;
}

describe('readCsfFileBytes en los bordes de tamaño', () => {
  // Mata: `size > máximo` → `size >= máximo`.
  it('acepta exactamente 5 MB', async () => {
    await expect(readCsfFileBytes(pdfFile(signedBytes(5 * KB * KB)))).resolves.toHaveLength(5 * KB * KB);
  });

  // Mata: máximo ampliado.
  it('rechaza 5 MB + 1 byte', async () => {
    await expectCsfRejection(
      readCsfFileBytes(pdfFile(signedBytes(5 * KB * KB + 1))),
      CsfValidationErrorCode.FileTooLarge,
      /tamaño máximo de 5 MB/,
    );
  });

  // Mata: `size < mínimo` → `size <= mínimo`.
  it('acepta exactamente 10 KB', async () => {
    await expect(readCsfFileBytes(pdfFile(signedBytes(10 * KB)))).resolves.toHaveLength(10 * KB);
  });

  // Mata: mínimo reducido.
  it('rechaza 10 KB − 1 byte', async () => {
    await expectCsfRejection(
      readCsfFileBytes(pdfFile(signedBytes(10 * KB - 1))),
      CsfValidationErrorCode.FileTooSmall,
      /demasiado pequeño/,
    );
  });
});

describe('extractPdfLines con pdf.js inyectado', () => {
  const page = [textItem('Constancia', 10, 700)];

  // Mata: `páginas > 6` → `páginas >= 6`; además verifica que el documento se libere.
  it('acepta 6 páginas y libera el documento', async () => {
    const fake = FakePdfJs.withPages(Array.from({ length: 6 }, () => page));
    await expect(extractPdfLines(fake, new Uint8Array())).resolves.toHaveLength(6);
    expect(fake.destroyCount).toBe(1);
  });

  // Mata: máximo de páginas ampliado.
  it('rechaza 7 páginas y libera el documento', async () => {
    const fake = FakePdfJs.withPages(Array.from({ length: 7 }, () => page));
    await expectCsfRejection(extractPdfLines(fake, new Uint8Array()), CsfValidationErrorCode.InvalidPageCount, /número de páginas/);
    expect(fake.destroyCount).toBe(1);
  });

  // Mata: quitar la condición `páginas < 1`.
  it('rechaza un documento sin páginas', async () => {
    await expectCsfRejection(
      extractPdfLines(FakePdfJs.withPages([]), new Uint8Array()),
      CsfValidationErrorCode.InvalidPageCount,
      /número de páginas/,
    );
  });

  // Mata: no distinguir la PasswordException (o comparar otro nombre).
  it('reporta un PDF protegido con contraseña y libera la tarea', async () => {
    const fake = FakePdfJs.failingWith(Object.assign(new Error('No password given'), { name: 'PasswordException' }));
    await expectCsfRejection(
      extractPdfLines(fake, new Uint8Array()),
      CsfValidationErrorCode.PasswordProtected,
      /^El PDF está protegido con contraseña; descarga la constancia original del SAT\.$/,
    );
    expect(fake.destroyCount).toBe(1);
  });

  // Mata: tratar toda falla de apertura como contraseña.
  it('reporta como ilegible cualquier otra falla al abrir', async () => {
    await expectCsfRejection(
      extractPdfLines(FakePdfJs.failingWith(new Error('Invalid PDF structure')), new Uint8Array()),
      CsfValidationErrorCode.UnreadablePdf,
      /dañado o no es un PDF válido/,
    );
  });

  // Mata: quitar el type guard (las marcas de contenido no traen texto ni posición).
  it('descarta las marcas de contenido', async () => {
    const marked = [{ type: 'beginMarkedContent', id: '' }, textItem('RFC:', 10, 700), { type: 'endMarkedContent', id: '' }];
    await expect(extractPdfLines(FakePdfJs.withPages([marked]), new Uint8Array())).resolves.toEqual(['RFC:']);
  });
});
