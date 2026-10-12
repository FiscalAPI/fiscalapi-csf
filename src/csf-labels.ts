/*
 * Etiquetas impresas en la CSF, declaradas una sola vez. Se escriben como las imprime el SAT; las comparaciones
 * se hacen siempre sobre su forma canónica (ver canonical-text.ts), así que acentos, mayúsculas y espacios
 * distintos en el PDF no las rompen.
 */

/** Etiquetas de campo que pueden compartir renglón; cada una delimita el valor de la etiqueta anterior. */
export const CSF_FIELD_LABELS = [
  'RFC:', 'CURP:', 'Nombre (s):', 'Primer Apellido:', 'Segundo Apellido:', 'Denominación/Razón Social:',
  'Régimen Capital:', 'Nombre Comercial:', 'Fecha inicio de operaciones:', 'Estatus en el padrón:',
  'Fecha de último cambio de estado:', 'Código Postal:', 'Tipo de Vialidad:', 'Nombre de Vialidad:',
  'Número Exterior:', 'Número Interior:', 'Nombre de la Colonia:', 'Nombre de la Localidad:',
  'Nombre del Municipio o Demarcación Territorial:', 'Nombre de la Entidad Federativa:', 'Entre Calle:', 'Y Calle:',
] as const;

export type CsfFieldLabel = (typeof CSF_FIELD_LABELS)[number];

/** Títulos de sección y textos fijos del documento. */
export const CsfSectionLabel = {
  IdentificationCard: 'CÉDULA DE IDENTIFICACIÓN FISCAL',
  Constancia: 'CONSTANCIA DE SITUACIÓN FISCAL',
  PlaceAndDateOfIssue: 'Lugar y Fecha de Emisión',
  TaxpayerIdentification: 'Datos de Identificación del Contribuyente:',
  RegisteredAddress: 'Datos del domicilio registrado',
  Regimes: 'Regímenes:',
  RegimesTableHeader: 'Régimen Fecha Inicio Fecha Fin',
  Obligations: 'Obligaciones:',
  PersonalDataNotice: 'Sus datos personales',
  SealChain: 'Cadena Original Sello:',
  DigitalSeal: 'Sello Digital:',
  IdCif: 'idCIF:',
  Page: 'Página',
  PageOf: 'de',
} as const;

/** Secciones que toda CSF contiene; si falta alguna, el archivo no es una constancia. */
export const CSF_REQUIRED_SECTIONS = [
  CsfSectionLabel.IdentificationCard,
  CsfSectionLabel.Constancia,
  CsfSectionLabel.PlaceAndDateOfIssue,
  CsfSectionLabel.TaxpayerIdentification,
  CsfSectionLabel.RegisteredAddress,
  CsfSectionLabel.Regimes,
  CsfSectionLabel.SealChain,
  CsfSectionLabel.DigitalSeal,
] as const;
