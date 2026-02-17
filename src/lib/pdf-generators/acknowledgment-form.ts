
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateAcknowledgmentFormPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
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

        y -= (logoDims.height + 30);

        const title = "ACKNOWLEDGMENT FORM";
        drawText(page, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, 14) / 2), y, font: boldFont, size: 14 });
        y -= 40;

        const content = [
            "This Employee Manual has been prepared for your understanding of the policies, practices, and benefits of FirstLight Home Care; it is important to read this entire Manual. We reserve the right to make changes at any time without notice and to interpret these policies and procedures at the discretion of FirstLight Home Care. This Employee Manual supersedes all prior manuals and previously issued policies.",
            "After you finish reading this Employee Manual, please sign, date, and return this Acknowledgement Form within seven (7) days of your receiving this Employee Manual to read.",
            "You agree to keep this Manual in your possession during your employment and to update it whenever new information is provided to you. You acknowledge that this Manual remains the property of FirstLight Home Care and must be returned immediately upon request, or upon the termination of your employment.",
            "By signing below, you acknowledge that you have read and understood the policies outlined in this Employee Manual. You agree to comply with the policies contained in this Manual and to read and understand any revisions to it and be bound by them. You understand this Manual is intended only as a general reference and is not intended to cover every situation that may arise during your employment. This Manual is not a full statement of company policy. Any questions regarding this Manual can be discussed with your supervisor, Care Coordinator or FirstLight Home Care management.",
            "You acknowledge that this Manual is not intended to create, nor shall be construed as creating, any express or implied contract of employment for a definite or specific period of time between you and FirstLight Home Care or to otherwise create express or implied legally enforceable contractual obligations on the part of FirstLight Home Care concerning any terms, conditions, or privileges of employment."
        ];

        content.forEach(p => {
            y = drawWrappedText(page, p, font, 10, leftMargin, y, contentWidth, 12);
            y -= 15;
        });

        y -= 50;
        
        drawText(page, formData.acknowledgmentEmployeeName, {x: leftMargin, y, font, size: 12});
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 500, y: y - 5 }, thickness: 0.5 });
        drawText(page, "Employee name (print legibly)", { x: leftMargin, y: y - 15, font, size: 8 });
        y -= 40;

        if (formData.acknowledgmentSignature) {
            await drawSignature(page, formData.acknowledgmentSignature, leftMargin, y, 200, 20, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 250, y: y - 5 }, thickness: 0.5 });
        drawText(page, "Employee signature", { x: leftMargin, y: y - 15, font, size: 8 });
        
        const sigDate = (formData.acknowledgmentSignatureDate && (formData.acknowledgmentSignatureDate.toDate || isDate(formData.acknowledgmentSignatureDate))) ? format(formData.acknowledgmentSignatureDate.toDate ? formData.acknowledgmentSignatureDate.toDate() : formData.acknowledgmentSignatureDate, "MM/dd/yyyy") : '';
        if(sigDate) drawText(page, sigDate, {x: leftMargin + 300, y, font, size: 12});
        page.drawLine({ start: { x: leftMargin + 280, y: y - 5 }, end: { x: leftMargin + 400, y: y - 5 }, thickness: 0.5 });
        drawText(page, "Date", { x: leftMargin + 280, y: y - 15, font, size: 8 });

        const footerText = "9650 Business Center Drive, Suite 132 | Rancho Cucamonga, CA 91730 | Phone 909-321-4466 | Fax http://ranchocucamonga.firstlighthomecare.com | License # 364700059 Fax 909-694-2474";
        drawText(page, footerText, { x: (width / 2) - (font.widthOfTextAtSize(footerText, 8) / 2), y: 40, font, size: 8 });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Acknowledgment Form PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
