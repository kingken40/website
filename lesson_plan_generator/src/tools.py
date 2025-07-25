import PyPDF2
import csv
from googletrans import Translator

def parse_pdf(file_path: str) -> str:
    """
    Parse a PDF file and extract its text content.
    
    Args:
        file_path (str): Path to the PDF file.
    
    Returns:
        str: Extracted text from the PDF.
    """
    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfFileReader(file)
            text = ""
            for page in range(reader.numPages):
                text += reader.getPage(page).extractText()
        return text
    except Exception as e:
        logging.error(f"Error parsing PDF: {str(e)}")
        return ""

def parse_csv(file_path: str) -> str:
    """
    Parse a CSV file and extract its content as a string.
    
    Args:
        file_path (str): Path to the CSV file.
    
    Returns:
        str: Extracted content from the CSV.
    """
    try:
        with open(file_path, 'r') as file:
            reader = csv.reader(file)
            return "\n".join([", ".join(row) for row in reader])
    except Exception as e:
        logging.error(f"Error parsing CSV: {str(e)}")
        return ""

def translate_text(text: str, target_language: str) -> str:
    """
    Translate the given text to the target language.
    
    Args:
        text (str): Text to translate.
        target_language (str): Target language code (e.g., 'es' for Spanish).
    
    Returns:
        str: Translated text.
    """
    try:
        translator = Translator()
        translated = translator.translate(text, dest=target_language)
        return translated.text
    except Exception as e:
        logging.error(f"Error translating text: {str(e)}")
        return text