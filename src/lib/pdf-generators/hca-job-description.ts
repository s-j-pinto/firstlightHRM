
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateHcaJobDescriptionPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.2); 

        const darkGreen = rgb(0/255, 62/255, 43/255); 

        const addHeaderAndFooter = (page: PDFPage) => {
            const { width, height } = page.getSize();
            page.drawImage(logoImage, {
                x: 40,
                y: height - 40 - logoDims.height,
                width: logoDims.width,
                height: logoDims.height,
            });
            page.drawRectangle({
                x: 0,
                y: 0,
                width: width,
                height: 36, // 0.5 inch
                color: darkGreen,
            });
        };

        const page1 = pdfDoc.addPage(PageSizes.Letter);
        const page2 = pdfDoc.addPage(PageSizes.Letter);

        addHeaderAndFooter(page1);
        addHeaderAndFooter(page2);

        const { width, height } = page1.getSize();
        const leftMargin = 50;
        const topMargin = height - 120;
        const contentWidth = width - (leftMargin * 2);
        const lineHeight = 14;

        let y = topMargin;

        const drawCenteredTitle = (page: PDFPage, text: string, yPos: number, size: number) => {
            const textWidth = boldFont.widthOfTextAtSize(text, size);
            drawText(page, text, { x: (width / 2) - (textWidth / 2), y: yPos, font: boldFont, size });
            return yPos - (size * 1.5);
        };
        
        y = drawCenteredTitle(page1, "JOB DESCRIPTION", y, 16);
        y = drawCenteredTitle(page1, "Home Care Aide", y, 14);
        y -= 20;

        const drawSection = (page: PDFPage, title: string, content: string | string[], currentY: number) => {
            drawText(page, title, { x: leftMargin, y: currentY, font: boldFont, size: 11 });
            currentY -= lineHeight * 1.5;
            if (typeof content === 'string') {
                currentY = drawWrappedText(page, content, font, 10, leftMargin + 10, currentY, contentWidth - 10, 12);
            } else {
                content.forEach(item => {
                    currentY = drawWrappedText(page, item, font, 10, leftMargin + 10, currentY, contentWidth - 10, 12);
                });
            }
            return currentY - 10;
        };
        
        y = drawSection(page1, "JOB SUMMARY:", "An individual who has completed personal care training and is competent to perform assigned functions of personal care to the client in their residence.", y);
        y = drawSection(page1, "QUALIFICATIONS:", [
            "1. Must have completed personal care training program and competency.",
            "2. Have a sympathetic attitude toward the care of the sick and elderly.",
            "3. Ability to carry out directions, read and write.",
            "4. Maturity and ability to deal eﬀectively with the demands of the job."
        ], y);
        
        const responsibilities = [
            "1. Assist clients with personal hygiene, including shower, tub or bed baths, oral care, hair and skin care.",
            "2. Assist clients in the use of toilet facilities, including bed pans.",
            "3. Assist clients in and out of bed, excluding the use of mechanical lifting equipment unless trained and documented as competent.",
            "4. Assist clients with walking, including the use of walkers and wheelchairs, when applicable.",
            "5. Assist clients with self-administration of medications.",
            "6. Meal preparation and feeding, when required.",
            "7. Assist with prescribed exercises when the client and the aide have been instructed by the appropriate health professional.",
            "8. Record and report changes in the client’s physical condition, behavior or appearance to supervisor or Case Coordinator.",
            "9. Documenting services delivered in accordance with FirstLight Home Care policies and procedures.",
        ];
        y = drawSection(page1, "RESPONSIBILITIES:", responsibilities, y);

        // Page 2 Content
        y = topMargin;
        y = drawSection(page2, "WORKING ENVIRONMENT:", "Works both indoors in the Agency oﬃce and in the field with clients and referral sources.", y);
        y = drawSection(page2, "JOB RELATIONSHIPS:", ["1. Supervised by: Lolita Pinto, Managing Director"], y);
        y = drawSection(page2, "RISK EXPOSURE:", "High risk", y);
        y = drawSection(page2, "LIFTING REQUIREMENTS:", [
            "Ability to perform the following tasks if necessary:",
            "● Ability to participate in physical activity.",
            "● Ability to work for extended period of time while standing and being involved in physical activity.",
            "● Heavy lifting.",
            "● Ability to do extensive bending, lifting and standing on a regular basis."
        ], y);

        y -= 20;

        y = drawWrappedText(page2, "I have read the above job description and fully understand the conditions set forth therein, and if employed as a Personal Care Assistant, I will perform these duties to the best of my knowledge and ability.", font, 10, leftMargin, y, contentWidth, 12);
        y -= 40;

        const signatureY = y;
        if (formData.jobDescriptionSignature) {
            await drawSignature(page2, formData.jobDescriptionSignature, leftMargin + 250, signatureY - 10, 150, 30, pdfDoc);
        }
        page2.drawLine({ start: { x: leftMargin + 240, y: signatureY - 15 }, end: { x: leftMargin + 420, y: signatureY - 15 }, thickness: 0.5 });
        drawText(page2, "Signature", { x: leftMargin + 240, y: signatureY - 25, font, size: 8 });

        const sigDate = (formData.jobDescriptionSignatureDate && (formData.jobDescriptionSignatureDate.toDate || isDate(formData.jobDescriptionSignatureDate))) ? format(formData.jobDescriptionSignatureDate.toDate ? formData.jobDescriptionSignatureDate.toDate() : formData.jobDescriptionSignatureDate, "MM/dd/yyyy") : '';
        if (sigDate) {
            drawText(page2, sigDate, { x: leftMargin, y: signatureY, font, size: 10 });
        }
        page2.drawLine({ start: { x: leftMargin, y: signatureY - 15 }, end: { x: leftMargin + 180, y: signatureY - 15 }, thickness: 0.5 });
        drawText(page2, "Date", { x: leftMargin, y: signatureY - 25, font, size: 8 });
        
        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating HCA Job Description PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
