import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Helper to convert hex color (#FF0000) to rgb(1, 0, 0) for pdf-lib
 */
function hexToRgb(hex) {
  // Remove '#' if present
  hex = hex.replace(/^#/, '');
  
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }

  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;

  return rgb(r / 255, g / 255, b / 255);
}

/**
 * Generates a filled PDF based on the user data and template config
 * 
 * @param {Object} user - The user object from Supabase (e.g., { name, course, certificate_id, ... })
 * @param {Object} template - The template object from Supabase (e.g., { background_url, config: { fields: [] } })
 * @returns {Promise<string>} - A Blob URL to the generated PDF
 */
export async function generateFilledPDF(user, template) {
  if (!template || !template.background_url) {
    throw new Error('Invalid template data');
  }

  try {
    // 1. Fetch the existing PDF (the background template)
    const existingPdfBytes = await fetch(template.background_url).then(res => res.arrayBuffer());

    // 2. Load it into pdf-lib
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // 3. Embed standard fonts for various styles
    const fonts = {
      'Helvetica': {
        normal: await pdfDoc.embedFont(StandardFonts.Helvetica),
        bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
        boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
      },
      'Times Roman': {
        normal: await pdfDoc.embedFont(StandardFonts.TimesRoman),
        bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
        italic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
        boldItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
      },
      'Courier': {
        normal: await pdfDoc.embedFont(StandardFonts.Courier),
        bold: await pdfDoc.embedFont(StandardFonts.CourierBold),
        italic: await pdfDoc.embedFont(StandardFonts.CourierOblique),
        boldItalic: await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
      }
    };

    // 4. Get the first page
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Get the actual PDF page dimensions
    const { width: pdfWidth, height: pdfHeight } = firstPage.getSize();

    // The dimensions of the canvas used in the TemplateBuilder editor
    // This MUST match the hardcoded 800px width in TemplateBuilder.jsx
    const editorWidth = 800;
    
    // Calculate the scale ratio between the editor and the actual PDF
    const scaleRatio = pdfWidth / editorWidth;

    // 5. Draw the text fields
    const fields = template.config?.fields || [];

    for (const field of fields) {
      // Build a lookup from field name to user value
      // 1. Check hardcoded system fields (name, certificate_id, date)
      // 2. Check extra_data for any custom columns from the Excel (Course, Professor, etc.)
      const fieldNameLower = field.name.toLowerCase().replace(/\s+/g, '_');
      
      let textToDraw = '';
      if (fieldNameLower === 'name') {
        textToDraw = user.name || '';
      } else if (fieldNameLower === 'certificate_id') {
        textToDraw = user.certificate_id || '';
      } else if (fieldNameLower === 'date') {
        textToDraw = new Date().toLocaleDateString();
      } else if (user.extra_data && user.extra_data[field.name] !== undefined) {
        // Look up by the exact column name stored in extra_data
        textToDraw = String(user.extra_data[field.name] || '');
      } else {
        // Fallback: try case-insensitive search in extra_data
        if (user.extra_data) {
          const key = Object.keys(user.extra_data).find(k => k.toLowerCase() === fieldNameLower);
          textToDraw = key ? String(user.extra_data[key] || '') : `[${field.name}]`;
        } else {
          textToDraw = `[${field.name}]`;
        }
      }

      // Select the correct font and style
      const family = field.fontFamily || 'Helvetica';
      const fontSet = fonts[family] || fonts['Helvetica'];
      let fontToUse = fontSet.normal;
      
      if (field.isBold && field.isItalic) fontToUse = fontSet.boldItalic;
      else if (field.isBold) fontToUse = fontSet.bold;
      else if (field.isItalic) fontToUse = fontSet.italic;

      const scaledX = field.x * scaleRatio;
      const scaledYFromTop = field.y * scaleRatio;
      const scaledWidth = field.width * scaleRatio;
      const scaledHeight = field.height * scaleRatio;
      const originalScaledFontSize = field.fontSize * scaleRatio;
      
      // AUTO-SHRINK: If the text is wider than the bounding box, shrink the font size
      let currentFontSize = originalScaledFontSize;
      let textWidth = fontToUse.widthOfTextAtSize(textToDraw, currentFontSize);
      
      while (textWidth > scaledWidth && currentFontSize > 6) {
        currentFontSize -= 0.5;
        textWidth = fontToUse.widthOfTextAtSize(textToDraw, currentFontSize);
      }

      // Calculate precise X based on text alignment
      let pdfX = scaledX; // Default to left align
      
      if (field.textAlign === 'center') {
        pdfX = scaledX + (scaledWidth / 2) - (textWidth / 2);
      } else if (field.textAlign === 'right') {
        pdfX = scaledX + scaledWidth - textWidth;
      }
      
      // Calculate precise Y based on vertical centering
      // Box center from bottom = pdfHeight - scaledYFromTop - (scaledHeight / 2)
      const boxCenterY = pdfHeight - scaledYFromTop - (scaledHeight / 2);
      const pdfY = boxCenterY - (currentFontSize * 0.35);

      const pdfColor = hexToRgb(field.color || '#000000');

      firstPage.drawText(textToDraw, {
        x: pdfX,
        y: pdfY,
        size: currentFontSize,
        font: fontToUse,
        color: pdfColor,
      });

      // Draw underline if requested
      if (field.isUnderline) {
        const underlineThickness = Math.max(1, currentFontSize * 0.08);
        const underlineY = pdfY - (currentFontSize * 0.15); // slightly below baseline
        
        firstPage.drawLine({
          start: { x: pdfX, y: underlineY },
          end: { x: pdfX + textWidth, y: underlineY },
          thickness: underlineThickness,
          color: pdfColor,
        });
      }
    }

    // 6. Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();

    // 7. Create a Blob and return the URL
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(blob);
    
    return blobUrl;

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}
