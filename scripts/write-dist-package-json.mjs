// Marca el formato de cada salida: los .js de dist/cjs son CommonJS y los de dist/esm son ES modules.
// Sin estos package.json, Node interpretaría ambos según el package.json raíz (que no declara "type").
import { writeFileSync } from 'node:fs';

writeFileSync(new URL('../dist/cjs/package.json', import.meta.url), `${JSON.stringify({ type: 'commonjs' })}\n`);
writeFileSync(new URL('../dist/esm/package.json', import.meta.url), `${JSON.stringify({ type: 'module' })}\n`);
