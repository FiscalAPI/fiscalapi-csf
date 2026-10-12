import { CanonicalText, labelPattern } from './canonical-text.js';
import { CSF_REQUIRED_SECTIONS, CsfSectionLabel, type CsfFieldLabel } from './csf-labels.js';
import {
  CSF_ACTIVE_STATUSES,
  CsfPersonType,
  type CsfData,
  type CsfIndividualData,
  type CsfLegalEntityData,
  type CsfTaxpayerStatus,
} from './csf.models.js';
import { readRegimesSection, type CsfRegimesSection } from './csf-regimes-section.js';
import { collapseWhitespace, containsLabel, fieldValue, labelIndex, normalizeLine, removePageMarkers } from './csf-text.js';
import { CsfValidationError, CsfValidationErrorCode } from './csf-validation-error.js';

/*
 * Parser determinista de la Constancia de Situación Fiscal (CSF) del SAT.
 * Recibe las líneas de texto del PDF (ver csf-pdf-reader.ts) y valida estructura y consistencia
 * antes de devolver los datos. Cualquier desviación lanza CsfValidationError, en el orden de los pasos.
 * Las etiquetas se localizan en la forma canónica del texto; los valores se leen del texto original.
 */

// Mismo patrón que ValidationService.rfcPattern de fapi-front.
const RFC_PATTERN = /^[A-Z&Ñ]{3,4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/;
const RFC_TOKEN = /(?<![A-Z0-9&Ñ])[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}(?![A-Z0-9&Ñ])/g;
const CURP_PATTERN = /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HMX](AS|B[CS]|C[CLMSH]|D[FG]|G[TR]|HG|JC|M[CNS]|N[ETL]|OC|PL|Q[TR]|S[PLR]|T[CSL]|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;
/** Patrones sobre la forma canónica (minúsculas, sin acentos); sus grupos devuelven el texto original. */
const ID_CIF = new RegExp(`${labelPattern(CsfSectionLabel.IdCif)}[ \\n]?(\\d{11})(?!\\d)`, 'd');
const ZIP_CODE_LABEL: CsfFieldLabel = 'Código Postal:';
const ZIP_CODE = new RegExp(`${labelPattern(ZIP_CODE_LABEL)}[ \\n]?(\\d{5})(?!\\d)`, 'd');
/**
 * Cadena original del sello: ||aaaa/mm/dd ...|RFC|CONSTANCIA DE SITUACIÓN FISCAL|...
 * Es texto sellado: el título va pegado a los | como en el original; solo se toleran acentos, mayúsculas y
 * espacios ENTRE sus palabras.
 */
const SEAL_CHAIN = new RegExp(
  `\\|\\|(\\d{4})/(\\d{2})/(\\d{2})[^|]*\\|([a-z&0-9]{12,13})\\|${labelPattern(CsfSectionLabel.Constancia)}\\|`, 'd');
/** Longitud del RFC de una persona física; el de una persona moral tiene 12. */
const INDIVIDUAL_RFC_LENGTH = 13;
/** Posiciones de la fecha de nacimiento (aammdd) en el RFC y en la CURP. */
const BIRTH_DATE_START = 4;
const BIRTH_DATE_END = 10;
/** El RFC aparece al menos en el encabezado, en la cédula y en los datos de identificación. */
const MIN_RFC_OCCURRENCES = 3;

/** Fecha de emisión y RFC tomados de la cadena original del sello. */
interface SealChain {
  readonly issueDate: string;
  readonly rfc: string;
}

/**
 * Tipo de persona, nombre o razón social (en mayúsculas) y CURP. La persona moral lleva `curp: undefined`
 * explícito para que el resultado tenga siempre las mismas propiedades.
 */
type CsfIdentity =
  | Pick<CsfIndividualData, 'personType' | 'legalName' | 'curp'>
  | (Pick<CsfLegalEntityData, 'personType' | 'legalName'> & { readonly curp: undefined });

function fail(code: CsfValidationErrorCode, message: string): never {
  throw new CsfValidationError(code, message);
}

/** Renglones normalizados y sin el pie "Página [n] de [m]". */
function cleanLines(lines: readonly string[]): string[] {
  return lines
    .map(normalizeLine)
    .map(line => removePageMarkers(line).trim())
    .filter(line => line.length > 0);
}

function assertCsfStructure(text: CanonicalText): void {
  if (!CSF_REQUIRED_SECTIONS.every(section => containsLabel(text, section))) {
    fail(CsfValidationErrorCode.NotACsf, 'El archivo no es una Constancia de Situación Fiscal del SAT (faltan secciones obligatorias).');
  }
}

function readIdCif(text: CanonicalText): string {
  return text.find(ID_CIF)?.group(1) ?? fail(CsfValidationErrorCode.MissingIdCif, 'La constancia no contiene un idCIF válido.');
}

function readSealChain(text: CanonicalText): SealChain {
  const chain = text.find(SEAL_CHAIN)
    ?? fail(CsfValidationErrorCode.MissingSealChain, 'La constancia no contiene una cadena original de sello válida.');
  return {
    issueDate: `${chain.requiredGroup(1)}-${chain.requiredGroup(2)}-${chain.requiredGroup(3)}`,
    rfc: chain.requiredGroup(4).toUpperCase(),
  };
}

/** RFC con patrón válido y consistente en encabezado, cédula, datos de identificación y cadena original. */
function readRfc(text: CanonicalText, sealRfc: string): string {
  const rfc = fieldValue(text, 'RFC:')?.toUpperCase() ?? fail(CsfValidationErrorCode.MissingRfc, 'La constancia no contiene el RFC.');
  if (!RFC_PATTERN.test(rfc)) fail(CsfValidationErrorCode.InvalidRfc, `El RFC de la constancia (${rfc}) no tiene un formato válido.`);
  if (rfc !== sealRfc) fail(CsfValidationErrorCode.RfcSealMismatch, 'El RFC de la constancia no coincide con el de la cadena original del sello.');

  // La cadena original y el sello van después del aviso de datos personales y no cuentan como apariciones.
  const sealStart = labelIndex(text, CsfSectionLabel.PersonalDataNotice);
  const content = sealStart > 0 ? text.source.slice(0, sealStart) : text.source;
  const rfcTokens = content.match(RFC_TOKEN) ?? [];
  if (rfcTokens.length < MIN_RFC_OCCURRENCES || rfcTokens.some(token => token !== rfc)) {
    fail(CsfValidationErrorCode.InconsistentRfc, 'El RFC no es consistente en todo el documento.');
  }
  return rfc;
}

function isActiveStatus(status: string): status is CsfTaxpayerStatus {
  return CSF_ACTIVE_STATUSES.some(active => active === status);
}

function readActiveStatus(text: CanonicalText): CsfTaxpayerStatus {
  const status = fieldValue(text, 'Estatus en el padrón:')?.toUpperCase()
    ?? fail(CsfValidationErrorCode.MissingStatus, 'La constancia no contiene el estatus en el padrón.');
  if (!isActiveStatus(status)) {
    fail(CsfValidationErrorCode.InactiveTaxpayer,
      `El contribuyente tiene estatus "${status}" en el padrón del SAT; solo se aceptan constancias con estatus activo.`);
  }
  return status;
}

function readIndividualIdentity(text: CanonicalText, rfc: string): CsfIdentity {
  const curp = fieldValue(text, 'CURP:')?.toUpperCase()
    ?? fail(CsfValidationErrorCode.MissingCurp, 'La constancia de persona física no contiene la CURP.');
  if (!CURP_PATTERN.test(curp)) fail(CsfValidationErrorCode.InvalidCurp, `La CURP de la constancia (${curp}) no tiene un formato válido.`);
  if (curp.substring(BIRTH_DATE_START, BIRTH_DATE_END) !== rfc.substring(BIRTH_DATE_START, BIRTH_DATE_END)) {
    fail(CsfValidationErrorCode.CurpRfcDateMismatch, 'La fecha de la CURP no coincide con la del RFC.');
  }

  const names = fieldValue(text, 'Nombre (s):');
  const firstLastName = fieldValue(text, 'Primer Apellido:');
  const secondLastName = fieldValue(text, 'Segundo Apellido:');
  if (!names || firstLastName === null || secondLastName === null) {
    fail(CsfValidationErrorCode.MissingFullName, 'La constancia no contiene el nombre completo del contribuyente.');
  }
  // El segundo apellido puede venir vacío.
  const fullName = [names, firstLastName, secondLastName].filter(part => part.length > 0).join(' ');
  return { personType: CsfPersonType.Individual, legalName: collapseWhitespace(fullName).toUpperCase(), curp };
}

function readLegalEntityIdentity(text: CanonicalText): CsfIdentity {
  if (fieldValue(text, 'CURP:')) fail(CsfValidationErrorCode.UnexpectedCurp, 'La constancia de persona moral no debe contener CURP.');
  const legalName = collapseWhitespace(fieldValue(text, 'Denominación/Razón Social:') ?? '');
  if (!legalName) fail(CsfValidationErrorCode.MissingLegalName, 'La constancia no contiene la denominación o razón social.');
  return { personType: CsfPersonType.LegalEntity, legalName: legalName.toUpperCase(), curp: undefined };
}

function readIdentity(text: CanonicalText, rfc: string): CsfIdentity {
  return rfc.length === INDIVIDUAL_RFC_LENGTH ? readIndividualIdentity(text, rfc) : readLegalEntityIdentity(text);
}

/** El nombre debe coincidir con el de la cédula de identificación (encabezado). */
function assertNameMatchesHeader(text: CanonicalText, legalName: string): void {
  const header = text.source.slice(0, labelIndex(text, CsfSectionLabel.TaxpayerIdentification));
  if (!collapseWhitespace(header).toUpperCase().includes(legalName)) {
    fail(CsfValidationErrorCode.LegalNameMismatch, 'El nombre o razón social no coincide con el de la cédula de identificación fiscal.');
  }
}

function readZipCode(text: CanonicalText): string {
  return text.find(ZIP_CODE)?.group(1) ?? fail(CsfValidationErrorCode.MissingZipCode, 'La constancia no contiene un código postal válido.');
}

function readActiveRegimes(lines: readonly string[], issueDate: string): CsfRegimesSection {
  const regimes = readRegimesSection(lines, issueDate);
  if (regimes.active.length === 0) {
    if (regimes.unrecognized.length > 0) {
      fail(CsfValidationErrorCode.UnrecognizedRegime,
        `No se reconoce el régimen fiscal de la constancia: ${regimes.unrecognized.join('; ')}.`);
    }
    fail(CsfValidationErrorCode.NoActiveRegimes, 'La constancia no contiene regímenes fiscales vigentes.');
  }
  return regimes;
}

/**
 * Valida y extrae los datos fiscales de las líneas de texto de una CSF.
 * @param lines Líneas del PDF en orden de lectura (todas las páginas).
 */
export function parseCsf(lines: readonly string[]): CsfData {
  const clean = cleanLines(lines);
  const text = CanonicalText.of(clean.join('\n'));

  assertCsfStructure(text);
  const idCif = readIdCif(text);
  const seal = readSealChain(text);
  const rfc = readRfc(text, seal.rfc);
  const status = readActiveStatus(text);
  const identity = readIdentity(text, rfc);
  assertNameMatchesHeader(text, identity.legalName);
  const zipCode = readZipCode(text);
  const regimes = readActiveRegimes(clean, seal.issueDate);

  return {
    rfc,
    ...identity,
    zipCode,
    activeRegimes: regimes.active,
    unrecognizedRegimes: regimes.unrecognized,
    idCif,
    issueDate: seal.issueDate,
    status,
  };
}
