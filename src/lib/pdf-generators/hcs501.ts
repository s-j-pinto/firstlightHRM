
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { sanitizeText, drawText, drawCheckbox, drawSignature, drawWrappedText } from './utils';

async function drawHcs501Footer(page: any, font: PDFFont) {
    const { width } = page.getSize();
    const footerText1 = "HCS 501 (10/19)";
    const footerText2 = "Page 1 of 1";
    const footerY = 30;
    const fontSize = 8;

    drawText(page, footerText1, {
        x: 50,
        y: footerY,
        font: font,
        size: fontSize,
        color: rgb(0, 0, 0)
    });

    drawText(page, footerText2, {
        x: width - 50 - font.widthOfTextAtSize(footerText2, fontSize),
        y: footerY,
        font: font,
        size: fontSize,
        color: rgb(0, 0, 0)
    });
}


export async function generateHcs501Pdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let y = height - 60; 
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;

        const lineSpacing = 24; 
        const sectionSpacing = 28;
        const mainFontSize = 9.5;
        const titleFontSize = 14;
        const labelFontSize = 8;
        const headerFontSize = 9; 
        const subTitleFontSize = 8;
        const lightGray = rgb(0.92, 0.92, 0.92);
        
        // Header
        drawText(page, 'State of California – Health and Human Services Agency', { x: leftMargin, y, font, size: headerFontSize });
        const rightHeaderText1 = 'Community Care Licensing Division';
        drawText(page, rightHeaderText1, { x: width - font.widthOfTextAtSize(rightHeaderText1, headerFontSize) - leftMargin, y, font, size: headerFontSize });
        y -= 12;
        drawText(page, 'California Department of Social Services', { x: leftMargin, y, font, size: headerFontSize });
        const rightHeaderText2 = 'Home Care Services Bureau';
        drawText(page, rightHeaderText2, { x: width - font.widthOfTextAtSize(rightHeaderText2, headerFontSize) - leftMargin, y, font, size: headerFontSize });
        
        y -= 30;

        // Title
        const title = "PERSONNEL RECORD";
        drawText(page, title, { x: leftMargin, y, font: boldFont, size: titleFontSize });
        y -= sectionSpacing + 5;

        // Personal Record Pane
        page.drawRectangle({ x: leftMargin - 10, y: y - 85, width: contentWidth + 20, height: 95, color: lightGray });

        const subTitle = '(Form to be kept current at all times) FOR HOME CARE ORGANIZATION (HCO) USE ONLY';
        drawText(page, subTitle, { x: (width / 2) - (font.widthOfTextAtSize(subTitle, subTitleFontSize)/2) , y, font, size: subTitleFontSize });
        y -= lineSpacing * 1.5;

        const drawFieldBox = (label: string, value: string | undefined, x: number, yPos: number, boxWidth: number) => {
            drawText(page, label, {x, y: yPos + 12, font, size: labelFontSize}); // label
            page.drawRectangle({x, y: yPos-12, width: boxWidth, height: 20, borderColor: rgb(0,0,0), borderWidth: 0.5});
            if(value) drawText(page, value, {x: x + 5, y: yPos-7, font, size: mainFontSize}); // value
        }

        drawFieldBox("HCO Number", "364700059", leftMargin, y, 180);
        drawFieldBox("Employee’s PER ID", formData.perId, leftMargin + 200, y, 180);
        y -= lineSpacing * 1.8;
        const hireDate = (formData.hireDate && formData.hireDate.toDate) ? format(formData.hireDate.toDate(), "MM/dd/yyyy") : (isDate(formData.hireDate) ? format(formData.hireDate, "MM/dd/yyyy") : '');
        const separationDate = (formData.separationDate && formData.separationDate.toDate) ? format(formData.separationDate.toDate(), "MM/dd/yyyy") : (isDate(formData.separationDate) ? format(formData.separationDate, "MM/dd/yyyy") : '');
        drawFieldBox("Hire Date", hireDate, leftMargin, y, 180);
        drawFieldBox("Date of Separation", separationDate, leftMargin + 200, y, 180);

        y -= 45; 

        // Personal Section
        const personalTitle = "PERSONAL";
        const personalTitleWidth = boldFont.widthOfTextAtSize(personalTitle, titleFontSize);
        page.drawLine({ start: { x: leftMargin, y: y + 6 }, end: { x: (width/2) - (personalTitleWidth/2) - 5, y: y + 6 }, thickness: 0.5 });
        drawText(page, personalTitle, { x: (width / 2) - (personalTitleWidth / 2), y, font: boldFont, size: titleFontSize });
        page.drawLine({ start: { x: (width / 2) + (personalTitleWidth/2) + 5, y: y + 6 }, end: { x: width - leftMargin, y: y + 6 }, thickness: 0.5 });
        y -= 2;
        page.drawLine({ start: { x: leftMargin, y: y - 2 }, end: { x: width - leftMargin, y: y - 2 }, thickness: 0.5 });
        y -= sectionSpacing;

        // Row 1
        drawFieldBox("Name (Last First Middle)", formData.fullName, leftMargin, y, 280);
        drawFieldBox("Area Code/Telephone", formData.phone, leftMargin + 300, y, contentWidth - 300);
        y -= lineSpacing * 1.8;
        
        // Address and DOB row
        const addressWidth = contentWidth * 0.7;
        const dobX = leftMargin + addressWidth + 10;
        const dobWidth = contentWidth - addressWidth - 10;

        const fullAddress = [formData.address, formData.city, formData.state, formData.zip]
          .filter(Boolean)
          .join(', ');

        drawFieldBox("Address", fullAddress, leftMargin, y, addressWidth);
        const dobDate = (formData.dob && formData.dob.toDate) ? format(formData.dob.toDate(), "MM/dd/yyyy") : (isDate(formData.dob) ? format(formData.dob, "MM/dd/yyyy") : '');
        drawFieldBox("Date of Birth", dobDate, dobX, y, dobWidth);
        y -= lineSpacing * 1.8;

        // SSN, TB Date, TB Results row
        const colWidth = contentWidth / 3;
        const tbDate = (formData.tbDate && formData.tbDate.toDate) ? format(formData.tbDate.toDate(), "MM/dd/yyyy") : (isDate(formData.tbDate) ? format(formData.tbDate, "MM/dd/yyyy") : '');
        drawFieldBox("Social Security Number (Voluntary for ID only)", formData.ssn, leftMargin, y, colWidth - 10);
        drawFieldBox("Date of TB Test Upon Hire", tbDate, leftMargin + colWidth, y, colWidth - 10);
        drawFieldBox("Results of Last TB Test", formData.tbResults, leftMargin + colWidth * 2, y, colWidth);
        y -= lineSpacing * 1.8;

        drawFieldBox("Additional TB Test Dates (Please include test results)", formData.additionalTbDates, leftMargin, y, contentWidth);
        y -= lineSpacing * 1.8;

        drawFieldBox("Please list any alternate names used (For example - maiden name)", formData.alternateNames, leftMargin, y, contentWidth);
        y -= lineSpacing * 1.8;

        drawText(page, "Do you possess a valid California driver’s license?", {x: leftMargin, y, font, size: mainFontSize});
        drawCheckbox(page, formData.validLicense === 'yes', leftMargin + 250, y);
        drawText(page, 'Yes', {x: leftMargin + 265, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.validLicense === 'no', leftMargin + 300, y);
        drawText(page, 'No', {x: leftMargin + 315, y: y+1, font, size: mainFontSize});
        drawFieldBox("CDL Number:", formData.driversLicenseNumber, leftMargin + 350, y + 12, contentWidth - 350 -10);
        y -= sectionSpacing;
        
        // Position Information
        const posTitle = "POSITION INFORMATION";
        const posTitleWidth = boldFont.widthOfTextAtSize(posTitle, titleFontSize);
        page.drawLine({ start: { x: leftMargin, y: y + 6 }, end: { x: (width/2) - (posTitleWidth/2) - 5, y: y + 6 }, thickness: 0.5 });
        drawText(page, posTitle, { x: (width / 2) - (posTitleWidth/2), y, font: boldFont, size: titleFontSize });
        page.drawLine({ start: { x: (width / 2) + (posTitleWidth/2) + 5, y: y + 6 }, end: { x: width - leftMargin, y: y + 6 }, thickness: 0.5 });
        y -= 2;
        page.drawLine({ start: { x: leftMargin, y: y - 2 }, end: { x: width - leftMargin, y: y - 2 }, thickness: 0.5 });
        y -= sectionSpacing;

        drawFieldBox("Title of Position", formData.titleOfPosition, leftMargin, y, contentWidth);
        y -= lineSpacing * 1.8; 
        
        drawText(page, "Notes:", {x: leftMargin, y: y+12, font, size: labelFontSize});
        page.drawRectangle({x: leftMargin, y: y-35, width: contentWidth, height: 40, borderColor: rgb(0,0,0), borderWidth: 0.5});
        if (formData.hcs501Notes) y = drawWrappedText(page, formData.hcs501Notes, font, mainFontSize, leftMargin + 5, y - 5, contentWidth - 10, 12);
        y -= 50; 

        // Certify Pane
        page.drawRectangle({ x: leftMargin - 10, y: y - 75, width: contentWidth + 20, height: 90, color: lightGray });

        const certifyText = "I hereby certify under penalty of perjury that I am 18 years of age or older and that the above statements are true and correct. I give my permission for any necessary verification.";
        y = drawWrappedText(page, certifyText, boldFont, 10, leftMargin, y - 5, contentWidth - 20, 14);
        y -= 25;

        if(formData.hcs501EmployeeSignature) await drawSignature(page, formData.hcs501EmployeeSignature, leftMargin + 5, y, 240, 20, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y-5 }, end: { x: leftMargin + 250, y: y - 5 }, color: rgb(0, 0, 0), thickness: 0.5 });
        drawText(page, "Employee Signature", {x: leftMargin, y: y-15, font, size: labelFontSize});
        
        const sigDate = (formData.hcs501SignatureDate && formData.hcs501SignatureDate.toDate) ? format(formData.hcs501SignatureDate.toDate(), "MM/dd/yyyy") : (isDate(formData.hcs501SignatureDate) ? format(formData.hcs501SignatureDate, "MM/dd/yyyy") : '');
        drawFieldBox("Date", sigDate, leftMargin + 300, y + 12, 200);

        await drawHcs501Footer(page, font);

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating HCS 501 PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
