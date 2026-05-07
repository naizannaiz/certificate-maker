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

    const getActualValue = (fieldName, user) => {
      const norm = fieldName.toLowerCase().replace(/\s+/g, '_');
      if (norm === 'name') return user.name || '';
      if (norm === 'certificate_id' || norm === 'certificate id')
        return user.certificate_id || '';
      if (norm === 'date') {
        // Auto date: format as "April 23, 2026"
        return new Date().toLocaleDateString('en-US', {
          day: 'numeric', month: 'long', year: 'numeric'
        });
      }
      if (user.extra_data && user.extra_data[fieldName] !== undefined)
        return String(user.extra_data[fieldName] || '');
      if (user.extra_data) {
        const key = Object.keys(user.extra_data).find(
          k => k.toLowerCase() === norm || k.toLowerCase().replace(/\s+/g, '_') === norm
        );
        return key ? String(user.extra_data[key] || '') : `[${fieldName}]`;
      }
      return `[${fieldName}]`;
    };

    for (const field of fields) {

      // ── Helpers ─────────────────────────────────────────────────────────────

      /** Sanitize special Unicode characters that pdf-lib can't encode */
      const sanitize = (text) => (text || '')
        .replace(/\r/g, '')                          // Strip Windows carriage returns (0x000d) — WinAnsi cannot encode them
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u00A0\u202F\u2007\uFEFF]/g, ' ')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\u2026/g, '...');

      /** Resolve {{FieldName}} placeholders */
      const resolvePlaceholders = (text) => {
        return (text || '').replace(/{{([^{}]+)}}/g, (_, name) =>
          sanitize(getActualValue(name.trim(), user))
        );
      };

      /** Pick the right font from fontSet based on bold/italic flags */
      const pickFont = (fontSet, bold, italic) => {
        if (bold && italic) return fontSet.boldItalic;
        if (bold) return fontSet.bold;
        if (italic) return fontSet.italic;
        return fontSet.normal;
      };

      /**
       * Parse an HTML string into a flat array of segments:
       * [{ text, isBold, isItalic, isUnderline, color, fontFamily }]
       * Inherits base style from field-level settings.
       */
      const parseHTMLToSegments = (html, base) => {
        const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
        const segments = [];

        const walk = (node, style) => {
          if (node.nodeType === 3) {
            // Text node
            const text = resolvePlaceholders(sanitize(node.textContent));
            if (text) segments.push({ text, ...style });
            return;
          }
          if (node.nodeType !== 1) return;

          const tag = node.tagName.toLowerCase();
          const s = { ...style };

          if (tag === 'b' || tag === 'strong') s.isBold = true;
          if (tag === 'i' || tag === 'em') s.isItalic = true;
          if (tag === 'u') s.isUnderline = true;

          // Inline style overrides
          if (node.style) {
            if (node.style.fontWeight === 'bold') s.isBold = true;
            if (node.style.fontStyle === 'italic') s.isItalic = true;
            if (node.style.textDecoration?.includes('underline')) s.isUnderline = true;
            if (node.style.color) s.color = node.style.color;
          }
          if (tag === 'font' && node.getAttribute('color')) s.color = node.getAttribute('color');

          if (tag === 'br') {
            segments.push({ text: '\n', ...s });
            return;
          }

          node.childNodes.forEach(child => walk(child, s));

          // Block elements add a newline after
          if (['div', 'p', 'li', 'h1', 'h2', 'h3', 'h4'].includes(tag)) {
            segments.push({ text: '\n', ...s });
          }
        };

        walk(doc.body, base);

        // Trim leading/trailing newline segments
        while (segments.length && segments[0].text === '\n') segments.shift();
        while (segments.length && segments[segments.length - 1].text === '\n') segments.pop();

        return segments;
      };

      /**
       * Word-wrap segments into lines.
       * Each line = array of {text, font, color, isUnderline}
       */
      const wrapSegments = (segments, maxWidth, fontSet, baseFontSize) => {
        // Tokenise: split segments on spaces/newlines into individual tokens
        const tokens = [];
        for (const seg of segments) {
          const font = pickFont(fontSet, seg.isBold, seg.isItalic);
          const parts = seg.text.split(/(\n| )/);
          for (const part of parts) {
            if (part === '') continue;
            tokens.push({ text: part, font, color: seg.color, isUnderline: seg.isUnderline, isNewline: part === '\n' });
          }
        }

        const lines = [[]]; // Array of lines; each line = array of tokens
        let lineWidth = 0;

        for (const token of tokens) {
          if (token.isNewline) {
            lines.push([]);
            lineWidth = 0;
            continue;
          }
          const w = token.font.widthOfTextAtSize(token.text, baseFontSize);
          if (token.text === ' ') {
            // Only add space if line not empty
            if (lines[lines.length - 1].length > 0) {
              lines[lines.length - 1].push({ ...token, width: w });
              lineWidth += w;
            }
          } else if (lineWidth + w > maxWidth && lines[lines.length - 1].length > 0) {
            // Wrap: start new line
            lines.push([{ ...token, width: w }]);
            lineWidth = w;
          } else {
            lines[lines.length - 1].push({ ...token, width: w });
            lineWidth += w;
          }
        }

        // Remove trailing empty lines
        while (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();

        return lines;
      };

      // ── Field rendering ───────────────────────────────────────────────────

      const scaledX      = (field.x      || 0)   * scaleRatio;
      const scaledYTop   = (field.y      || 0)   * scaleRatio;
      const scaledWidth  = Math.max(50, (field.width  || 200) * scaleRatio);
      const scaledHeight = Math.max(20, (field.height ||  50) * scaleRatio);

      const fontFamily = field.fontFamily || 'Helvetica';
      const fontSet    = fonts[fontFamily] || fonts['Helvetica'];
      const baseColor  = hexToRgb(field.color || '#000000');

      // Build base style from field-level settings
      const baseStyle = {
        isBold:      field.isBold      || false,
        isItalic:    field.isItalic    || false,
        isUnderline: field.isUnderline || false,
        color:       field.color       || '#000000',
      };

      // Get HTML content
      let rawHTML = '';
      if (field.type === 'textBlock' || field.name === 'Custom Text') {
        rawHTML = field.text || '';
      } else {
        // Dynamic name fields: just resolve the placeholder
        rawHTML = resolvePlaceholders(`{{${field.name}}}`);
      }

      if (!rawHTML.trim()) continue;

      // Parse segments (handles both plain text and HTML)
      const segments = rawHTML.includes('<')
        ? parseHTMLToSegments(rawHTML, baseStyle)
        : [{ text: resolvePlaceholders(sanitize(rawHTML)), ...baseStyle }];

      if (segments.length === 0 || segments.every(s => !s.text.trim())) continue;

      // Auto-shrink: find the largest fontSize that fits the box
      let fontSize = (field.fontSize || 12) * scaleRatio;
      let wrappedLines;
      const lineHeightMult = field.lineHeight || 1.4;

      while (fontSize > 4) {
        wrappedLines = wrapSegments(segments, scaledWidth, fontSet, fontSize);
        const totalH = wrappedLines.length * lineHeightMult * fontSize;
        if (totalH <= scaledHeight) break;
        fontSize -= 0.5;
      }
      if (!wrappedLines) wrappedLines = wrapSegments(segments, scaledWidth, fontSet, fontSize);

      const lineHeight  = lineHeightMult * fontSize;
      const totalTextH  = wrappedLines.length * lineHeight;
      const boxTop      = pdfHeight - scaledYTop;
      const boxBottom   = boxTop - scaledHeight;

      // Vertically centre text inside the box
      let currentY = boxTop - (scaledHeight - totalTextH) / 2 - fontSize;

      for (let i = 0; i < wrappedLines.length; i++) {
        const line = wrappedLines[i];
        if (currentY < boxBottom - fontSize) break;

        // Measure full line width for alignment
        const lineW = line.reduce((sum, t) => sum + t.width, 0);
        let x = scaledX;
        let wordSpacing = 0;

        if (field.textAlign === 'center') {
          x = scaledX + (scaledWidth - lineW) / 2;
        } else if (field.textAlign === 'right') {
          x = scaledX + scaledWidth - lineW;
        } else if (field.textAlign === 'justify' && i < wrappedLines.length - 1) {
          // Count spaces in the line
          const spaceCount = line.filter(t => t.text === ' ').length;
          if (spaceCount > 0) {
            wordSpacing = (scaledWidth - lineW) / spaceCount;
          }
        }

        // Draw each token in the line
        for (const token of line) {
          if (!token.text.trim() && token.text !== ' ') { x += token.width; continue; }

          const segColor = token.color ? (() => {
            try { return hexToRgb(token.color); } catch { return baseColor; }
          })() : baseColor;

          firstPage.drawText(token.text, {
            x, y: currentY,
            size: fontSize,
            font: token.font,
            color: segColor,
          });

          if (token.isUnderline) {
            firstPage.drawLine({
              start: { x, y: currentY - fontSize * 0.12 },
              end:   { x: x + token.width, y: currentY - fontSize * 0.12 },
              thickness: Math.max(0.5, fontSize * 0.05),
              color: segColor,
            });
          }

          x += token.width;
          if (token.text === ' ' && wordSpacing > 0) {
            x += wordSpacing;
          }
        }

        currentY -= lineHeight;
      }
    }

    // 6. Serialize to bytes and return as blob URL
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
}

