
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateCaregiverTelephonyInstructionsPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/TeleTrackLogo.png?alt=media&token=bb364313-385d-46da-9252-87074edda322";
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

        const title = "TeleTrack Telephony Instructions";
        drawText(page, title, { x: leftMargin + logoDims.width + 20, y: y - logoDims.height / 2, font: boldFont, size: 16 });
        y -= logoDims.height + 40;

        const instructions = [
            "- Step 1 From the Clients Telephone call the Clock In number. 866-425-8463",
            `- Step 2 Input your 4-digit TeleTrack ID Number ${formData.teletrackPin || '____'} (provided by your oﬃce)`,
            "- Step 3 Input your work status:",
            "  - Press 1, for arrival and then hang up",
            "  - Press 2, for departure and then go to Step 4",
            "- Step 4 Entering Activity Codes – Only prompted when departing. N/A To enter Activity Codes enter the 3-digit code associated with the task you completed and press #, the system will prompt you to enter your next Activity Code. When you have entered all Activity Codes for task completed during this visit press * then #. This will give you confirmation of a successful departure.",
            "Activity Codes (provided by your oﬃce)",
        ];

        instructions.forEach(line => {
            const indent = line.trim().startsWith('-') ? (line.trim().startsWith('  -') ? 20 : 10) : 0;
            y = drawWrappedText(page, line, font, 11, leftMargin + indent, y, width - leftMargin * 2 - indent, 13);
            y -= 5;
        });

        y -= 200; // Space for 15 blank lines

        drawText(page, `Employee’s Name: ${formData.fullName || ''}`, {x: leftMargin, y, font, size: 11});
        page.drawLine({ start: { x: leftMargin + 100, y: y - 2 }, end: { x: leftMargin + 400, y: y - 2 }, thickness: 0.5 });
        
        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Caregiver Telephony Instructions PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

    
