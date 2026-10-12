import type { SatTaxRegimeCode } from './csf-tax-regimes.js';

/** Tipo de contribuyente según la longitud del RFC: 13 = persona física (PF), 12 = persona moral (PM). */
export const CsfPersonType = {
  Individual: 'PF',
  LegalEntity: 'PM',
} as const;

export type CsfPersonType = (typeof CsfPersonType)[keyof typeof CsfPersonType];

/** Estatus en el padrón que se aceptan: una constancia con otro estatus se rechaza. */
export const CSF_ACTIVE_STATUSES = ['ACTIVO', 'REACTIVADO'] as const;

export type CsfTaxpayerStatus = (typeof CSF_ACTIVE_STATUSES)[number];

export interface CsfTaxRegime {
  /** Clave SAT c_RegimenFiscal (ej. "605"). */
  readonly code: SatTaxRegimeCode;
  /** Descripción tal como aparece en la constancia. */
  readonly description: string;
  /** Fecha inicio dd/mm/aaaa tal como aparece en la constancia. */
  readonly startDate: string;
}

/** Datos comunes a cualquier contribuyente extraídos de la constancia. */
export interface CsfTaxpayerData {
  readonly rfc: string;
  readonly legalName: string;
  readonly zipCode: string;
  /** Regímenes vigentes con clave SAT reconocida, en el orden de la constancia. */
  readonly activeRegimes: readonly CsfTaxRegime[];
  /** Regímenes vigentes cuya descripción no se pudo mapear a una clave SAT. */
  readonly unrecognizedRegimes: readonly string[];
  readonly idCif: string;
  /** Fecha de emisión (aaaa-mm-dd) tomada de la cadena original del sello. */
  readonly issueDate: string;
  readonly status: CsfTaxpayerStatus;
}

/** Constancia de una persona física: siempre trae CURP. */
export interface CsfIndividualData extends CsfTaxpayerData {
  readonly personType: typeof CsfPersonType.Individual;
  readonly curp: string;
}

/** Constancia de una persona moral: nunca trae CURP. */
export interface CsfLegalEntityData extends CsfTaxpayerData {
  readonly personType: typeof CsfPersonType.LegalEntity;
  readonly curp?: undefined;
}

/** Datos fiscales extraídos de una Constancia de Situación Fiscal (CSF) del SAT; `personType` distingue el caso. */
export type CsfData = CsfIndividualData | CsfLegalEntityData;
