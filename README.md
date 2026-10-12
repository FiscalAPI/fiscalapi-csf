# fiscalapi-csf

Lee la Constancia de Situación Fiscal (CSF) del SAT.

Valida que un PDF sea una CSF auténtica en su estructura y extrae RFC, tipo de persona, nombre o razón social, CURP, código postal, regímenes fiscales vigentes (con su clave `c_RegimenFiscal`), idCIF, fecha de emisión y estatus en el padrón.

El PDF se procesa **en el navegador**: el archivo nunca sale del equipo del usuario. Tu aplicación decide qué campos confirmados envía a su servidor.

## Instalación

```bash
npm i fiscalapi-csf pdfjs-dist
```

`pdfjs-dist` (`^6.3.289`) es una dependencia *peer*: el paquete usa la copia que instala tu aplicación.

## Uso en el navegador

```ts
import { parseCsf, readCsfPdfLines } from 'fiscalapi-csf';

async function importarConstancia(file: File) {
  try {
    const csf = parseCsf(await readCsfPdfLines(file));
    console.log(csf.rfc, csf.legalName, csf.zipCode, csf.activeRegimes);
  } catch (error) {
    // Por nombre y no solo con instanceof: puede haber una copia ESM y otra CJS del paquete.
    if (error instanceof Error && error.name === 'CsfValidationError') {
      mostrarError(error.message); // mensaje en español, apto para el usuario
    } else {
      throw error;
    }
  }
}
```

`readCsfPdfLines` valida el archivo, carga `pdfjs-dist` bajo demanda (no engrosa el bundle inicial) y devuelve el texto en renglones; `parseCsf` valida la constancia y extrae los datos.

## Configuración del worker de pdf.js

pdf.js lee el PDF en un *web worker*. Solo tu bundler sabe dónde publicar ese archivo, así que configúralo **una vez, antes de la primera lectura**, con una de estas dos opciones de `GlobalWorkerOptions`:

**`workerPort`** (un `Worker` que crea tu aplicación). Por ejemplo, con Angular, crea `pdf.worker.ts`:

```ts
// pdf.worker.ts: el bundler lo empaqueta como un chunk .js
import 'pdfjs-dist/build/pdf.worker.min.mjs';
```

y antes de leer la constancia:

```ts
const { GlobalWorkerOptions } = await import('pdfjs-dist');
GlobalWorkerOptions.workerPort ??= new Worker(new URL('./pdf.worker', import.meta.url), { type: 'module' });
```

**`workerSrc`** (la URL donde tu aplicación publica `pdfjs-dist/build/pdf.worker.min.mjs`):

```ts
GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';
```

Sin worker configurado, pdf.js lanza `Error: No "GlobalWorkerOptions.workerSrc" specified.`; no es un `CsfValidationError` porque es un error de integración, no del archivo del usuario.

## Uso en Node.js

La build principal de `pdfjs-dist` es para navegadores. En Node.js (por ejemplo, en pruebas) usa la build *legacy* con `extractPdfLines`, que recibe pdf.js inyectado:

```ts
import { readFile } from 'node:fs/promises';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfLines, parseCsf, readCsfFileBytes } from 'fiscalapi-csf';

const file = new File([await readFile('constancia.pdf')], 'constancia.pdf');
const csf = parseCsf(await extractPdfLines(pdfjs, await readCsfFileBytes(file)));
```

El paquete se publica como ES module y CommonJS, con tipos para ambos.

## API

| Exportación | Descripción |
|---|---|
| `readCsfPdfLines(file: File): Promise<string[]>` | Valida el archivo y devuelve los renglones de texto del PDF (navegador). |
| `parseCsf(lines: readonly string[]): CsfData` | Valida la constancia y devuelve sus datos. |
| `readCsfFileBytes(file: File): Promise<Uint8Array>` | Solo las validaciones del archivo: extensión, tamaño y firma `%PDF-`. |
| `extractPdfLines(pdfjs: PdfJsLike, data: Uint8Array): Promise<string[]>` | Extrae los renglones con la build de pdf.js que recibas. |
| `CsfValidationError` | Error de validación: `message` para el usuario y `code` (`CsfValidationErrorCode`) para tu código. Distínguelo por `error.code` o `error.name` (`'CsfValidationError'`), no solo con `instanceof`: con una copia ESM y otra CJS del paquete hay dos clases. |
| `CsfData` | `CsfIndividualData \| CsfLegalEntityData`, distinguidos por `personType` (`'PF'` o `'PM'`). |
| `CsfTaxRegime` | `{ code, description, startDate }` de cada régimen vigente. |
| `PdfJsLike` | Subconjunto de pdf.js que usa el lector; el módulo de `pdfjs-dist` lo cumple tal cual. |

`CsfData` contiene:

| Campo | Contenido |
|---|---|
| `rfc` | RFC en mayúsculas, consistente en todo el documento y con la cadena original del sello. |
| `personType` | `'PF'` (RFC de 13 caracteres) o `'PM'` (12). |
| `legalName` | Nombre completo o denominación/razón social, en mayúsculas. |
| `curp` | CURP (solo persona física; en persona moral es `undefined`). |
| `zipCode` | Código postal del domicilio fiscal. |
| `activeRegimes` | Regímenes vigentes a la fecha de emisión con clave SAT reconocida. |
| `unrecognizedRegimes` | Regímenes vigentes cuya descripción no corresponde a una clave del catálogo. |
| `idCif` | idCIF de la constancia. |
| `issueDate` | Fecha de emisión (`aaaa-mm-dd`) tomada de la cadena original del sello. |
| `status` | `'ACTIVO'` o `'REACTIVADO'`. |

## Límites y validaciones

- Extensión `.pdf`, tamaño entre 10 KB y 5 MB y firma `%PDF-`, antes de abrir el archivo.
- De 1 a 6 páginas; solo se extrae el texto: no se renderiza, no se cargan fuentes ni se ejecuta XFA.
- PDF con contraseña, dañado o escaneado (sin texto): se rechaza con su propio `code`.
- Secciones obligatorias de la CSF, idCIF, cadena original del sello, RFC consistente, estatus activo, CURP coherente con el RFC (persona física), nombre igual al de la cédula, código postal y al menos un régimen vigente.
- Las etiquetas del documento se reconocen sin importar acentos, mayúsculas ni espacios (incluidos los no separables); los valores se devuelven como vienen en el PDF.
- Por lo mismo, un texto con forma de etiqueta dentro de un valor (por ejemplo `CURP :` o `Código Postal :` en una razón social) se toma como etiqueta: corta el valor o hace que se rechace la constancia.

## Licencia

[MPL-2.0](LICENSE.txt) © FISCAL API S DE R.L DE C.V
