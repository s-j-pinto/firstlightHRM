

import { PDFDocument, rgb, PDFFont, PDFPage } from 'pdf-lib';

// Helper to sanitize text for pdf-lib
export function sanitizeText(text: string | null | undefined): string {
    if (!text) return '';
    // This regex removes most control characters that can cause issues with pdf-lib fonts
    // It keeps standard characters, newlines, and carriage returns.
    return text.replace(/[^\p{L}\p{N}\p{P}\p{Z}\r\n()]/gu, '');
}

// Standardized helper to draw text using an options object
export function drawText(page: PDFPage, text: string | undefined, options: { x: number; y: number; font: PDFFont; size: number; color?: any; lineHeight?: number }) {
    if (!text) return;
    
    const sanitized = sanitizeText(text);
    const lines = sanitized.split('\n');
    let currentY = options.y;
    const lineHeight = options.lineHeight || options.size * 1.2;

    for (const line of lines) {
        page.drawText(line, {
            ...options,
            y: currentY,
        });
        currentY -= lineHeight;
    }
}

// Helper to draw a checkbox
export function drawCheckbox(page: PDFPage, checked: boolean | undefined, x: number, y: number) {
    if (checked) {
        page.drawLine({
            start: { x: x + 2, y: y + 5 },
            end: { x: x + 5, y: y + 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
        page.drawLine({
            start: { x: x + 5, y: y + 2 },
            end: { x: x + 8, y: y + 8 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
    }
    page.drawRectangle({
        x: x,
        y: y,
        width: 10,
        height: 10,
        borderWidth: 0.5,
        borderColor: rgb(0, 0, 0),
    });
}

export async function drawSignature(page: PDFPage, dataUrl: string | undefined, x: number, y: number, width: number, height: number, pdfDoc: PDFDocument) {
    if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
        try {
            const pngImage = await pdfDoc.embedPng(dataUrl);
            page.drawImage(pngImage, { x, y, width, height });
        } catch (e) {
            console.error("Failed to embed signature:", e);
        }
    }
}

export function drawWrappedText(page: PDFPage, text: string | undefined, font: PDFFont, fontSize: number, x: number, y: number, maxWidth: number, lineHeight: number): number {
    if (!text) return y;
    text = sanitizeText(text);
    
    let currentY = y;
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
            currentY -= lineHeight;
            continue;
        }

        const words = paragraph.split(' ');
        let line = '';

        for (const word of words) {
            const testLine = line + word + ' ';
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);
            if (testWidth > maxWidth && line.length > 0) {
                drawText(page, line.trim(), { x: x, y: currentY, font, size: fontSize, color: rgb(0,0,0) });
                line = word + ' ';
                currentY -= lineHeight;
            } else {
                line = testLine;
            }
        }
        if (line.trim().length > 0) {
            drawText(page, line.trim(), { x: x, y: currentY, font, size: fontSize, color: rgb(0,0,0) });
            currentY -= lineHeight;
        }
    }
    
    return currentY; 
}
