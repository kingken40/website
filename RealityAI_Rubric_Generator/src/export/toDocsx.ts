import htmlDocx from "html-docx-js/dist/html-docx";

// The toDocx function converts a given HTMLElement to a DOCX file
// and returns an object URL for the Blob.
export async function toDocx(rubricTable: HTMLElement): Promise<string> {
  // Build a complete HTML document string including basic style rules.
  const htmlContent = `
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          table, th, td { border: 1px solid black; padding: 5px; }
          th { background-color: #4c51bf; color: white; }
        </style>
      </head>
      <body>
        ${rubricTable.outerHTML}
      </body>
    </html>
  `;
  // Use the html-docx-js library to convert the HTML to a Blob.
  const blob = htmlDocx.asBlob(htmlContent);
  
  // Create a URL for the generated blob.
  return URL.createObjectURL(blob);
}