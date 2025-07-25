import mammoth from 'mammoth';
import pdfjsLib from 'pdfjs-dist';
import PptxParser from 'pptx-parser'; 
import parse from 'papaparse';

export async function parseUpload(file: File): Promise<string> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();

  switch (fileExtension) {
    case 'csv':
      return await parseCsv(file);
    case 'docx':
      return await parseDocx(file);
    case 'pdf':
      return await parsePdf(file);
    case 'pptx':
      return await parsePptx(file);
    default:
      throw new Error(`Unsupported file type: ${fileExtension}`);
  }
}

async function parseCsv(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    parse(file, {
      complete: (results) => {
        const text = results.data.map(row => Array.isArray(row) ? row.join(' ') : '').join('\n');
        resolve(text);
      },
      error: (error) => reject(error)
    });
  });
}

async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText(arrayBuffer);
  return result.value;
}

async function parsePdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let text = '';
  
    for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    text += pageText + '\n';
    }
  
    return text;
  }

async function parsePptx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const parser = new PptxParser();
  
  // Try passing ArrayBuffer directly first
  const result = await parser.parseFromBuffer(arrayBuffer as any);
  
  return result.slides.map(slide => slide.text).join('\n');
  }

export default {
  parse: parseUpload
}
