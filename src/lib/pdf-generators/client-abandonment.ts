
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateClientAbandonmentPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/Client-Abandonment.png?alt=media&token=a042a308-64f1-4a14-9561-dfab31424353";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.2); 

        // --- Page 1 ---
        const page1 = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page1.getSize();
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;
        const lineHeight = 11;
        const mainFontSize = 9;
        const titleFontSize = 14;

        let y = height - 60;

        page1.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: y - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });
        
        y -= (logoDims.height + 20);

        const title = "Client Abandonment";
        drawText(page1, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, titleFontSize) / 2), y, font: boldFont, size: titleFontSize, color: rgb(0, 0, 0.8) });

        y -= 40;
        
        const textContentPage1 = [
            "Client abandonment is defined as the premature termination of the professional treatment relationship by the health care provider, such as you, without adequate notice or the client's consent. This is a form of negligence with the unilateral termination of the provider-client relationship, despite the client's continued need for care.",
            "Client abandonment occurs after you as a caregiver has accepted responsibility for an assignment within the scheduled work shift. It may also occur if you as a caregiver fail to give reasonable notice to an employer of the intent to terminate the employer-employee relationship or contract leading to serious impairment in the delivery of professional caregiving to clients.",
            "The Caregiver-Client Relationship",
            "The caregiver-client relationship begins when the caregiver accepts responsibility for providing care based upon a written or oral report of the client needs. It ends when that responsibility has been transferred to another caregiver along with communication detailing the client's needs.",
            "Once a caregiving assignment has been accepted, it is the duty of the caregiver to fulfill the client care assignment or transfer responsibility for that care to another qualified person.",
            "Caregiver's Duty and Accountability",
            "As mandatory reporters, caregivers have an additional duty to immediately report any unsafe client care to the Care Coordinator. This duty includes identifying and reporting staffing problems, protecting the health, safety and rights of the clients, preserving the caregiver's own integrity and safety, refusing a client care assignment based on concerns for client safety, and practicing with reasonable skill and safety.",
            "A Healthcare Code of Ethics directs all caregivers to protect the health, safety, and rights of the client, to assume responsibility and it is the caregivers' obligation to provide optimum client care, and to establish, maintain, and improve health care environments and conditions of employment."
        ];
        
        for (const item of textContentPage1) {
            const isHeader = ["The Caregiver-Client Relationship", "Caregiver's Duty and Accountability"].includes(item);
            const fontToUse = isHeader ? boldFont : font;
            const size = isHeader ? 11 : mainFontSize;
            if (isHeader) y -= 10;
            y = drawWrappedText(page1, item, fontToUse, size, leftMargin, y, contentWidth, isHeader ? 14 : lineHeight);
            y -= 10;
        }

        // --- Page 2 ---
        const page2 = pdfDoc.addPage(PageSizes.Letter);
        y = height - 70;

        const textContentPage2 = [
            "Liabilities of Abandonment",
            "In medical and therefore caregiver malpractice, four elements must be proven to demonstrate malpractice:",
            "1. Duty exists when a relationship is created to provide care to the client. (FLHC has a Client Contract and you as an employed caregiver have a contract of duty with accepting an assignment.)",
            "2. Breach of duty occurs when there is a deviation from the normal standard of care. (The FLHC Policies and Plan of Care along with your orientation and training establish this standard of care.)",
            "3. Damages occur when harm is done, requiring an increased length of stay or an increased level of care. (If the FLHC client was left alone and something occurred causing an additional injury or illness.)",
            "4. Causation is proven when the results are directly attributable to an action or omission of care. (This is where it is proven the result of abandonment created the situation for additional injury or illness.)",
            "FirstLight HomeCare provides care to vulnerable adults and therefore our policy and procedure includes the direct notification of the Care Coordinator verbally if a situation occurs where the caregiver needs to leave prior to the end of a shift or is unable to report to duty. The expectation is the caregiver remains with any client until another caregiver is present and able to provide care to the client."
        ];
        
        for (const item of textContentPage2) {
            const isHeader = item === "Liabilities of Abandonment";
            const fontToUse = isHeader ? boldFont : font;
            const size = isHeader ? 11 : mainFontSize;
            const indent = item.startsWith("1.") || item.startsWith("2.") || item.startsWith("3.") || item.startsWith("4.") ? 20 : 0;
            if (isHeader) y -= 10;
            y = drawWrappedText(page2, item, fontToUse, size, leftMargin + indent, y, contentWidth - indent, isHeader ? 14 : lineHeight);
            y -= 10;
        }
        
        y -= 20;

        const finalStatement = "I have read and understand the following information on Client Abandonment. I understand abandonment and will never leave a client without care for any reason.";
        y = drawWrappedText(page2, finalStatement, boldFont, 10, leftMargin, y, contentWidth, 14);
        y -= 40;

        // Signature section
        const signatureY = y;
        
        // Signature
        if (formData.clientAbandonmentSignature) {
            await drawSignature(page2, formData.clientAbandonmentSignature, leftMargin, signatureY - 10, 250, 25, pdfDoc);
        }
        page2.drawLine({ start: { x: leftMargin, y: signatureY - 15 }, end: { x: leftMargin + 250, y: signatureY - 15 }, thickness: 0.5 });
        drawText(page2, "Signature", { x: leftMargin, y: signatureY - 25, font, size: 8 });

        // Witness Signature
        if (formData.clientAbandonmentWitnessSignature) {
            await drawSignature(page2, formData.clientAbandonmentWitnessSignature, leftMargin + 280, signatureY - 10, 250, 25, pdfDoc);
        }
        page2.drawLine({ start: { x: leftMargin + 280, y: signatureY - 15 }, end: { x: leftMargin + 530, y: signatureY - 15 }, thickness: 0.5 });
        drawText(page2, "Witness Signature", { x: leftMargin + 280, y: signatureY - 25, font, size: 8 });
        
        y -= 40;
        
        // Add 2 blank lines of spacing
        y -= lineHeight * 2;

        // Printed Name section
        const printedNameDateY = y;

        // Printed Name
        drawWrappedText(page2, formData.clientAbandonmentPrintedName, font, 10, leftMargin, printedNameDateY, 250, 12);
        page2.drawLine({ start: { x: leftMargin, y: printedNameDateY - 5 }, end: { x: leftMargin + 250, y: printedNameDateY - 5 }, thickness: 0.5 });
        drawText(page2, "Printed Name", { x: leftMargin, y: printedNameDateY - 15, font, size: 8 });

        // Date
        const sigDate = (formData.clientAbandonmentSignatureDate && (formData.clientAbandonmentSignatureDate.toDate || isDate(formData.clientAbandonmentSignatureDate))) ? format(formData.clientAbandonmentSignatureDate.toDate ? formData.clientAbandonmentSignatureDate.toDate() : formData.clientAbandonmentSignatureDate, "MM/dd/yyyy") : '';
        drawWrappedText(page2, sigDate, font, 10, leftMargin + 280, printedNameDateY, 150, 12);
        page2.drawLine({ start: { x: leftMargin + 280, y: printedNameDateY - 5 }, end: { x: leftMargin + 430, y: printedNameDateY - 5 }, thickness: 0.5 });
        drawText(page2, "Date", { x: leftMargin + 280, y: printedNameDateY - 15, font, size: 8 });


        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Client Abandonment PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
