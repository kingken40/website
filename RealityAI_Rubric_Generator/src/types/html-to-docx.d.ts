declare module 'html-to-docx' {
  interface ConversionOptions {
    table?: {
      row?: {
        cantSplit?: boolean;
      };
    };
    footer?: boolean;
    pageNumber?: boolean;
    font?: string;
    fontSize?: string;
    complexElements?: boolean;
    removeExtraSpaces?: boolean;
  }

  function html2docx(
    htmlString: string,
    headerHTMLString?: string,
    options?: ConversionOptions,
    footerHTMLString?: string
  ): Promise<Buffer>;

  export = html2docx;
}
