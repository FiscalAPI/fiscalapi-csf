import { requiredGroup } from './required-group.js';

/*
 * Forma canónica para comparar etiquetas sin depender de cambios cosméticos que el SAT hace al PDF entre
 * versiones: acentos agregados o quitados, mayúsculas y espacios. Solo sirve para LOCALIZAR etiquetas;
 * los valores se leen siempre del texto original con el mapa de posiciones de CanonicalText.
 */

const LOCALE = 'es-MX';
const COMBINING_MARK = /\p{M}/gu;
/** `\s` cubre espacios no separables (U+00A0, U+202F), tipográficos (U+2000–U+200A), U+3000, U+FEFF y saltos; se agrega U+200B. */
const WHITESPACE = /^[\s\u200b]$/u;
const LINE_BREAK = /^[\n\r\u2028\u2029]$/u;
const COLON = ':';
const SPACE = ' ';
const NEW_LINE = '\n';
const REGEXP_SPECIAL = /[.*+?^${}()|[\]\\/]/g;

/** Posiciones en el texto original de un tramo de la forma canónica. */
export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

interface PendingSeparator {
  separator: typeof SPACE | typeof NEW_LINE;
  readonly start: number;
  end: number;
}

/**
 * Carácter sin acentos ni diéresis y en minúsculas.
 * NFD separa la letra base de sus marcas (é → e + U+0301); al quitar las marcas, "Régimen" y "Regimen" son iguales.
 * NFD (y no NFKD) no convierte dígitos ni letras de compatibilidad, así que los valores numéricos no cambian.
 * Las minúsculas con un locale fijo hacen el resultado determinista sin importar el idioma del navegador.
 */
function foldCharacter(char: string): string {
  return char.normalize('NFD').replace(COMBINING_MARK, '').toLocaleLowerCase(LOCALE);
}

/** Construye la forma canónica y, por cada carácter de ella, el tramo del texto original que lo produjo. */
class CanonicalTextBuilder {
  private value = '';
  private readonly starts: number[] = [];
  private readonly ends: number[] = [];
  private pending: PendingSeparator | null = null;

  constructor(private readonly source: string) {}

  build(): CanonicalText {
    let index = 0;
    for (const char of this.source) {
      const end = index + char.length;
      if (WHITESPACE.test(char)) this.addWhitespace(char, index, end);
      else this.addCharacter(foldCharacter(char), index, end);
      index = end;
    }
    // Un separador pendiente al final se descarta: equivale a recortar el texto.
    return new CanonicalText(this.source, this.value, this.starts, this.ends);
  }

  /** Cada racha de espacios cuenta como un solo separador; si incluye un salto, se conserva como salto de línea. */
  private addWhitespace(char: string, start: number, end: number): void {
    if (this.value.length === 0) return; // espacios al inicio: se recortan
    const separator = LINE_BREAK.test(char) ? NEW_LINE : SPACE;
    if (this.pending === null) {
      this.pending = { separator, start, end };
      return;
    }
    this.pending.end = end;
    if (separator === NEW_LINE) this.pending.separator = NEW_LINE;
  }

  private addCharacter(folded: string, start: number, end: number): void {
    if (folded.length === 0) {
      // Marca suelta (acento ya descompuesto): pertenece al carácter anterior en el texto original.
      if (this.pending === null && this.ends.length > 0) this.ends[this.ends.length - 1] = end;
      return;
    }
    this.flushPending(folded);
    this.push(folded, start, end);
  }

  /** "RFC :" equivale a "RFC:": el espacio antes de los dos puntos no distingue etiquetas. */
  private flushPending(next: string): void {
    const pending = this.pending;
    if (pending === null) return;
    this.pending = null;
    if (next === COLON && pending.separator === SPACE) return;
    this.push(pending.separator, pending.start, pending.end);
  }

  private push(text: string, start: number, end: number): void {
    this.value += text;
    // Una posición por unidad UTF-16 agregada, para que los índices de la regex sobre `value` coincidan.
    this.starts.push(...Array<number>(text.length).fill(start));
    this.ends.push(...Array<number>(text.length).fill(end));
  }
}

/** Una coincidencia buscada en la forma canónica, con acceso a su texto original. */
export class CanonicalMatch {
  constructor(private readonly text: CanonicalText, private readonly indices: RegExpIndicesArray) {}

  /** Tramo del texto original que ocupa toda la coincidencia. */
  get sourceSpan(): SourceSpan {
    return this.requiredSpan(0);
  }

  /** Texto ORIGINAL del grupo de captura (sin canonizar), o undefined si el grupo no participó. */
  group(index: number): string | undefined {
    const span = this.spanOf(index);
    return span === undefined ? undefined : this.text.sourceText(span);
  }

  /** Texto ORIGINAL de un grupo obligatorio del patrón (ver requiredGroup). */
  requiredGroup(index: number): string {
    return this.text.sourceText(this.requiredSpan(index));
  }

  private spanOf(index: number): SourceSpan | undefined {
    const range = this.indices[index];
    return range === undefined ? undefined : this.text.sourceSpan(range[0], range[1]);
  }

  private requiredSpan(index: number): SourceSpan {
    const [start, end] = requiredGroup(this.indices, index);
    return this.text.sourceSpan(start, end);
  }
}

/** Texto original junto con su forma canónica y el mapa de posiciones entre ambos. */
export class CanonicalText {
  constructor(
    readonly source: string,
    readonly value: string,
    private readonly starts: readonly number[],
    private readonly ends: readonly number[],
  ) {}

  static of(source: string): CanonicalText {
    return new CanonicalTextBuilder(source).build();
  }

  /** Primera coincidencia del patrón (escrito sobre la forma canónica y con la bandera `d`). */
  find(pattern: RegExp): CanonicalMatch | null {
    const match = pattern.exec(this.value);
    return match === null ? null : new CanonicalMatch(this, indicesOf(match));
  }

  /** Todas las coincidencias del patrón (con las banderas `g` y `d`). */
  findAll(pattern: RegExp): CanonicalMatch[] {
    return [...this.value.matchAll(pattern)].map(match => new CanonicalMatch(this, indicesOf(match)));
  }

  /** Tramo del texto original que corresponde al tramo [start, end) de la forma canónica. */
  sourceSpan(start: number, end: number): SourceSpan {
    const sourceStart = this.starts[start] ?? this.source.length;
    const sourceEnd = end > start ? this.ends[end - 1] ?? this.source.length : sourceStart;
    return { start: sourceStart, end: sourceEnd };
  }

  sourceText(span: SourceSpan): string {
    return this.source.slice(span.start, span.end);
  }
}

function indicesOf(match: RegExpExecArray | RegExpMatchArray): RegExpIndicesArray {
  if (match.indices === undefined) throw new Error('Los patrones sobre la forma canónica deben usar la bandera d.');
  return match.indices;
}

/**
 * Forma canónica de una etiqueta: sin acentos, en minúsculas, con cada racha de espacios (incluidos los no
 * separables y los saltos) reducida a un espacio, recortada y sin espacio antes de los dos puntos.
 * Los dos puntos se conservan: separan la etiqueta de su valor y evitan confundir palabras del valor con etiquetas.
 */
export function canonicalLabel(text: string): string {
  return CanonicalText.of(text).value.replaceAll(NEW_LINE, SPACE);
}

/** Patrón regex de una etiqueta sobre la forma canónica: entre palabras admite espacio o salto de línea. */
export function labelPattern(label: string): string {
  return canonicalLabel(label).replace(REGEXP_SPECIAL, '\\$&').replaceAll(SPACE, '[ \\n]');
}
