
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText, drawCheckbox } from './utils';

export async function generateTrainingAcknowledgementPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.3);

        const leftMargin = 50;
        const contentWidth = width - (leftMargin * 2);
        let y = height - 60;

        page.drawImage(logoImage, {
            x: leftMargin,
            y: y - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        y -= (logoDims.height + 40);

        const p1 = "I acknowledge that I have received the following training on online or video/PowerPoint format.";
        y = drawWrappedText(page, p1, font, 12, leftMargin, y, contentWidth, 14);
        y -= 20;

        const p2 = "I acknowledge that training is paid only on completion of ALL the training that is assigned to me and completed in a timely manner.";
        y = drawWrappedText(page, p2, font, 12, leftMargin, y, contentWidth, 14);
        y -= 30;

        const trainingItems = [
            "Personal Care",
            "HIPAA",
            "Infection Control",
            "Elder Abuse and Neglect",
            "Emergency Procedures",
            "FirstLight Home Care policies",
            "Body mechanics",
            "Sexual Harassment",
            "Mandatory reporting"
        ];
        
        trainingItems.forEach(item => {
            const checkboxY = y + 1;
            drawCheckbox(page, true, leftMargin + 20, checkboxY);
            drawText(page, item, { font, size: 12, x: leftMargin + 40, y: checkboxY + 2, color: rgb(0, 0, 0) });
            y -= 20; // Adjust spacing
        });

        y -= 60;

        // Signature section
        const empName = formData.trainingAcknowledgementEmployeeName || '';
        drawText(page, empName, { x: leftMargin, y: y, font: font, size: 12});
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 300, y: y - 5 }, thickness: 0.5 });
        drawText(page, "Employee Name", { x: leftMargin, y: y - 15, font, size: 8 });

        const sigDate = (formData.trainingAcknowledgementSignatureDate && (formData.trainingAcknowledgementSignatureDate.toDate || isDate(formData.trainingAcknowledgementSignatureDate))) ? format(formData.trainingAcknowledgementSignatureDate.toDate ? formData.trainingAcknowledgementSignatureDate.toDate() : formData.trainingAcknowledgementSignatureDate, "MM/dd/yyyy") : '';
        if (sigDate) {
            drawText(page, sigDate, { x: leftMargin + 350, y: y, font: font, size: 12 });
        }
        page.drawLine({ start: { x: leftMargin + 350, y: y - 5 }, end: { x: leftMargin + 500, y: y - 5 }, thickness: 0.5 });
        drawText(page, "Date", { x: leftMargin + 350, y: y - 15, font, size: 8 });
        
        y -= 40;

        if (formData.trainingAcknowledgementSignature) {
            await drawSignature(page, formData.trainingAcknowledgementSignature, leftMargin, y, 250, 25, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 300, y: y - 5 }, thickness: 0.5 });
        drawText(page, "Employee Signature", { x: leftMargin, y: y - 15, font, size: 8 });

        // Footer Section
        const footerTextY = 50;
        const logoFooterY = footerTextY + 30; // Positioned above the footer text

        const extraordinaryPeopleLogoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/ExtraordinaryPeoplelogo.png?alt=media&token=43373a12-f6b5-4460-94a2-7bb8a5ff71b6";
        const extraordinaryPeopleLogoBytes = await fetch(extraordinaryPeopleLogoUrl).then(res => res.arrayBuffer());
        const extraordinaryPeopleLogoImage = await pdfDoc.embedPng(extraordinaryPeopleLogoBytes);
        const extraordinaryPeopleLogoDims = extraordinaryPeopleLogoImage.scale(0.45); // Tripled size from 0.15

        page.drawImage(extraordinaryPeopleLogoImage, {
            x: leftMargin,
            y: logoFooterY, 
            width: extraordinaryPeopleLogoDims.width,
            height: extraordinaryPeopleLogoDims.height,
        });

        const footerText = "9650 Business Center Dr. Suite 132, Rancho Cucmaonga, CA 91730\nPhone: 909-321-4466 Fax: 909-694-2474";
        const footerWidth = font.widthOfTextAtSize("9650 Business Center Dr. Suite 132, Rancho Cucmaonga, CA 91730", 8);
        drawText(page, footerText, { x: (width / 2) - (footerWidth / 2), y: footerTextY, font, size: 8, lineHeight: 10 });
        
        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Training Acknowledgement PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
