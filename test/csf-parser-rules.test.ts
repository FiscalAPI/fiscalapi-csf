import { describe, expect, it } from 'vitest';
import { parseCsf } from '../src/csf-parser.js';
import { CsfValidationError, CsfValidationErrorCode } from '../src/csf-validation-error.js';
import { PF_CURP, PF_RFC, PM_RFC, pfLines, pmLines } from './fixtures/synthetic-csf-lines.js';

/*
 * Reglas de validación del parser que la spec migrada no cubría, cada una con la mutación que detecta.
 * Datos sintéticos (ver fixtures).
 */

function expectRejected(lines: readonly string[], code: CsfValidationErrorCode, message: RegExp): void {
  expect(() => parseCsf(lines)).toThrow(CsfValidationError);
  expect(() => parseCsf(lines)).toThrow(message);
  expect(() => parseCsf(lines)).toThrow(expect.objectContaining({ code }));
}

function replaceLine(lines: readonly string[], current: string, replacement: string): string[] {
  return lines.map(line => (line === current ? replacement : line));
}

describe('parseCsf: formato de RFC y CURP', () => {
  // Mata: quitar la validación del patrón del RFC (fallaría después, por la cadena del sello).
  it('rechaza un RFC con formato inválido', () => {
    expectRejected(
      replaceLine(pfLines(), `RFC: ${PF_RFC}`, 'RFC: PEGJ801301AB1'),
      CsfValidationErrorCode.InvalidRfc,
      /^El RFC de la constancia \(PEGJ801301AB1\) no tiene un formato válido\.$/,
    );
  });

  // Mata: quitar la validación del patrón de la CURP.
  it('rechaza una CURP con formato inválido', () => {
    expectRejected(
      replaceLine(pfLines(), `CURP: ${PF_CURP}`, 'CURP: PEGJ800101ZJCRRN09'),
      CsfValidationErrorCode.InvalidCurp,
      /^La CURP de la constancia \(PEGJ800101ZJCRRN09\) no tiene un formato válido\.$/,
    );
  });

  // Mata: quitar el rechazo de CURP en persona moral.
  it('rechaza una persona moral con CURP', () => {
    const lines = pmLines().flatMap(line => (line === `RFC: ${PM_RFC}` ? [line, 'CURP: PEGJ800101HJCRRN09'] : [line]));
    expectRejected(lines, CsfValidationErrorCode.UnexpectedCurp, /^La constancia de persona moral no debe contener CURP\.$/);
  });

  // Mata: rechazar la etiqueta CURP vacía en persona moral (el original solo rechaza si trae valor).
  it('acepta una persona moral con la etiqueta CURP vacía', () => {
    const lines = pmLines().flatMap(line => (line === `RFC: ${PM_RFC}` ? [line, 'CURP:'] : [line]));
    expect(parseCsf(lines).personType).toBe('PM');
  });
});

describe('parseCsf: consistencia del RFC', () => {
  // Mata: mínimo de apariciones reducido (3 → 2).
  it('rechaza un RFC que aparece menos de 3 veces antes del aviso de datos personales', () => {
    const lines = pfLines();
    lines.splice(lines.indexOf(PF_RFC), 1);
    expectRejected(lines, CsfValidationErrorCode.InconsistentRfc, /^El RFC no es consistente en todo el documento\.$/);
  });

  // Mata: tolerar espacios junto a los | del título en la cadena original del sello (texto sellado).
  it('rechaza la cadena original con espacios junto al título', () => {
    const lines = pmLines().map(line => line.replace('|CONSTANCIA DE SITUACIÓN FISCAL|', '| CONSTANCIA DE SITUACIÓN FISCAL|'));
    expectRejected(lines, CsfValidationErrorCode.MissingSealChain, /^La constancia no contiene una cadena original de sello válida\.$/);
  });
});

describe('parseCsf: regímenes', () => {
  // Mata: quitar la deduplicación por clave (se conserva el primero).
  it('conserva solo la primera aparición de cada clave', () => {
    const csf = parseCsf(pfLines({
      regimes: [
        'Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios 01/01/2010',
        'Sueldos y Salarios e Ingresos Asimilados a Salarios 01/01/2015',
      ],
    }));
    expect(csf.activeRegimes).toStrictEqual([
      { code: '605', description: 'Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios', startDate: '01/01/2010' },
    ]);
  });

  // Mata: `fecha fin <= emisión` → `fecha fin < emisión`.
  it('descarta un régimen cuya fecha fin es la fecha de emisión', () => {
    const csf = parseCsf(pfLines({
      regimes: ['Régimen de Incorporación Fiscal 01/01/2015 02/04/2026', 'Régimen Simplificado de Confianza 01/01/2022'],
    }));
    expect(csf.activeRegimes.map(regime => regime.code)).toEqual(['626']);
  });

  // Mata: descartar también los regímenes que terminan después de la emisión.
  it('conserva un régimen cuya fecha fin es posterior a la emisión', () => {
    const csf = parseCsf(pfLines({
      regimes: ['Régimen de Incorporación Fiscal 01/01/2015 03/04/2026', 'Régimen Simplificado de Confianza 01/01/2022'],
    }));
    expect(csf.activeRegimes.map(regime => regime.code)).toEqual(['621', '626']);
  });

  // Mata: confundir "sin regímenes vigentes" con "régimen no reconocido".
  it('rechaza una constancia sin regímenes vigentes', () => {
    expectRejected(
      pfLines({ regimes: ['Régimen Simplificado de Confianza 01/01/2022 31/12/2025'] }),
      CsfValidationErrorCode.NoActiveRegimes,
      /^La constancia no contiene regímenes fiscales vigentes\.$/,
    );
  });

  // Mata: buscar el inicio de la sección en cualquier parte del renglón (debe empezar con "Regímenes:").
  it('rechaza una constancia cuyo renglón no empieza con "Regímenes:"', () => {
    expectRejected(
      replaceLine(pfLines(), 'Regímenes:', 'Sección de Regímenes:'),
      CsfValidationErrorCode.MissingRegimesSection,
      /^La constancia no contiene la sección de regímenes\.$/,
    );
  });
});
