import { load } from 'cheerio';

export async function fetchUrlText(url: string): Promise<string> {
  // naïve: proxy needed for CORS in the browser
  const res = await fetch(`https://rubic-proxy.example.com?url=${encodeURIComponent(url)}`);
  const html = await res.text();
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
 // return $('body').text().replace(/\s+/g, ' ').trim();
}