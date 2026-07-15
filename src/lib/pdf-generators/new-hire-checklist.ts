
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { drawText, drawCheckbox, drawCenteredText } from './utils';

const checklistItems = [
    { id: "driversLicense", label: "DRIVERS LICENSE" },
    { id: "dmvRecord", label: "DMV RECORD" },
    { id: "carInsurance", label: "CAR INSURANCE" },
    { id: "carRegistration", label: "CAR REGISTRATION" },
    { id: "ssnCard", label: "SOCIAL SECURITY CARD" },
    { id: "hcaClearance", label: "HCA CLEARANCE LETTER" },
    { id: "liveScanLetter", label: "LIVE SCAN LETTER" },
    { id: "tbTestResults", label: "TB TEST RESULTS" },
    { id: "vaccineRecord", label: "VACCINE SHOT RECORD" },
    { id: "physicalForm", label: "PHYSICAL FORM (HHA & CNA Required)" },
    { id: "cprFirstAid", label: "CPR/ First Aid" },
    { id: "other", label: "OTHER" },
] as const;

export async function generateNewHireChecklistPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.2);

        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;
        let y = height - 50;

        page.drawImage(logoImage, {
            x: leftMargin,
            y: y - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        y = drawCenteredText(page, "NEW CANDIDATE CHECKLIST", boldFont, 16, y - 20);
        y -= 20;

        drawText(page, `Candidate Name: ${formData.fullName || 'N/A'}`, { x: leftMargin, y, font: boldFont, size: 12 });
        y -= 30;

        // Table Header
        const col1X = leftMargin;
        const col2X = leftMargin + 250;
        const col3X = leftMargin + 350;

        page.drawRectangle({ x: col1X, y: y - 5, width: contentWidth, height: 20, color: rgb(0.9, 0.9, 0.9) });
        drawText(page, "Document", { x: col1X + 5, y, font: boldFont, size: 10 });
        drawText(page, "Received", { x: col2X, y, font: boldFont, size: 10 });
        drawText(page, "Comment", { x: col3X, y, font: boldFont, size: 10 });
        y -= 20;

        const rowHeight = 25;
        checklistItems.forEach(item => {
            const isReceived = !!formData[`${item.id}Received`];
            const comment = formData[`${item.id}Comment`] || "";

            drawText(page, item.label, { x: col1X + 5, y: y - (rowHeight / 2) + 4, font, size: 9 });
            drawCheckbox(page, isReceived, col2X + 20, y - (rowHeight / 2) + 4);
            
            if (comment) {
                page.drawText(comment, { x: col3X, y: y - (rowHeight / 2) + 4, font, size: 8, maxWidth: width - col3X - leftMargin });
            }

            page.drawLine({ start: { x: leftMargin, y: y - rowHeight + 5 }, end: { x: rightMargin, y: y - rowHeight + 5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
            y -= rowHeight;
        });

        // Vertical Lines for the table
        page.drawLine({ start: { x: col2X - 5, y: height - 120 }, end: { x: col2X - 5, y: y + 5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
        page.drawLine({ start: { x: col3X - 5, y: height - 120 }, end: { x: col3X - 5, y: y + 5 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });


        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating New Hire Checklist PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
