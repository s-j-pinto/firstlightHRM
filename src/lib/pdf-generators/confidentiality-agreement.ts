
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateConfidentialityAgreementPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
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

        y -= (logoDims.height + 20);

        const title = "CONFIDENTIALITY AGREEMENT";
        drawText(page, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, 14) / 2), y, font: boldFont, size: 14 });
        y -= 30;

        const content = [
            "The FirstLight HomeCare clients place their trust in you. Caring for someone in their home or accompanying them to their doctor’s appointments may provide you with personal information which must remain confidential. Sharing general observations and insights are permissible; as long as the individual’s personal life and physical condition are never exposed.",
            "You as FirstLight HomeCare employees do have the responsibility to alert and discuss with your Care Coordinator any situation that endangers the health, safety or welfare of an individual.",
            "The following are the conditions of this agreement:",
            "1. Confidential information on a client includes:\n   • The referral and assessment forms and all information contained on it, any Supplemental records used to update a care receiver’s services, and any Computer records maintained on the care receiver.\n   • Any information received verbally from the client.\n   • Any information on the client’s financial, family, medical or social Situations.",
            "2. Any documents and information relating to a client must be carefully Safeguarded and released only to authorized persons.",
            "3. Caregivers are encouraged to use first names only when discussing situations Involving care receivers.",
            "4. Caregivers are not to discuss confidential information concerning clients in Circumstances where an unauthorized person may over hear the conversation.",
            "5. All caregivers share the responsibility of adhering to and enforcing the Confidentiality policy.",
            "6. Confidentiality and HIPAA policies will be followed by caregivers at all times.",
            "I agree to the above statements and will adhere to all FirstLight HomeCare confidentiality and HIPAA policies and procedures."
        ];

        content.forEach(p => {
            const isListItem = /^\d\./.test(p);
            const indent = isListItem ? 20 : 0;
            
            y = drawWrappedText(page, p, font, 10, leftMargin + indent, y, contentWidth - indent, 12);
            y -= 15;
        });

        y -= 40;

        // Signatures
        const employeeSigDate = (formData.confidentialityAgreementEmployeeSignatureDate && (formData.confidentialityAgreementEmployeeSignatureDate.toDate || isDate(formData.confidentialityAgreementEmployeeSignatureDate))) ? format(formData.confidentialityAgreementEmployeeSignatureDate.toDate ? formData.confidentialityAgreementEmployeeSignatureDate.toDate() : formData.confidentialityAgreementEmployeeSignatureDate, "MM/dd/yyyy") : '';
        if (formData.confidentialityAgreementEmployeeSignature) {
            await drawSignature(page, formData.confidentialityAgreementEmployeeSignature, leftMargin, y, 250, 25, pdfDoc);
        }
        drawText(page, employeeSigDate, {x: leftMargin + 300, y: y+5, font, size: 10});
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 500, y: y - 5 }, thickness: 0.5 });
        drawText(page, "FirstLight HomeCare employee signature                                                                 Date", {x: leftMargin, y: y-15, font, size: 8});
        y-=40;
        
        const repSigDate = (formData.confidentialityAgreementRepDate && (formData.confidentialityAgreementRepDate.toDate || isDate(formData.confidentialityAgreementRepDate))) ? format(formData.confidentialityAgreementRepDate.toDate ? formData.confidentialityAgreementRepDate.toDate() : formData.confidentialityAgreementRepDate, "MM/dd/yyyy") : '';
        if (formData.confidentialityAgreementRepSignature) {
            await drawSignature(page, formData.confidentialityAgreementRepSignature, leftMargin, y, 250, 25, pdfDoc);
        }
        drawText(page, repSigDate, {x: leftMargin + 300, y: y+5, font, size: 10});
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 500, y: y - 5 }, thickness: 0.5 });
        drawText(page, "FirstLight HomeCare representative signature                                                         Date", {x: leftMargin, y: y-15, font, size: 8});


        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Confidentiality Agreement PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
