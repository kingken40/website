import { load } from 'cheerio';

export async function fetchUrlText(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const html = await response.text();

    // simple extraction
    const $ = load(html);
    if (url.includes('youtube.com')) {
      return $('title').text(); // or use YouTube API
    }
    
    // Extract text content, removing scripts and styles
    $('script, style').remove();
    
    return $('body').text().trim() || $.text().trim();
  } catch (error) {
    console.error('Error fetching URL text:', error);
    throw new Error(`Failed to fetch text from URL: ${url}`);
  }
}