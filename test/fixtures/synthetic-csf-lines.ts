/*
 * Renglones de texto SINTÉTICOS de una CSF (como los arma extractPdfLines). El repositorio es público:
 * los datos son ficticios; la persona moral usa el RFC de pruebas del SAT EKU9003173C9.
 */

export const PF_RFC = 'PEGJ800101AB1';
export const PF_CURP = 'PEGJ800101HJCRRN09';
export const PM_RFC = 'EKU9003173C9';

export function pfLines(overrides: { regimes?: string[]; status?: string; secondLastName?: string } = {}): string[] {
  const secondLastName = overrides.secondLastName ?? 'GARCIA';
  return [
    'Página [1] de [2]',
    'CÉDULA DE IDENTIFICACIÓN FISCAL',
    'CONSTANCIA DE SITUACIÓN FISCAL',
    PF_RFC,
    'Registro Federal de Contribuyentes',
    `JUAN PEREZ${secondLastName ? ' ' + secondLastName : ''}`,
    'Nombre, denominación o razón Lugar y Fecha de Emisión',
    'social',
    'ZAPOPAN , JALISCO A 02 DE ABRIL DE 2026',
    'idCIF: 12345678901',
    'VALIDA TU INFORMACIÓN',
    'FISCAL',
    PF_RFC,
    'Datos de Identificación del Contribuyente:',
    `RFC: ${PF_RFC}`,
    `CURP: ${PF_CURP}`,
    'Nombre (s): JUAN',
    'Primer Apellido: PEREZ',
    `Segundo Apellido:${secondLastName ? ' ' + secondLastName : ''}`,
    'Fecha inicio de operaciones: 19 DE DICIEMBRE DE 2012',
    `Estatus en el padrón: ${overrides.status ?? 'ACTIVO'}`,
    'Fecha de último cambio de estado: 28 DE SEPTIEMBRE DE 2013',
    'Nombre Comercial:',
    'Datos del domicilio registrado',
    'Código Postal:01010 Tipo de Vialidad: CALLE',
    'Nombre de Vialidad: PRINCIPAL Número Exterior: 1',
    'Página [2] de [2]',
    'Regímenes:',
    'Régimen Fecha Inicio Fecha Fin',
    ...(overrides.regimes ?? ['Régimen de Sueldos y Salarios e Ingresos Asimilados a Salarios 01/05/2024']),
    'Sus datos personales son incorporados y protegidos en los sistemas del SAT',
    `Cadena Original Sello: ||2026/04/02 11:40:42|${PF_RFC}|CONSTANCIA DE SITUACIÓN`,
    'FISCAL|200001088888800000041|FICTICIO-RESTO-DE-LA-CADENA||',
    'Sello Digital: FICTICIO-SELLO-DIGITAL-SIN-VALOR-FISCAL',
  ];
}

export function pmLines(): string[] {
  return [
    'CÉDULA DE IDENTIFICACIÓN FISCAL',
    'CONSTANCIA DE SITUACIÓN FISCAL',
    PM_RFC,
    'Registro Federal de Contribuyentes',
    'ESCUELA KEMPER URGATE',
    'Nombre, denominación o razón Lugar y Fecha de Emisión',
    'idCIF: 12345678902',
    PM_RFC,
    'Datos de Identificación del Contribuyente:',
    `RFC: ${PM_RFC}`,
    'Denominación/Razón Social: ESCUELA KEMPER URGATE',
    'Régimen Capital: SOCIEDAD ANONIMA DE CAPITAL VARIABLE',
    'Nombre Comercial: EKU',
    'Estatus en el padrón: REACTIVADO',
    'Datos del domicilio registrado',
    'Código Postal:45116 Tipo de Vialidad: AVENIDA (AV.)',
    'Regímenes:',
    'Régimen Fecha Inicio Fecha Fin',
    'Régimen General de Ley Personas Morales 04/03/2024',
    'Obligaciones:',
    `Cadena Original Sello: ||2024/11/01|${PM_RFC}|CONSTANCIA DE SITUACIÓN FISCAL|200001088888800000031||`,
    'Sello Digital: FICTICIO-SELLO-DIGITAL-SIN-VALOR-FISCAL',
  ];
}
