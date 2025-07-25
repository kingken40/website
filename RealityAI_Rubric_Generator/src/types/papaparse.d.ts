declare module 'papaparse' {
  interface ParseConfig {
    delimiter?: string;
    newline?: string;
    quoteChar?: string;
    escapeChar?: string;
    header?: boolean;
    transformHeader?: (header: string) => string;
    dynamicTyping?: boolean;
    preview?: number;
    encoding?: string;
    worker?: boolean;
    comments?: boolean | string;
    step?: (results: ParseResult, parser: Parser) => void;
    complete?: (results: ParseResult) => void;
    error?: (error: ParseError) => void;
    download?: boolean;
    downloadRequestHeaders?: { [key: string]: string };
    skipEmptyLines?: boolean | 'greedy';
    chunk?: (results: ParseResult, parser: Parser) => void;
    fastMode?: boolean;
    beforeFirstChunk?: (chunk: string) => string;
    withCredentials?: boolean;
    transform?: (value: string, field: string | number) => any;
    delimitersToGuess?: string[];
  }

  interface ParseResult {
    data: any[];
    errors: ParseError[];
    meta: ParseMeta;
  }

  interface ParseError {
    type: string;
    code: string;
    message: string;
    row: number;
  }

  interface ParseMeta {
    delimiter: string;
    linebreak: string;
    aborted: boolean;
    truncated: boolean;
    cursor: number;
  }

  interface Parser {
    abort(): void;
    pause(): void;
    resume(): void;
  }

  function parse(input: string | File, config?: ParseConfig): ParseResult;
  export default parse;
}
