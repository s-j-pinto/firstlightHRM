
'use server';

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateReferenceVerification2Pdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.2);

        let y = height - 40;
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;
        const smallFontSize = 8;
        const smallerFontSize = 7;

        page.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: y,
            width: logoDims.width,
            height: logoDims.height,
        });
        y -= (logoDims.height + 5); 

        const title = "FIRSTLIGHT HOMECARE REFERENCE VERIFICATION FORM (2)";
        const titleWidth = boldFont.widthOfTextAtSize(title, 12);
        page.drawRectangle({
            x: (width / 2) - (titleWidth / 2) - 5,
            y: y - 3,
            width: titleWidth + 10,
            height: 16,
            color: rgb(0, 0, 0),
        });
        drawText(page, title, {
            x: (width / 2) - (titleWidth / 2),
            y: y,
            font: boldFont,
            size: 12,
            color: rgb(1, 1, 1),
        });
        y -= 18;
        
        const pleasePrint = "PLEASE PRINT";
        drawText(page, pleasePrint, {x: leftMargin, y: y, font, size: smallerFontSize});
        y -= 1;
        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 0.5 });
        y -= 15;

        drawText(page, `Applicant’s First Name Middle Last: ${formData.fullName || ''}`, {x: leftMargin, y, font, size: smallFontSize});
        y -= 15;

        const permissionText = "I hereby give FirstLight HomeCare permission to obtain the employment references necessary to make a hiring decision and hold all persons giving references free from any and all liability resulting from this process. I waive any provision impeding the release of this information and agree to provide any information necessary for the release of this information beyond that provided on the employment application and this reference verification form.";
        y = drawWrappedText(page, permissionText, font, smallFontSize, leftMargin, y, contentWidth, 10);
        y -= 25;
        
        if (formData.applicantSignature2) {
            await drawSignature(page, formData.applicantSignature2, leftMargin + 80, y - 5, 120, 24, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: y - 10 }, end: { x: leftMargin + 300, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Signature", {x: leftMargin, y: y-18, font, size: smallerFontSize});

        const sigDate = (formData.applicantSignatureDate2 && (formData.applicantSignatureDate2.toDate || isDate(formData.applicantSignatureDate2))) ? format(formData.applicantSignatureDate2.toDate ? formData.applicantSignatureDate2.toDate() : formData.applicantSignatureDate2, "MM/dd/yyyy") : '';
        if (sigDate) {
             drawText(page, `Date: ${sigDate}`, {x: leftMargin + 350, y, font, size: smallFontSize});
        }
        page.drawLine({ start: { x: leftMargin + 340, y: y-10 }, end: { x: leftMargin + 500, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Date", {x: leftMargin + 340, y: y-18, font, size: smallerFontSize});
        y -= 28;

        const employerBoxStartY = y;
        y -= 10;
        drawText(page, "FORMER EMPLOYER CONTACT INFORMATION", {x: leftMargin, y, font: boldFont, size: smallFontSize});
        y -= 15;

        const drawTwoColumnField = (label1: string, value1: string | undefined, label2: string, value2: string | undefined) => {
            drawText(page, `${label1}: ${value1 || ''}`, {x: leftMargin + 5, y, font, size: smallFontSize});
            drawText(page, `${label2}: ${value2 || ''}`, {x: leftMargin + contentWidth / 2, y, font, size: smallFontSize});
            y -= 12;
        };

        drawTwoColumnField("Company", formData.company2, "Supervisor’s Name and Title", formData.supervisorName2);
        drawTwoColumnField("Email and/or Fax #", formData.emailOrFax2, "Phone", formData.phone2);
        drawTwoColumnField("Dates of Employment", formData.employmentDates2, "Position", formData.position2);
        drawTwoColumnField("Starting Salary:", formData.startingSalary2, "Ending Salary:", formData.endingSalary2);
        
        const employerBoxEndY = y;
        page.drawRectangle({x: leftMargin - 5, y: employerBoxEndY, width: contentWidth+10, height: employerBoxStartY - employerBoxEndY + 5, borderColor: rgb(0,0,0), borderWidth: 1});
        y -= 15;

        const referenceBoxStartY = y;
        y -= 10;
        drawText(page, "REFERENCE INFORMATION", {x: leftMargin, y, font: boldFont, size: smallFontSize});
        y -= 10;
        drawText(page, "Please rate yourself in the following categories as you feel your former supervisor will rate you:", {x: leftMargin, y, font, size: smallFontSize});
        y -= 16;

        const drawRating = (label: string, value: string | undefined) => {
            y = drawWrappedText(page, label, boldFont, smallFontSize, leftMargin + 5, y, contentWidth - 10, 8);
            y -= 2;
            if(value) drawText(page, `Rating: ${value}`, {x: leftMargin + 15, y, font, size: smallFontSize});
            y -= 16;
        };

        drawRating("TEAMWORK: The degree to which you are willing to work harmoniously with others; the extent to which you conform to the policies of management.", formData.teamworkRating2);
        drawRating("DEPENDABILITY: The extent to which you can be depended upon to be available for work and do it properly; the degree to which you are reliable and trustworthy; the extent to which you are able to work scheduled days and times, as well as your willingness to work additional hours if needed.", formData.dependabilityRating2);
        drawRating("INITIATIVE: The degree to which you act independently in new situations; the extent to which you see what needs to be done and do it without being told; the degree to which you do your best to be an outstanding employee.", formData.initiativeRating2);
        drawRating("QUALITY: The degree to which your work is free from errors and mistakes; the extent to which your work is accurate; the quality of your work in general.", formData.qualityRating2);
        drawRating("CUSTOMER SERVICE: The degree to which you relate to the customer’s needs and/or concerns.", formData.customerServiceRating2);
        drawRating("OVERALL PERFORMANCE: The degree to which your previous employer was satisfied with your efforts and achievements, as well as your eligibility for rehire.", formData.overallPerformanceRating2);
        
        const referenceBoxEndY = y;
        page.drawRectangle({x: leftMargin - 5, y: referenceBoxEndY, width: contentWidth+10, height: referenceBoxStartY - referenceBoxEndY + 5, borderColor: rgb(0,0,0), borderWidth: 1});
        
        y -= 15;
        const drawYesNo = (label: string, value: string | undefined, yPos: number, xPos: number) => {
            drawText(page, `${label}: ${value || ''}`, {x: xPos, y: yPos, font, size: smallFontSize});
        };

        drawYesNo("Did you resign from this position?", formData.resignationStatus2, y, leftMargin);
        drawYesNo("Discharged?", formData.dischargedStatus2, y, leftMargin + 250);
        drawYesNo("Laid-Off?", formData.laidOffStatus2, y, leftMargin + 400);
        y -= 12;
        drawYesNo("Are you eligible for rehire?", formData.eligibleForRehire2, y, leftMargin);
        drawYesNo("Were you ever disciplined on the job?", formData.wasDisciplined2, y, leftMargin + 250);
        y -= 12;
        if (formData.wasDisciplined2 === 'Yes' && formData.disciplineExplanation2) {
            y = drawWrappedText(page, `Explain: ${formData.disciplineExplanation2}`, font, smallFontSize, leftMargin, y, contentWidth, 8);
        }
        y-=12;
        drawWrappedText(page, "Someone from FirstLight HomeCare will be following up with your shortly regarding the employment reference verification check. If you have any questions, please call: 909-321-4466", font, smallFontSize, leftMargin, y, contentWidth, 8);

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Reference Verification 2 PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
