import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Tipado estricto: además de strictTypeChecked y stylisticTypeChecked, se prohíben las construcciones que esconden tipos
// (`unknown` escrito, aserciones `as` salvo `as const`, `<T>x`, `!` y cualquier comentario @ts-*).
const STRICT_TYPING_RESTRICTIONS = [
  { selector: 'TSAnyKeyword', message: 'No uses any: declara un tipo con nombre.' },
  { selector: 'TSUnknownKeyword', message: 'No escribas unknown: declara un tipo con nombre y un type guard.' },
  {
    selector: 'TSAsExpression:not([typeAnnotation.type="TSTypeReference"][typeAnnotation.typeName.name="const"])',
    message: 'No uses aserciones as (salvo as const): narra el tipo con un type guard.',
  },
  { selector: 'TSTypeAssertion', message: 'No uses aserciones <T>: narra el tipo con un type guard.' },
  { selector: 'TSNonNullExpression', message: 'No uses !: maneja el caso null o undefined.' },
];

export default defineConfig(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
  {
    files: ['**/*.ts', '**/*.mts'],
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-check': true,
        'ts-expect-error': true,
        'ts-ignore': true,
        'ts-nocheck': true,
      }],
      'no-restricted-syntax': ['error', ...STRICT_TYPING_RESTRICTIONS],
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { URL: 'readonly' },
    },
  },
);
