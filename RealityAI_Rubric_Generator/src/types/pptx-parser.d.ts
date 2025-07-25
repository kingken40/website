// <reference types="node" />

declare module 'pptx-parser' {
  interface ParseOptions {
    outputDir?: string;
    slidesToExtract?: number[];
    extractMedia?: boolean;
  }

  interface SlideContent {
    slideNumber: number;
    text: string;
    images?: string[];
    shapes?: any[];
  }

  interface ParseResult {
    slides: SlideContent[];
    metadata?: {
      title?: string;
      author?: string;
      subject?: string;
      created?: Date;
      modified?: Date;
    };
  }

  // Define Buffer interface locally if @types/node is not available
  interface BufferLike {
    readonly length: number;
    [index: number]: number;
  }

  class PptxParser {
    constructor();
    parse(filePath: string | BufferLike | ArrayBuffer, options?: ParseOptions): Promise<ParseResult>;
    parseFromBuffer(buffer: BufferLike | ArrayBuffer | Uint8Array, options?: ParseOptions): Promise<ParseResult>;
    extractText(filePath: string | BufferLike | ArrayBuffer): Promise<string>;
  }

  export default PptxParser;
}