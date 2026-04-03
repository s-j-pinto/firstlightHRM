
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { drawText, drawWrappedText } from './utils';

export async function generateLightHousekeepingPdf(): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.25);

        let y = height - 60;
        const leftMargin = 60;
        
        page.drawImage(logoImage, {
            x: leftMargin,
            y: y - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        y -= (logoDims.height + 30);

        drawText(page, "Light housekeeping", { x: leftMargin, y, font: boldFont, size: 18 });
        y -= 25;
        drawText(page, "Done only for our client", { x: leftMargin, y, font, size: 14 });
        y -= 30;

        const housekeepingTasks = [
            "- Laundry (machine washing, drying, folding, putting back into drawers, hanging up). Done only for the client",
            "- Changing bed linens",
            "- Dishes will also be cleaned and put away",
            "- Wipe down of kitchen counters",
            "- Wiping down bathroom countertops, sinks, and shower/tub after bathing",
            "- Maintenance-level cleaning of the toilet in the client’s bathroom",
            "- Dusting of the surfaces of the client’s living area.",
            "- Vacuuming and sweeping of the client’s general living space and walkways",
            "- Gathering trash and taking trash to the collection spot at the end of the shift"
        ];
        
        housekeepingTasks.forEach(task => {
            y = drawWrappedText(page, task, font, 12, leftMargin, y, width - (leftMargin * 2), 16);
            y -= 10;
        });

        // Footer
        const footerText = "First Light Home Care 9650 Business Center Dr. Ste 113 Rancho Cucamonga, CA 91730 909-321-4466";
        const footerTextWidth = font.widthOfTextAtSize(footerText, 8);
        drawText(page, footerText, {
            x: (width / 2) - (footerTextWidth / 2),
            y: 40,
            font: font,
            size: 8,
            color: rgb(0.5, 0.5, 0.5),
        });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Light Housekeeping PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
    
