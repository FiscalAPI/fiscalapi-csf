import { describe, expect, it } from 'vitest';
import { groupIntoLines, type PositionedText } from '../src/pdf-text-lines.js';

const FONT_SIZE = 10;

function fragment(text: string, x: number, y: number, width = text.length * 5): PositionedText {
  return { text, x, y, width, fontSize: FONT_SIZE };
}

describe('groupIntoLines', () => {
  // Mata: tolerancia `<=` → `<` y tolerancia reducida.
  it('une en un renglón fragmentos a 2 pt de distancia vertical', () => {
    expect(groupIntoLines([fragment('RFC:', 10, 700), fragment('EKU9003173C9', 60, 702)])).toEqual(['RFC: EKU9003173C9']);
  });

  // Mata: tolerancia ampliada (p. ej. 3 pt).
  it('separa en renglones fragmentos a más de 2 pt de distancia vertical', () => {
    expect(groupIntoLines([fragment('RFC:', 10, 700), fragment('EKU9003173C9', 60, 702.5)])).toEqual(['EKU9003173C9', 'RFC:']);
  });

  // Mata: orden de renglones invertido y orden horizontal invertido.
  it('ordena los renglones de arriba hacia abajo y los fragmentos de izquierda a derecha', () => {
    const items = [fragment('abajo', 10, 100), fragment('derecha', 60, 500), fragment('izquierda', 10, 500)];
    expect(groupIntoLines(items)).toEqual(['izquierda derecha', 'abajo']);
  });

  // Mata: hueco `>` → `>=` y razón del hueco en 0.
  it('concatena sin espacio los fragmentos contiguos (mismo texto partido)', () => {
    const gapAtThreshold = 0.15 * FONT_SIZE;
    const items = [fragment('Régi', 10, 300, 20), fragment('men', 30, 300, 15), fragment('es:', 45 + gapAtThreshold, 300, 15)];
    expect(groupIntoLines(items)).toEqual(['Régimenes:']);
  });

  // Mata: razón del hueco ampliada (los fragmentos separados quedarían pegados).
  it('separa con un espacio los fragmentos con un hueco mayor al 15 % del tamaño de fuente', () => {
    const items = [fragment('Código', 10, 300, 30), fragment('Postal:', 40 + 0.15 * FONT_SIZE + 0.01, 300, 35)];
    expect(groupIntoLines(items)).toEqual(['Código Postal:']);
  });
});
