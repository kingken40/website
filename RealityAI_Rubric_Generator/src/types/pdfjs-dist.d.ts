declare module 'pdfjs-dist' {
  export function getDocument(src: string | ArrayBuffer | Uint8Array): PDFDocumentLoadingTask;
  
  interface PDFDocumentLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }
  
  interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNumber: number): Promise<PDFPageProxy>;
  }
  
  interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
  }
  
  interface TextContent {
    items: TextItem[];
  }
  
  interface TextItem {
    str: string;
    dir: string;
    width: number;
    height: number;
    transform: number[];
    fontName: string;
  }
}