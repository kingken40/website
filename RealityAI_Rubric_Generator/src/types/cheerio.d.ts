declare module 'cheerio' {
  interface CheerioAPI {
    (selector: string): any;
    html(): string;
    text(): string;
  }

  export function load(html: string): CheerioAPI;
}