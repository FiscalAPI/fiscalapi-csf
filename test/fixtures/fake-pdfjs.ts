import type { TextMarkedContent } from 'pdfjs-dist/types/src/display/api.js';
import type {
  PdfDocumentLike,
  PdfJsLike,
  PdfLoadingTaskLike,
  PdfTextItem,
} from '../../src/pdf-text-extractor.js';

export type FakePageItems = readonly (PdfTextItem | TextMarkedContent)[];

const FONT_SIZE = 9;

/** Fragmento de texto como lo entrega pdf.js: matriz [a, b, c, d, e, f] con la posición en e y f. */
export function textItem(str: string, x: number, y: number): PdfTextItem {
  return { str, dir: 'ltr', transform: [FONT_SIZE, 0, 0, FONT_SIZE, x, y], width: str.length * 5, height: FONT_SIZE, fontName: 'F1', hasEOL: false };
}

/** pdf.js falso para probar el lector sin un PDF real; cuenta cuántas veces se libera el documento. */
export class FakePdfJs implements PdfJsLike {
  destroyCount = 0;

  private constructor(private readonly open: () => Promise<PdfDocumentLike>) {}

  static withPages(pages: readonly FakePageItems[]): FakePdfJs {
    return new FakePdfJs(() => Promise.resolve({
      numPages: pages.length,
      getPage: (pageNumber: number) => Promise.resolve({
        getTextContent: () => Promise.resolve({ items: pages[pageNumber - 1] ?? [] }),
      }),
    }));
  }

  static failingWith(error: Error): FakePdfJs {
    return new FakePdfJs(() => Promise.reject(error));
  }

  getDocument(): PdfLoadingTaskLike {
    return {
      promise: this.open(),
      destroy: () => {
        this.destroyCount++;
        return Promise.resolve();
      },
    };
  }
}
