/** Motivo por el que un archivo no se acepta como CSF: permite reaccionar a cada caso sin interpretar el mensaje. */
export const CsfValidationErrorCode = {
  NotPdfFile: 'not-pdf-file',
  FileTooLarge: 'file-too-large',
  FileTooSmall: 'file-too-small',
  InvalidPdfSignature: 'invalid-pdf-signature',
  PasswordProtected: 'password-protected',
  UnreadablePdf: 'unreadable-pdf',
  InvalidPageCount: 'invalid-page-count',
  NoText: 'no-text',
  NotACsf: 'not-a-csf',
  MissingIdCif: 'missing-id-cif',
  MissingSealChain: 'missing-seal-chain',
  MissingRfc: 'missing-rfc',
  InvalidRfc: 'invalid-rfc',
  RfcSealMismatch: 'rfc-seal-mismatch',
  InconsistentRfc: 'inconsistent-rfc',
  MissingStatus: 'missing-status',
  InactiveTaxpayer: 'inactive-taxpayer',
  MissingCurp: 'missing-curp',
  InvalidCurp: 'invalid-curp',
  CurpRfcDateMismatch: 'curp-rfc-date-mismatch',
  MissingFullName: 'missing-full-name',
  UnexpectedCurp: 'unexpected-curp',
  MissingLegalName: 'missing-legal-name',
  LegalNameMismatch: 'legal-name-mismatch',
  MissingZipCode: 'missing-zip-code',
  MissingRegimesSection: 'missing-regimes-section',
  UnrecognizedRegime: 'unrecognized-regime',
  NoActiveRegimes: 'no-active-regimes',
} as const;

export type CsfValidationErrorCode = (typeof CsfValidationErrorCode)[keyof typeof CsfValidationErrorCode];

/** El archivo no es una CSF válida. El mensaje es apto para mostrarse al usuario; `code` identifica el motivo. */
export class CsfValidationError extends Error {
  override readonly name = 'CsfValidationError';

  constructor(readonly code: CsfValidationErrorCode, message: string) {
    super(message);
  }
}
