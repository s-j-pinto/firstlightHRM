'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateOfferLetterPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
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

        const leftMargin = 60;
        const contentWidth = width - (leftMargin * 2);
        let y = height - 60;

        page.drawImage(logoImage, {
            x: leftMargin,
            y: y - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        y -= (logoDims.height + 40);

        const hireDate = (formData.hireDate && (formData.hireDate.toDate || isDate(formData.hireDate))) ? format(formData.hireDate.toDate ? formData.hireDate.toDate() : formData.hireDate, "MMMM d, yyyy") : '____________';
        drawText(page, `Date: ${hireDate}`, { x: leftMargin, y, font, size: 10 });
        y -= 30;

        drawText(page, `Dear ${formData.fullName || ''},`, { x: leftMargin, y, font, size: 10 });
        y -= 20;

        const paragraphs = [
            `We are pleased to confirm our offer to join FirstLight Home Care as Home Care Aide.`,
            `The information below confirms the details of our previous discussions.`,
            `Your caregiver rate will be as follows:`,
            `Training/Orientation- $${formData.caregiver_rate_trng_orient || '16.00'}.`,
            `Your client visit hourly rate will be determined by the services provided to a client and may be adjusted periodically based upon your performance at FirstLight HomeCare. The minimum client care pay rate is $${formData.minimum_client_care_pay_rate || '18.00'}.`,
            `Based on the client care duties, you may be eligible for a higher pay rate. You will be eligible to receive overtime pay if you work more than 9 hours a day and/or 45 hours a week.`,
            `We have Workers’ Compensation available for our employees in case of injury at work. The carrier is Benchmark. Sick days are accumulated up to a maximum of 40 hours a year.`,
            `We look forward to you joining us on ${hireDate}. On your first day with FirstLight Home Care, you will need to demonstrate your eligibility to work in the United States by providing the documentation required by INS form I-9. A summary of these requirements is enclosed.`,
            `This offer of employment is contingent upon FirstLight’s satisfactory verification of the qualifications, documents submitted, and background [HCA registration and live scan fingerprints] presented in your resume and application, in the course of our conversations, and in correspondence with FirstLight. The offer is also contingent upon demonstrating a drug-free lifestyle through the completion of a company drug screening and the satisfactory completion of a background check, which includes a review of criminal history.`,
            `While we hope you accept this offer, nothing in this letter should be interpreted as creating an employment contract for a definite period of time. All employees of FirstLight are employed at-will, and either you or FirstLight may terminate your employment at any time, for any reason, with or without cause.`,
            `I am excited about the background and potential you bring to FirstLight and hope you view this offer as an indication of our confidence in your long-term success with us.`,
            `Please acknowledge your acceptance of this offer by returning a signed copy of this letter and the Confidentiality agreement by fax or email.`
        ];

        paragraphs.forEach(p => {
            y = drawWrappedText(page, p, font, 10, leftMargin, y, contentWidth, 12);
            y -= 15;
        });

        y -= 20;
        drawText(page, "Sincerely,", { x: leftMargin, y, font, size: 10 });
        y -= 20;
        drawText(page, "Lolita Pinto / Jacqui Wilson", { x: leftMargin, y, font, size: 10 });
        y -= 40;

        // Acceptance section
        if (formData.offerLetterSignature) {
            await drawSignature(page, formData.offerLetterSignature, leftMargin + 80, y - 5, 120, 20, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin + 80, y: y - 10 }, end: { x: leftMargin + 300, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Accepted:", { x: leftMargin, y, font, size: 10 });

        const acceptanceDate = (formData.offerLetterSignatureDate && (formData.offerLetterSignatureDate.toDate || isDate(formData.offerLetterSignatureDate))) ? format(formData.offerLetterSignatureDate.toDate ? formData.offerLetterSignatureDate.toDate() : formData.offerLetterSignatureDate, "MM/dd/yyyy") : '____________';
        drawText(page, `Date: ${acceptanceDate}`, { x: leftMargin + 350, y, font, size: 10 });
        y -= 20;

        drawText(page, `Phone Number: ${formData.phone || '_______________________'}`, { x: leftMargin, y, font, size: 10 });
        y -= 40;

        // Footer
        const footerText = "FirstLight home Care of Rancho Cucamonga\n9650 Business Center Drive, Suite 132 Rancho Cucamonga, CA 91730\nPhone: 909-321-4466 Fax: 909-694-2474";
        drawText(page, footerText, {
            x: width / 2 - (font.widthOfTextAtSize("9650 Business Center Drive, Suite 132 Rancho Cucamonga, CA 91730", 8) / 2),
            y: 40,
            font,
            size: 8,
            lineHeight: 10,
        });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Offer Letter PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
