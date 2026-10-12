import { describe, expect, it } from 'vitest';
import { parseCsf } from '../src/csf-parser.js';
import { CsfValidationError, CsfValidationErrorCode } from '../src/csf-validation-error.js';
import { mapTaxRegimeCode } from '../src/csf-tax-regimes.js';
import { PF_CURP, PF_RFC, pfLines, pmLines } from './fixtures/synthetic-csf-lines.js';

/**
 * Equivale al toThrowMatching de Jasmine original (la excepción es CsfValidationError y su mensaje cumple el
 * patrón) y además verifica el `code`, que es parte de la API pública.
 */
function expectRejected(lines: string[], code: CsfValidationErrorCode, message: RegExp): void {
  expect(() => parseCsf(lines)).toThrow(CsfValidationError);
  expect(() => parseCsf(lines)).toThrow(message);
  expect(() => parseCsf(lines)).toThrow(expect.objectContaining({ code }));
}

describe('parseCsf', () => {
  it('extrae los datos de una persona física con un régimen', () => {
    const csf = parseCsf(pfLines());
    expect(csf.rfc).toBe(PF_RFC);
    expect(csf.personType).toBe('PF');
    expect(csf.curp).toBe(PF_CURP);
    expect(csf.legalName).toBe('JUAN PEREZ GARCIA');
    expect(csf.zipCode).toBe('01010');
    expect(csf.activeRegimes.map(r => r.code)).toEqual(['605']);
    expect(csf.issueDate).toBe('2026-04-02');
    expect(csf.idCif).toBe('12345678901');
  });

  it('acepta segundo apellido vacío', () => {
    expect(parseCsf(pfLines({ secondLastName: '' })).legalName).toBe('JUAN PEREZ');
  });

  it('devuelve todos los regímenes vigentes', () => {
    const csf = parseCsf(pfLines({
      regimes: [
        'Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios 29/03/2016',
        'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas. 12/03/2025',
      ],
    }));
    expect(csf.activeRegimes.map(r => r.code)).toEqual(['605', '625']);
  });

  it('omite regímenes con fecha fin anterior a la emisión', () => {
    const csf = parseCsf(pfLines({
      regimes: [
        'Régimen de Incorporación Fiscal 01/01/2015 31/12/2021',
        'Régimen Simplificado de Confianza 01/01/2022',
      ],
    }));
    expect(csf.activeRegimes.map(r => r.code)).toEqual(['626']);
  });

  it('extrae los datos de una persona moral', () => {
    const csf = parseCsf(pmLines());
    expect(csf.personType).toBe('PM');
    expect(csf.legalName).toBe('ESCUELA KEMPER URGATE');
    expect(csf.curp).toBeUndefined();
    expect(csf.zipCode).toBe('45116');
    expect(csf.activeRegimes.map(r => r.code)).toEqual(['601']);
  });

  it('rechaza un documento que no es CSF', () => {
    expectRejected(['FACTURA', 'RFC emisor: EKU9003173C9', 'Total: 100.00'], CsfValidationErrorCode.NotACsf, /no es una Constancia/);
  });

  it('rechaza si falta una sección obligatoria', () => {
    expectRejected(pfLines().filter(l => !l.startsWith('Datos del domicilio')), CsfValidationErrorCode.NotACsf, /faltan secciones/);
  });

  it('rechaza RFC inconsistente con la cadena original', () => {
    expectRejected(pfLines().map(l => l.replace(`RFC: ${PF_RFC}`, 'RFC: PEGJ800101AB2')), CsfValidationErrorCode.RfcSealMismatch, /cadena original/);
  });

  it('rechaza RFC inconsistente en el encabezado', () => {
    expectRejected(pfLines().map(l => (l === PF_RFC ? 'PEGJ800101AB2' : l)), CsfValidationErrorCode.InconsistentRfc, /no es consistente/);
  });

  it('rechaza contribuyentes que no están activos', () => {
    expectRejected(pfLines({ status: 'CANCELADO' }), CsfValidationErrorCode.InactiveTaxpayer, /estatus "CANCELADO"/);
  });

  it('rechaza nombre distinto al de la cédula', () => {
    expectRejected(pfLines().map(l => l.replace('Nombre (s): JUAN', 'Nombre (s): PEDRO')), CsfValidationErrorCode.LegalNameMismatch, /no coincide con el de la cédula/);
  });

  it('rechaza CURP cuya fecha no coincide con el RFC', () => {
    expectRejected(pfLines().map(l => l.replace(`CURP: ${PF_CURP}`, 'CURP: PEGJ800102HJCRRN09')), CsfValidationErrorCode.CurpRfcDateMismatch, /fecha de la CURP/);
  });

  it('rechaza si ningún régimen vigente es reconocido', () => {
    expectRejected(pfLines({ regimes: ['Régimen Inventado 01/01/2020'] }), CsfValidationErrorCode.UnrecognizedRegime, /No se reconoce el régimen/);
  });
});

describe('mapTaxRegimeCode', () => {
  it('ignora acentos, mayúsculas, puntuación y el prefijo "Régimen de las"', () => {
    expect(mapTaxRegimeCode('RÉGIMEN DE LAS ACTIVIDADES EMPRESARIALES CON INGRESOS A TRAVÉS DE PLATAFORMAS TECNOLÓGICAS.')).toBe('625');
    expect(mapTaxRegimeCode('Régimen de las Personas Físicas con Actividades Empresariales y Profesionales')).toBe('612');
    expect(mapTaxRegimeCode('Régimen Simplificado de Confianza')).toBe('626');
  });

  it('no hace coincidencias parciales', () => {
    expect(mapTaxRegimeCode('Régimen General')).toBeNull();
  });
});
