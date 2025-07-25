declare module 'mammoth' {
  interface ConvertToHtmlOptions {
    styleMap?: string[];
    includeEmbeddedStyleMap?: boolean;
    includeDefaultStyleMap?: boolean;
    convertImage?: (image: any) => any;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
    transformDocument?: (document: any) => any;
  }

  interface ConvertToMarkdownOptions {
    styleMap?: string[];
    includeEmbeddedStyleMap?: boolean;
    includeDefaultStyleMap?: boolean;
    ignoreEmptyParagraphs?: boolean;
    idPrefix?: string;
    transformDocument?: (document: any) => any;
  }

  interface Result {
    value: string;
    messages: any[];
  }

  export function convertToHtml(input: ArrayBuffer | Buffer, options?: ConvertToHtmlOptions): Promise<Result>;
  export function convertToMarkdown(input: ArrayBuffer | Buffer, options?: ConvertToMarkdownOptions): Promise<Result>;
  export function extractRawText(input: ArrayBuffer | Buffer): Promise<Result>;
}