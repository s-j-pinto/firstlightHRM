

'use server';

import { Buffer } from 'buffer';
import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';

// Helper to sanitize text for pdf-lib
function sanitizeText(text: string | null | undefined): string {
    if (!text) return '';
    // This regex removes most control characters that can cause issues with pdf-lib fonts
    // It keeps standard characters, newlines, and carriage returns.
    // Superscript characters were replaced with parenthesized numbers to avoid encoding issues.
    return text.replace(/[^\p{L}\p{N}\p{P}\p{Z}\r\n()]/gu, '');
}

// Standardized helper to draw text using an options object
// This function now handles multi-line strings by splitting on newline characters.
function drawText(page: any, text: string | undefined, options: { x: number; y: number; font: PDFFont; size: number; color?: any; lineHeight?: number }) {
    if (!text) return;
    
    const sanitized = sanitizeText(text);
    const lines = sanitized.split('\n');
    let currentY = options.y;
    const lineHeight = options.lineHeight || options.size * 1.2;

    for (const line of lines) {
        page.drawText(line, {
            ...options,
            y: currentY,
        });
        currentY -= lineHeight;
    }
}

// Helper to draw a checkbox
function drawCheckbox(page: any, checked: boolean | undefined, x: number, y: number) {
    if (checked) {
        page.drawLine({
            start: { x: x + 2, y: y + 5 },
            end: { x: x + 5, y: y + 2 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
        page.drawLine({
            start: { x: x + 5, y: y + 2 },
            end: { x: x + 8, y: y + 8 },
            thickness: 1,
            color: rgb(0, 0, 0),
        });
    }
    page.drawRectangle({
        x: x,
        y: y,
        width: 10,
        height: 10,
        borderWidth: 0.5,
        borderColor: rgb(0, 0, 0),
    });
}


async function drawSignature(page: any, dataUrl: string | undefined, x: number, y: number, width: number, height: number, pdfDoc: PDFDocument) {
    if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
        try {
            const pngImage = await pdfDoc.embedPng(dataUrl);
            page.drawImage(pngImage, { x, y, width, height });
        } catch (e) {
            console.error("Failed to embed signature:", e);
        }
    }
}

function drawWrappedText(page: any, text: string | undefined, font: PDFFont, fontSize: number, x: number, y: number, maxWidth: number, lineHeight: number): number {
    if (!text) return y;
    text = sanitizeText(text);
    
    let currentY = y;
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
            currentY -= lineHeight;
            continue;
        }

        const words = paragraph.split(' ');
        let line = '';

        for (const word of words) {
            const testLine = line + word + ' ';
            const testWidth = font.widthOfTextAtSize(testLine, fontSize);
            if (testWidth > maxWidth && line.length > 0) {
                drawText(page, line.trim(), { x: x, y: currentY, font, size: fontSize, color: rgb(0,0,0) });
                line = word + ' ';
                currentY -= lineHeight;
            } else {
                line = testLine;
            }
        }
        if (line.trim().length > 0) {
            drawText(page, line.trim(), { x: x, y: currentY, font, size: fontSize, color: rgb(0,0,0) });
            currentY -= lineHeight;
        }
    }
    
    return currentY; 
}


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
        
        drawFieldBox("Address", formData.address, leftMargin, y, contentWidth);
        y -= lineSpacing * 1.3; 

        const dobDate = (formData.dob && formData.dob.toDate) ? format(formData.dob.toDate(), "MM/dd/yyyy") : (isDate(formData.dob) ? format(formData.dob, "MM/dd/yyyy") : '');
        drawFieldBox("Date of Birth", dobDate, leftMargin, y, 200);
        drawFieldBox("Social Security Number (Voluntary for ID only)", formData.ssn, leftMargin + 220, y, contentWidth-220);
        y -= lineSpacing * 1.8;

        const tbDate = (formData.tbDate && formData.tbDate.toDate) ? format(formData.tbDate.toDate(), "MM/dd/yyyy") : (isDate(formData.tbDate) ? format(formData.tbDate, "MM/dd/yyyy") : '');
        drawFieldBox("Date of TB Test Upon Hire", tbDate, leftMargin, y, 200);
        drawFieldBox("Results of Last TB Test", formData.tbResults, leftMargin + 220, y, contentWidth - 220);
        y -= lineSpacing * 1.8;

        drawFieldBox("Additional TB Test Dates (Please include test results)", formData.additionalTbDates, leftMargin, y, contentWidth);
        y -= lineSpacing * 1.8;

        drawFieldBox("Please list any alternate names used (For example - maiden name)", formData.alternateNames, leftMargin, y, contentWidth);
        y -= lineSpacing * 1.8;

        drawText(page, "Do you possess a valid California driver’s license?", {x: leftMargin, y, font, size: mainFontSize});
        drawCheckbox(page, formData.validLicense === 'yes', leftMargin + 250, y);
        drawText(page, 'Yes', {x: leftMargin + 265, y, font, size: mainFontSize});
        drawCheckbox(page, formData.validLicense === 'no', leftMargin + 300, y);
        drawText(page, 'No', {x: leftMargin + 315, y, font, size: mainFontSize});
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


export async function generateEmergencyContactPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
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


        let y = height - 50;
        const leftMargin = 60;
        const contentWidth = width - (leftMargin * 2);
        
        page.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: y,
            width: logoDims.width,
            height: logoDims.height,
        });
        y -= logoDims.height + 20;

        const title = "Caregiver Emergency Contact Numbers";
        drawText(page, title, {
            x: (width / 2) - (boldFont.widthOfTextAtSize(title, 16) / 2),
            y,
            font: boldFont,
            size: 16,
        });
        y -= 30;

        const boxStartY = y + 10;

        const drawSection = (title: string, data: { [key: string]: string | undefined }, isFirst: boolean = false, subTitle?: string) => {
            if (!isFirst) {
                page.drawLine({ start: { x: leftMargin, y: y + 10 }, end: { x: width - leftMargin, y: y + 10 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
                y -= 20;
            }
            
            const titleWidth = boldFont.widthOfTextAtSize(title, 12);
            drawText(page, title, {
                x: leftMargin,
                y,
                font: boldFont,
                size: 12,
            });

            if (subTitle) {
                const subTitleWidth = boldFont.widthOfTextAtSize(subTitle, 12);
                drawText(page, subTitle, {
                    x: leftMargin + titleWidth + (contentWidth - titleWidth - subTitleWidth)/2,
                    y,
                    font: boldFont,
                    size: 12,
                });
            }

            y -= 25;

            const drawField = (label: string, value: string | undefined) => {
                if (value) {
                    drawText(page, `${label}:`, { x: leftMargin + 20, y, font: boldFont, size: 11 });
                    drawText(page, value, { x: leftMargin + 150, y, font, size: 11 });
                    y -= 20;
                }
            };
            
            Object.entries(data).forEach(([label, value]) => drawField(label, value));
            y -= 10;
        };
        
        const yourInfo = {
            "Name": formData.fullName,
            "Phone/Cell": formData.phone,
            "Address": formData.address,
            "City/State/Zip": `${formData.city || ''}, ${formData.state || ''} ${formData.zip || ''}`,
        };
        drawSection("Your Information", yourInfo, true, "General Information");
        
        if (formData.emergencyContact1_name) {
            const firstPersonInfo = {
                "Name": formData.emergencyContact1_name,
                "Phone/Cell": formData.emergencyContact1_phone,
                "Address": formData.emergencyContact1_address,
                "City/State/Zip": formData.emergencyContact1_cityStateZip,
            };
            drawSection("In Case of Emergency please notify: (First Person)", firstPersonInfo);
        }

        if (formData.emergencyContact2_name) {
            const secondPersonInfo = {
                "Name": formData.emergencyContact2_name,
                "Phone/Cell": formData.emergencyContact2_phone,
                "Address": formData.emergencyContact2_address,
                "City/State/Zip": formData.emergencyContact2_cityStateZip,
            };
            drawSection("Second Person", secondPersonInfo);
        }

        const boxEndY = y;

        page.drawRectangle({
            x: leftMargin - 20,
            y: boxEndY - 20,
            width: contentWidth + 40,
            height: boxStartY - (boxEndY - 20),
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });

        drawText(page, "REV 02/03/17", { x: leftMargin, y: 30, font: font, size: 9 });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Emergency Contact PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateReferenceVerificationPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
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

        const title = "FIRSTLIGHT HOMECARE REFERENCE VERIFICATION FORM";
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
        
        if (formData.applicantSignature) {
            await drawSignature(page, formData.applicantSignature, leftMargin + 80, y - 5, 120, 24, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: y - 10 }, end: { x: leftMargin + 300, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Signature", {x: leftMargin, y: y-18, font, size: smallerFontSize});

        const sigDate = (formData.applicantSignatureDate && (formData.applicantSignatureDate.toDate || isDate(formData.applicantSignatureDate))) ? format(formData.applicantSignatureDate.toDate ? formData.applicantSignatureDate.toDate() : formData.applicantSignatureDate, "MM/dd/yyyy") : '';
        if (sigDate) {
             drawText(page, `Date: ${sigDate}`, {x: leftMargin + 350, y, font, size: smallFontSize});
        }
        page.drawLine({ start: { x: leftMargin + 340, y: y-10 }, end: { x: leftMargin + 500, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Date", {x: leftMargin + 340, y: y-18, font, size: smallerFontSize});
        y -= 28;

        const employerBoxStartY = y;
        drawText(page, "FORMER EMPLOYER CONTACT INFORMATION", {x: leftMargin, y, font: boldFont, size: smallFontSize});
        y -= 15;

        const drawTwoColumnField = (label1: string, value1: string | undefined, label2: string, value2: string | undefined) => {
            drawText(page, `${label1}: ${value1 || ''}`, {x: leftMargin + 5, y, font, size: smallFontSize});
            drawText(page, `${label2}: ${value2 || ''}`, {x: leftMargin + contentWidth / 2, y, font, size: smallFontSize});
            y -= 12;
        };

        drawTwoColumnField("Company", formData.company, "Supervisor’s Name and Title", formData.supervisorName);
        drawTwoColumnField("Email and/or Fax #", formData.emailOrFax, "Phone", formData.phone);
        drawTwoColumnField("Dates of Employment", formData.employmentDates, "Position", formData.position);
        drawTwoColumnField("Starting Salary:", formData.startingSalary, "Ending Salary:", formData.endingSalary);
        
        const employerBoxEndY = y;
        page.drawRectangle({x: leftMargin - 5, y: employerBoxEndY, width: contentWidth+10, height: employerBoxStartY - employerBoxEndY + 5, borderColor: rgb(0,0,0), borderWidth: 1});
        y -= 15;

        const referenceBoxStartY = y;
        drawText(page, "REFERENCE INFORMATION", {x: leftMargin, y, font: boldFont, size: smallFontSize});
        y -= 10;
        drawText(page, "Please rate yourself in the following categories as you feel your former supervisor will rate you:", {x: leftMargin, y, font, size: smallFontSize});
        y -= 6;

        const drawRating = (label: string, value: string | undefined) => {
            y = drawWrappedText(page, label, boldFont, smallFontSize, leftMargin + 5, y, contentWidth - 10, 8);
            y -= 2;
            if(value) drawText(page, `Rating: ${value}`, {x: leftMargin + 15, y, font, size: smallFontSize});
            y -= 8;
        };

        drawRating("TEAMWORK: The degree to which you are willing to work harmoniously with others; the extent to which you conform to the policies of management.", formData.teamworkRating);
        drawRating("DEPENDABILITY: The extent to which you can be depended upon to be available for work and do it properly; the degree to which you are reliable and trustworthy; the extent to which you are able to work scheduled days and times, as well as your willingness to work additional hours if needed.", formData.dependabilityRating);
        drawRating("INITIATIVE: The degree to which you act independently in new situations; the extent to which you see what needs to be done and do it without being told; the degree to which you do your best to be an outstanding employee.", formData.initiativeRating);
        drawRating("QUALITY: The degree to which your work is free from errors and mistakes; the extent to which your work is accurate; the quality of your work in general.", formData.qualityRating);
        drawRating("CUSTOMER SERVICE: The degree to which you relate to the customer’s needs and/or concerns.", formData.customerServiceRating);
        drawRating("OVERALL PERFORMANCE: The degree to which your previous employer was satisfied with your efforts and achievements, as well as your eligibility for rehire.", formData.overallPerformanceRating);
        
        const referenceBoxEndY = y;
        page.drawRectangle({x: leftMargin - 5, y: referenceBoxEndY, width: contentWidth+10, height: referenceBoxStartY - referenceBoxEndY + 5, borderColor: rgb(0,0,0), borderWidth: 1});
        
        y -= 15;
        const drawYesNo = (label: string, value: string | undefined, yPos: number, xPos: number) => {
            drawText(page, `${label}: ${value || ''}`, {x: xPos, y: yPos, font, size: smallFontSize});
        };

        drawYesNo("Did you resign from this position?", formData.resignationStatus, y, leftMargin);
        drawYesNo("Discharged?", formData.dischargedStatus, y, leftMargin + 250);
        drawYesNo("Laid-Off?", formData.laidOffStatus, y, leftMargin + 400);
        y -= 12;
        drawYesNo("Are you eligible for rehire?", formData.eligibleForRehire, y, leftMargin);
        drawYesNo("Were you ever disciplined on the job?", formData.wasDisciplined, y, leftMargin + 250);
        y -= 12;
        if (formData.wasDisciplined === 'Yes' && formData.disciplineExplanation) {
            y = drawWrappedText(page, `Explain: ${formData.disciplineExplanation}`, font, smallFontSize, leftMargin, y, contentWidth, 8);
        }
        y-=12;
        drawWrappedText(page, "Someone from FirstLight HomeCare will be following up with your shortly regarding the employment reference verification check. If you have any questions, please call: 909-321-4466", font, smallFontSize, leftMargin, y, contentWidth, 8);

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Reference Verification PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateLic508Pdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = [pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage()];
        
        const headerFooterFontSize = 7;

        const drawHeaderAndFooter = (page: any, pageNum: number) => {
            const { width, height } = page.getSize();
            const headerY = height - 30;
            const footerY = 30;
            const fontSize = headerFooterFontSize;

            drawText(page, "State of California - Health and Human Services Agency", { x: 50, y: headerY, font, size: fontSize });
            drawText(page, "California Department of Social Services", { x: width - font.widthOfTextAtSize("California Department of Social Services", fontSize) - 50, y: headerY, font, size: fontSize });

            drawText(page, "LIC 508 (7/21)", { x: 50, y: footerY, font, size: fontSize });
            const pageNumText = `Page ${pageNum} of 5`;
            drawText(page, pageNumText, { x: width - font.widthOfTextAtSize(pageNumText, fontSize) - 50, y: footerY, font, size: fontSize });
        };
        
        pages.forEach((page, index) => drawHeaderAndFooter(page, index + 1));
        
        // --- PAGE 1 ---
        let page = pages[0];
        let { width, height } = page.getSize();
        let y = height - 70;
        const leftMargin = 60;
        const rightMargin = width - 60;
        const contentWidth = rightMargin - leftMargin;

        const mainFontSize = 7.5;
        const titleFontSize = 11.5;
        const smallFontSize = 7;
        const lineHeight = 10;

        let title = "CRIMINAL RECORD STATEMENT";
        drawText(page, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, titleFontSize) / 2), y, font: boldFont, size: titleFontSize });
        y -= 20;
        
        const p1_line1 = "State law requires that persons associated with licensed care facilities, Home Care Aide Registry or TrustLine Registry applicants be fingerprinted and disclose any conviction. A conviction is any plea of guilty or nolo contendere (no contest) or a verdict of guilty. The fingerprints will be used to obtain a copy of any criminal history you may have.";
        y = drawWrappedText(page, p1_line1, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 20;
        
        drawCheckbox(page, formData.convictedInCalifornia === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.convictedInCalifornia === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        drawText(page, 'Have you ever been convicted of a crime in California?', {x: leftMargin + 100, y: y + 1, font: boldFont, size: mainFontSize});
        y -= 15;
        
        const p1_line2 = "You do not need to disclose any marijuana-related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7.";
        y = drawWrappedText(page, p1_line2, font, smallFontSize, leftMargin, y, contentWidth, 11);
        y -= 20;

        drawCheckbox(page, formData.convictedOutOfState === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.convictedOutOfState === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        y = drawWrappedText(page, 'Have you ever been convicted of a crime from another state, federal court, military, or jurisdiction outside of U.S.?', boldFont, mainFontSize, leftMargin + 100, y, contentWidth - 100, lineHeight);
        y -= 15;
        
        const p1_line3 = "You do not need to disclose convictions that were a result of one's status as a victim of human trafficking and that were dismissed pursuant to Penal Code Section 1203.49, nor any marijuana related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7. However you are required to disclose convictions that were dismissed pursuant to Penal Code Section 1203.4(a)";
        y = drawWrappedText(page, p1_line3, font, smallFontSize, leftMargin, y, contentWidth, 11);
        y -= 20;

        drawText(page, "Criminal convictions from another State or Federal court are considered the same as criminal convictions in California.", {x: leftMargin, y, font, size: smallFontSize, color: rgb(0.5, 0.5, 0.5)});
        y -= 20;
        
        const p1_childrens_text = "For Children's Residential Facilities, not including Foster Family Agency Staff, Youth Homelessness Prevention Centers, Private Alternative Boarding Schools, Private Alternative Outdoor Program, or Crisis Nurseries:";
        y = drawWrappedText(page, p1_childrens_text, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        drawCheckbox(page, formData.livedOutOfStateLast5Years === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.livedOutOfStateLast5Years === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        y = drawWrappedText(page, 'Have you lived in a state other than California within the last five years?', boldFont, mainFontSize, leftMargin + 100, y, contentWidth-100, lineHeight);
        y -= 15;

        y = drawWrappedText(page, `If yes, list each state below and then complete an LIC 198B for each state: ${formData.outOfStateHistory || ''}`, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        
        y -= (lineHeight * 15);
        
        const p1_list_title = "You must check yes to the corresponding question(s) above to report every conviction (including reckless and drunk driving convictions), you have on your record even if:";
        y = drawWrappedText(page, p1_list_title, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        const p1_list_items = [
            "It happened a long time ago;",
            "It was only a misdemeanor;",
            "You didn’t have to go to court (your attorney went for you);",
            "You had no jail time, or the sentence was only a fine or probation;",
            "You received a certificate of rehabilitation; or",
            "The conviction was later dismissed, set aside or the sentence was suspended."
        ];
        p1_list_items.forEach(item => {
            y = drawWrappedText(page, `• ${item}`, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        });

        // --- PAGE 2 ---
        page = pages[1];
        y = height - 70;
        
        const p2_note = "NOTE: IF THE CRIMINAL BACKGROUND CHECK REVEALS ANY CONVICTION(S) THAT YOU DID NOT REPORT ON THIS FORM BY CHECKING YES, YOUR FAILURE TO DISCLOSE THE CONVICTION(S) MAY RESULT IN AN EXEMPTION DENIAL, APPLICATION DENIAL, LICENSE REVOCATION, DECERTIFICATION, RESCISSION OF APPROVAL, OR EXCLUSION FROM A LICENSED FACILITY, CERTIFIED FAMILY HOME, OR THE HOME OF A RESOURCE FAMILY.";
        y = drawWrappedText(page, p2_note, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 3;

        const p2_move_note = "If you move or change your mailing address, you must send your updated information to the Caregiver Background Check Bureau within 10 days to:";
        y = drawWrappedText(page, p2_move_note, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 1.5;

        const addressBlock_p2 = "Caregiver Background Check Bureau\n744 P Street, M/S T9-15-62\nSacramento, CA 95814";
        drawText(page, addressBlock_p2, { x: leftMargin + 20, y: y, font: mainFontSize === 10 ? boldFont : font, size: mainFontSize, lineHeight: lineHeight});
        y -= (lineHeight * 5);
        
        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1 });
        y -= lineHeight * 2;
        
        const p2_certifyText = "I declare under penalty of perjury under the laws of the State of California that I have read and understand the information contained in this affidavit and that my responses and any accompanying attachments are true and correct.";
        y = drawWrappedText(page, p2_certifyText, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 5;

        const drawFieldBox_p2 = (label: string, value: string | undefined, x: number, yPos: number, boxWidth: number) => {
            drawText(page, label, {x, y: yPos + 12, font, size: smallFontSize});
            page.drawRectangle({x, y: yPos-12, width: boxWidth, height: 20, borderColor: rgb(0,0,0), borderWidth: 0.5});
            if(value) drawText(page, value, {x: x + 5, y: yPos-7, font, size: mainFontSize});
        };
        
        drawFieldBox_p2("FACILITY/ORGANIZATION/AGENCY NAME:", "FirstLight Home Care of Rancho Cucamonga", leftMargin, y + 12, 300);
        drawFieldBox_p2("FACILITY/ORGANIZATION/AGENCY NUMBER:", "364700059", leftMargin + 320, y + 12, contentWidth - 320);
        y -= lineHeight * 5.5;

        drawFieldBox_p2("YOUR NAME (print clearly):", formData.fullName, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 5.5;

        drawFieldBox_p2("Street Address:", formData.address, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 5.5;

        drawFieldBox_p2("City", formData.city, leftMargin, y + 12, 200);
        drawFieldBox_p2("State", formData.state, leftMargin + 220, y + 12, 100);
        drawFieldBox_p2("Zip Code", formData.zip, leftMargin + 340, y + 12, contentWidth - 340);
        y -= lineHeight * 5.5;

        drawFieldBox_p2("SOCIAL SECURITY NUMBER:", formData.ssn, leftMargin, y + 12, 200);
        drawFieldBox_p2("DRIVER’S LICENSE NUMBER/STATE:", formData.driversLicenseNumber, leftMargin + 220, y + 12, contentWidth - 220);
        y -= lineHeight * 5.5;

        const dobDateForField_p2 = (formData.dob && (formData.dob.toDate || isDate(formData.dob))) ? format(formData.dob.toDate ? formData.dob.toDate() : formData.dob, "MM/dd/yyyy") : '';
        drawFieldBox_p2("DATE OF BIRTH:", dobDateForField_p2, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 6;

        if (formData.lic508Signature) await drawSignature(page, formData.lic508Signature, leftMargin + 5, y, 290, 20, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 300, y: y - 5 }, color: rgb(0, 0, 0), thickness: 0.5 });
        drawText(page, "SIGNATURE:", { x: leftMargin, y: y - 15, font, size: smallFontSize });

        const sigDateForField_p2 = (formData.lic508SignatureDate && (formData.lic508SignatureDate.toDate || isDate(formData.lic508SignatureDate))) ? format(formData.lic508SignatureDate.toDate ? formData.lic508SignatureDate.toDate() : formData.lic508SignatureDate, "MM/dd/yyyy") : '';
        drawFieldBox_p2("DATE:", sigDateForField_p2, leftMargin + 320, y + 12, contentWidth - 320);
        y -= 40;

        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1 });
        y -= 15;

        const instructionsLicensees_p2 = "Instructions to Licensees:";
        y = drawWrappedText(page, instructionsLicensees_p2, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        const p2_inst1 = "If the person discloses that they have ever been convicted of a crime, maintain this form in your facility/organization personnel file and send a copy to your Licensed Program Analyst (LPA) or assigned analyst.";
        y = drawWrappedText(page, p2_inst1, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        const instructionsRegional_p2 = "Instructions to Regional Offices and Foster Family Agencies:";
        y = drawWrappedText(page, instructionsRegional_p2, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        const p2_inst2 = "If ‘Yes’ is indicated in any box above, forward a copy of this completed form (and the LIC 198B, as applicable) to the Caregiver Background Check Bureau, 744 P Street, MS T9-15-62, Sacramento, CA 95814.";
        y = drawWrappedText(page, p2_inst2, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 2;
        const p2_inst3 = "If ‘No’ is indicated above in all boxes, keep this completed form in the facility file.";
        y = drawWrappedText(page, p2_inst3, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);


        // --- PAGE 3 ---
        page = pages[2];
        y = height - 70;
        
        page.drawRectangle({x: leftMargin, y: y - 530, width: contentWidth, height: 550, borderColor: rgb(0,0,0), borderWidth: 1});
        
        drawText(page, "Privacy Notice", { x: (width / 2) - (boldFont.widthOfTextAtSize("Privacy Notice", titleFontSize) / 2), y, font: boldFont, size: titleFontSize }); y -= 15;
        drawText(page, "As Required by Civil Code § 1798.17", { x: (width / 2) - (font.widthOfTextAtSize("As Required by Civil Code § 1798.17", smallFontSize) / 2), y, font, size: smallFontSize }); y -= 25;

        const p3_content = [
            { text: "Collection and Use of Personal Information. The California Justice Information Services (CJIS) Division in the Department of Justice (DOJ) collects the information requested on this form as authorized by Penal Code sections 11100-11112; Health and Safety Code sections 1522, 1569.10-1569.24, 1596.80-1596.879; Family Code sections 8700-87200; Welfare and Institutions Code sections 16500-16523.1; and other various state statutes and regulations. The CJIS Division uses this information to process requests of authorized entities that want to obtain information as to the existence and content of a record of state or federal convictions to help determine suitability for employment, or volunteer work with children, elderly, or disabled; or for adoption or purposes of a license, certification, or permit. In addition, any personal information collected by state agencies is subject to the limitations in the Information Practices Act and state policy. The DOJ’s general privacy policy is available at http://oag.ca.gov/privacy-policy.", isBold: true },
            { text: "Providing Personal Information. All the personal information requested in the form must be provided. Failure to provide all the necessary information will result in delays and/or the rejection of your request. Notice is given for the request of the Social Security Number (SSN) on this form. The California Department of Justice uses a person’s SSN as an identifying number. The requested SSN is voluntary. Failure to provide the SSN may delay the processing of this form and the criminal record check.", isBold: true },
            { text: "Access to Your Information. You may review the records maintained by the CJIS Division in the DOJ that contain your personal information, as permitted by the Information Practices Act. See below for contact information.", isBold: true },
            { text: "Possible Disclosure of Personal Information. In order to be licensed, work at, or be present at, a licensed facility/organization, or be placed on a registry administered by the Department, the law requires that you complete a criminal background check. (Health and Safety Code sections 1522, 1568.09, 1569.17 and 1596.871). The Department will create a file concerning your criminal background check that will contain certain documents, including personal information that you provide. You have the right to access certain records containing your personal information maintained by the Department (Civil Code section 1798 et seq.). Under the California Public Records Act (Government Code section 6250 et seq.), the Department may have to provide copies of some of the records in the file to members of the public who ask for them, including newspaper and television reporters.", isBold: true },
            { text: "NOTE: IMPORTANT INFORMATION", isBold: true },
            { text: "The Department is required to tell people who ask, including the press, if someone in a licensed facility/ organization has a criminal record exemption. The Department must also tell people who ask the name of a licensed facility/organization that has a licensee, employee, resident, or other person with a criminal record exemption. This does not apply to Resource Family Homes, Small Family Child Care Homes, or the Home Care Aide Registry. The Department shall not release any information regarding Home Care Aides in response to a Public Records Act request, other than their Home Care Aide number.", isBold: false },
            { text: "The information you provide may also be disclosed in the following circumstances:", isBold: false },
            { text: "• With other persons or agencies where necessary to perform their legal duties, and their use of your information is compatible and complies with state law, such as for investigations or for licensing, certification, or regulatory purposes.", isBold: false },
            { text: "• To another government agency as required by state or federal law.", isBold: false },
        ];
        
        p3_content.forEach(item => {
            const currentFont = item.isBold ? boldFont : font;
            const indent = item.text.startsWith("•") ? 10 : 0;
            y = drawWrappedText(page, item.text, currentFont, mainFontSize, leftMargin + 5 + indent, y, contentWidth - 10 - indent, lineHeight);
        });


        // --- PAGE 4 ---
        page = pages[3];
        y = height - 70;
        
        page.drawRectangle({x: leftMargin, y: y - 500, width: contentWidth, height: 520, borderColor: rgb(0,0,0), borderWidth: 1});

        const p4_contact_info = "Contact Information";
        y = drawWrappedText(page, p4_contact_info, boldFont, mainFontSize, leftMargin + 5, y, contentWidth, lineHeight);
        const p4_content_1 = "For questions about this notice, CDSS programs, and the authorized use of your criminal history information, please contact your local licensing regional office.";
        y = drawWrappedText(page, p4_content_1, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        y -= 5;
        
        const p4_content_2 = "For further questions about this notice or your criminal records, you may contact the Associate Governmental Program Analyst at the DOJ’s Keeper of Records at (916) 210-3310, by email at keeperofrecords@doj.ca.gov, or by mail at:";
        y = drawWrappedText(page, p4_content_2, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        y -= 15;
        drawText(page, "Department of Justice\nBureau of Criminal Information & Analysis Keeper of Records\nP.O. Box 903417\nSacramento, CA 94203-4170", { x: leftMargin + 25, y: y, font: mainFontSize === 10 ? boldFont : font, size: mainFontSize, lineHeight: lineHeight});
        y -= (lineHeight * 5);
        
        const anrcTitle_p4 = "Applicant Notification and Record Challenge";
        drawText(page, anrcTitle_p4, { x: (width / 2) - (boldFont.widthOfTextAtSize(anrcTitle_p4, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight * 1.5;
        y = drawWrappedText(page, "Your fingerprints will be used to check the criminal history records of the FBI. You have the opportunity to complete or challenge the accuracy of the information contained in the FBI identification record. The procedure for obtaining a change, correction, or updating an FBI identification record are set forth in Title 28, CFR, 16.34. You can find additional information on the FBI website at https://www.fbi.gov/about-us/cjis/background-checks.", font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight); y -= 20;

        const fpasTitle_p4 = "Federal Privacy Act Statement";
        drawText(page, fpasTitle_p4, { x: (width / 2) - (boldFont.widthOfTextAtSize(fpasTitle_p4, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight * 1.5;
        
        const p4_authority_label = "Authority:";
        y = drawWrappedText(page, p4_authority_label, boldFont, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        const p4_authority = " The FBI’s acquisition, preservation, and exchange of fingerprints and associated information is generally authorized under 28 U.S.C. 534. Depending on the nature of your application, supplemental authorities include Federal statutes, State statutes pursuant to Pub. L. 92-544, Presidential Executive Orders, and federal regulations. Providing your fingerprints and associated information is voluntary; however, failure to do so may affect completion or approval of your application.";
        y = drawWrappedText(page, p4_authority, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight); y -= 15;
        
        const p4_principal_label = "Principal Purpose:";
        y = drawWrappedText(page, p4_principal_label, boldFont, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        const p4_principal = " Certain determinations, such as employment, licensing, and security clearances, may be predicated on fingerprint-based background checks. Your fingerprints and associated information/biometrics may be provided to the employing, investigating, or otherwise responsible agency, and/or the FBI for the purpose of comparing your fingerprints to other fingerprints in the FBI’s Next Generation Identification (NGI) system or its successor systems (including civil, criminal, and latent fingerprint repositories) or other available records of the employing, investigating, or otherwise responsible agency. The FBI may retain your fingerprints and associated information/biometrics in NGI after the completion of this application and, while retained, your fingerprints may continue to be compared against other fingerprints submitted to or retained by NGI.";
        y = drawWrappedText(page, p4_principal, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight); y -= 15;
        
        const p4_routine_label = "Routine Uses:";
        y = drawWrappedText(page, p4_routine_label, boldFont, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        const p4_routine = " During the processing of this application and for as long thereafter as your fingerprints and associated information/biometrics are retained in NGI, your information may be disclosed pursuant to your consent, and may be disclosed without your consent as permitted by the Privacy Act of 1974 and all applicable Routine Uses as may be published at any time in the Federal Register, including the Routine Uses for the NGI system and the FBI’s Blanket Routine Uses. Routine uses include, but are not limited to, disclosures to:\n• employing, governmental or authorized non-governmental agencies responsible for employment, contracting, licensing, security clearances, and other suitability determinations;\n• local, state, tribal, or federal law enforcement agencies; criminal justice agencies; and agencies responsible for national security or public safety.";
        y = drawWrappedText(page, p4_routine, font, mainFontSize, leftMargin + 5, y, contentWidth-10, lineHeight); y-=20;
        
        const njarprTitle_p4 = "Noncriminal Justice Applicant’s Privacy Rights";
        drawText(page, njarprTitle_p4, { x: (width / 2) - (boldFont.widthOfTextAtSize(njarprTitle_p4, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight * 1.5;
        y = drawWrappedText(page, "As an applicant who is the subject of a national fingerprint-based criminal history record check for a noncriminal justice purpose (such as an application for employment or a license, an immigration or naturalization matter, security clearance, or adoption), you have certain rights which are discussed below.", font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);

        // --- PAGE 5 ---
        page = pages[4];
        y = height - 70;
        
        page.drawRectangle({x: leftMargin, y: y - 350, width: contentWidth, height: 370, borderColor: rgb(0,0,0), borderWidth: 1});

        
        const page5_items = [
            "You must be provided written notification(1) that your fingerprints will be used to check the criminal history records of the FBI.",
            "You must be provided, and acknowledge receipt of, an adequate Privacy Act Statement when you submit your fingerprints and associated personal information. This Privacy Act Statement should explain the authority for collecting your information and how your information will be used, retained, and shared. (2)",
            "If you have a criminal history record, the officials making a determination of your suitability for the employment, license, or other benefit must provide you the opportunity to complete or challenge the accuracy of the information in the record.",
            "The officials must advise you that the procedures for obtaining a change, correction, or update of your criminal history record are set forth at Title 28, Code of Federal Regulations (CFR), Section 16.34.",
            "If you have a criminal history record, you should be afforded a reasonable amount of time to correct or complete the record (or decline to do so) before the officials deny you the employment, license, or other benefit based on information in the criminal history record. (3)",
            "You have the right to expect that officials receiving the results of the criminal history record check will use it only for authorized purposes and will not retain or disseminate it in violation of federal statute, regulation or executive order, or rule, procedure or standard established by the National Crime Prevention and Privacy Compact Council. (4)"
        ];
        
        page5_items.forEach(item => {
            y = drawWrappedText(page, `• ${item}`, font, mainFontSize, leftMargin + 15, y, contentWidth - 30, lineHeight);
        });

        const p5_text = [
            "If agency policy permits, the officials may provide you with a copy of your FBI criminal history record for review and possible challenge. If agency policy does not permit it to provide you a copy of the record, you may obtain a copy of the record by submitting fingerprints and a fee to the FBI. Information regarding this process may be obtained at https://www.fbi.gov/services/cjis/identity-history-summary-checks.",
            "If you decide to challenge the accuracy or completeness of your FBI criminal history record, you should send your challenge to the agency that contributed the questioned information to the FBI. Alternatively, you may send your challenge directly to the FBI. The FBI will then forward your challenge to the agency that contributed the questioned information and request the agency to verify or correct the challenged entry. Upon receipt of an official communication from that agency, the FBI will make any necessary changes/corrections to your record in accordance with the information supplied by that agency. (See 28 CFR 16.30 through 16.34.) You can find additional information on the FBI website at https://www.fbi.gov/about-us/cjis/background-checks."
        ];

        p5_text.forEach(text => {
            y = drawWrappedText(page, text, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
            y -= 15;
        });

        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y-= 15;
        
        const footnotes = [
            "(1) Written notification includes electronic notification, but excludes oral notification.",
            "(2) https://www.fbi.gov/services/cjis/compact-council/privacy-act-statement",
            "(3) See 28 CFR 50.12(b)",
            "(4) See U.S.C. 552a(b); 28 U.S.C. 534(b); 34 U.S.C. § 40316 (formerly cited as 42 U.S.C. § 14616), Article IV(c)"
        ];
        footnotes.forEach(note => {
             y = drawWrappedText(page, note, font, smallFontSize, leftMargin, y, contentWidth, 11);
        });
        
        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating LIC 508 PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateSoc341aPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const pages = [pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage()];
        
        const mainFontSize = 9;
        const smallFontSize = 8;
        const titleFontSize = 11;
        const lineHeight = 11;

        const drawHeaderAndFooter = (page: any, pageNum: number, totalPages: number) => {
            const { width, height } = page.getSize();
            const leftMargin = 60;

            if (pageNum === 1) {
                drawText(page, "STATE OF CALIFORNIA - HEALTH AND HUMAN SERVICES AGENCY", { x: leftMargin, y: height - 40, font: boldFont, size: mainFontSize });
                drawText(page, "CALIFORNIA DEPARTMENT OF SOCIAL SERVICES", { x: leftMargin, y: height - 52, font: boldFont, size: mainFontSize });
            }

            const footerY = 30;
            drawText(page, "SOC 341A (3/15)", { x: leftMargin, y: footerY, font, size: smallFontSize });
            const pageNumText = `PAGE ${pageNum} OF ${totalPages}`;
            drawText(page, pageNumText, { x: width - leftMargin - font.widthOfTextAtSize(pageNumText, smallFontSize), y: footerY, font, size: smallFontSize });
        };
        
        pages.forEach((page, index) => drawHeaderAndFooter(page, index + 1, pages.length));
        
        let y = pages[0].getHeight() - 90;
        const leftMargin = 60;
        const contentWidth = pages[0].getWidth() - (leftMargin * 2);

        const title = "STATEMENT ACKNOWLEDGING REQUIREMENT TO REPORT SUSPECTED\nABUSE OF DEPENDENT ADULTS AND ELDERS";
        drawText(pages[0], title, { x: (pages[0].getWidth() / 2) - 170, y, font: boldFont, size: titleFontSize, lineHeight: 14 });
        y -= 40;

        const note = "NOTE: RETAIN IN EMPLOYEE/ VOLUNTEER FILE";
        drawText(pages[0], note, { x: (pages[0].getWidth() / 2) - (font.widthOfTextAtSize(note, smallFontSize) / 2), y, font, size: smallFontSize });
        y -= 25;

        // --- PAGE 1 ---
        y = drawWrappedText(pages[0], `NAME: ${formData.fullName || ''}     POSITION: Caregiver     FACILITY: FirstLight Home Care of Rancho Cucamonga`, font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "California law REQUIRES certain persons to report known or suspected abuse of dependent adults or elders. As an employee or volunteer at a licensed facility, you are one of those persons - a “mandated reporter.”", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[0], "PERSONS WHO ARE REQUIRED TO REPORT ABUSE", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "Mandated reporters include care custodians and any person who has assumed full or intermittent responsibility for care or custody of an elder or dependent adult, whether or not paid for that responsibility (Welfare and Institutions Code (WIC) Section 15630(a)). Care custodian means an administrator or an employee of most public or private facilities or agencies, or persons providing care or services for elders or dependent adults, including members of the support staff and maintenance staff (WIC Section 15610.17).", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[0], "PERSONS WHO ARE THE SUBJECT OF THE REPORT", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "Elder means any person residing in this state who is 65 years of age or older (WIC Section 15610.27). Dependent Adult means any person residing in this state, between the ages of 18 and 64, who has physical or mental limitations that restrict his or her ability to carry out normal activities or to protect his or her rights including, but not limited to, persons who have physical or developmental disabilities or whose physical or mental abilities have diminished because of age and those admitted as inpatients in 24-hour health facilities (WIC Section 15610.23).", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[0], "REPORTING RESPONSIBILITIES AND TIME FRAMES", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "Any mandated reporter, who in his or her professional capacity, or within the scope of his or her employment, has observed or has knowledge of an incident that reasonably appears to be abuse or neglect, or is told by an elder or dependent adult that he or she has experienced behavior constituting abuse or neglect, or reasonably suspects that abuse or neglect occurred, shall complete form SOC 341, “Report of Suspected Dependent Adult/Elder Abuse” for each report of known or suspected instance of abuse (physical abuse, sexual abuse, financial abuse, abduction, neglect (self-neglect), isolation, and abandonment) involving an elder or dependent adult.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[0], "Reporting shall be completed as follows:", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "• If the abuse occurred in a Long-Term Care (LTC) facility (as defined in WIC Section 15610.47) and resulted in serious bodily injury (as defined in WIC Section 15610.67), report by telephone to the local law enforcement agency immediately and no later than two (2) hours after observing, obtaining knowledge of, or suspecting physical abuse. Send the written report to the local law enforcement agency, the local Long-Term Care Ombudsman Program (LTCOP), and the appropriate licensing agency (for long-term health care facilities, the California Department of Public Health; for community care facilities, the California", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        
        // --- PAGE 2 ---
        y = pages[1].getHeight() - 70;
        y = drawWrappedText(pages[1], "Department of Social Services) within two (2) hours of observing, obtaining knowledge of, or suspecting physical abuse.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a LTC facility, was physical abuse, but did not result in serious bodily injury, report by telephone to the local law enforcement agency within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse. Send the written report to the local law enforcement agency, the local LTCOP, and the appropriate licensing agency (for long-term health care facilities, the California Department of Public Health; for community care facilities, the California Department of Social Services) within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a LTC facility, was physical abuse, did not result in serious bodily injury, and was perpetrated by a resident with a physician's diagnosis of dementia, report by telephone to the local law enforcement agency or the local LTCOP, immediately or as soon as practicably possible. Follow by sending the written report to the LTCOP or the local law enforcement agency within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a LTC facility, and was abuse other than physical abuse, report by telephone to the LTCOP or the law enforcement agency immediately or as soon as practicably possible. Follow by sending the written report to the local law enforcement agency or the LTCOP within two working days.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a state mental hospital or a state developmental center, mandated reporters shall report by telephone or through a confidential internet reporting tool (established in WIC Section 15658) immediately or as soon as practicably possible and submit the report within two (2) working days of making the telephone report to the responsible agency as identified below:", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a State Mental Hospital, report to the local law enforcement agency or the California Department of State Hospitals.", font, mainFontSize, leftMargin + 20, y, contentWidth - 20, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a State Developmental Center, report to the local law enforcement agency or to the California Department of Developmental Services.", font, mainFontSize, leftMargin + 20, y, contentWidth - 20, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• For all other abuse, mandated reporters shall report by telephone or through a confidential internet reporting tool to the adult protective services agency or the local law enforcement agency immediately or as soon as practicably possible. If reported by telephone, a written or an Internet report shall be sent to adult protective services or law enforcement within two working days.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[1], "PENALTY FOR FAILURE TO REPORT ABUSE", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "Failure to report abuse of an elder or dependent adult is a MISDEMEANOR CRIME, punishable by jail time, fine or both (WIC Section 15630(h)). The reporting duties are individual, and no supervisor or administrator shall impede or inhibit the reporting duties, and no person making the report shall be subject to any sanction for making the report (WIC Section 15630(f)).", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[1], "CONFIDENTIALITY OF REPORTER AND OF ABUSE REPORTS", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "The identity of all persons who report under WIC Chapter 11 shall be confidential and disclosed only.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight);

        // --- PAGE 3 ---
        y = pages[2].getHeight() - 70;
        y = drawWrappedText(pages[2], "among APS agencies, local law enforcement agencies, LTCOPs, California State Attorney General Bureau of Medi-Cal Fraud and Elder Abuse, licensing agencies or their counsel, Department of Consumer Affairs Investigators (who investigate elder and dependent adult abuse), the county District Attorney, the Probate Court, and the Public Guardian. Confidentiality may be waived by the reporter or by court order. Any violation of confidentiality is a misdemeanor punishable by jail time, fine, or both (WIC Section 15633(a)).", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y-=lineHeight*2;
        y = drawWrappedText(pages[2], "DEFINITIONS OF ABUSE", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[2], "Physical abuse means any of the following: (a) Assault, as defined in Section 240 of the Penal Code; (b) Battery, as defined in Section 242 of the Penal Code; (c) Assault with a deadly weapon or force likely to produce great bodily injury, as defined in Section 245 of the Penal Code; (d) Unreasonable physical constraint, or prolonged or continual deprivation of food or water; (e) Sexual assault, that means any of the following: (1) Sexual battery, as defined in Section 243.4 of the Penal Code; (2) Rape, as defined in Section 261 of the Penal Code; (3) Rape in concert, as described in Section 264.1 of the Penal Code; (4) Spousal rape, as defined in Section 262 of the Penal Code; (5) Incest, as defined in Section 285 of the Penal Code; (6) Sodomy, as defined in Section 286 of the Penal Code; (7) Oral copulation, as defined in Section 288a of the Penal Code; (8) Sexual penetration, as defined in Section 289 of the Penal Code; or (9) Lewd or lascivious acts as defined in paragraph (2) of subdivision (b) of Section 288 of the Penal Code; or (f) Use of a physical or chemical restraint or psychotropic medication under any of the following conditions: (1) For punishment; (2) For a period beyond that for which the medication was ordered pursuant to the instructions of a physician and surgeon licensed in the State of California, who is providing medical care to the elder or dependent adult at the time the instructions are given; or (3) For any purpose not authorized by the physician and surgeon (WIC Section 15610.63).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[2], "Serious bodily injury means an injury involving extreme physical pain, substantial risk of death, or protracted loss or impairment of function of a bodily member, organ, or of mental faculty, or requiring medical intervention, including, but not limited to, hospitalization, surgery, or physical rehabilitation (WIC Section 15610.67).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[2], "Neglect (a) means either of the following: (1) The negligent failure of any person having the care or custody of an elder or a dependent adult to exercise that degree of care that a reasonable person in a like position would exercise; or (2) The negligent failure of an elder or dependent adult to exercise that degree of self care that a reasonable person in a like position would exercise. (b) Neglect includes, but is not limited to, all of the following: (1) Failure to assist in personal hygiene, or in the provision of food, clothing, or shelter; (2) Failure to provide medical care for physical and mental health needs. No person shall be deemed neglected or abused for the sole reason that he or she voluntarily relies on treatment by spiritual means through prayer alone in lieu of medical treatment; (3) Failure to protect from health and safety hazards; (4) Failure to prevent malnutrition or dehydration; or (5) Failure of an elder or dependent adult to satisfy the needs specified in paragraphs (1) to (4), inclusive, for himself or herself as a result of poor cognitive functioning, mental limitation, substance abuse, or chronic poor health (WIC Section 15610.57).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[2], "Financial abuse of an elder or dependent adult occurs when a person or entity does any of the following: (1) Takes, secretes, appropriates, obtains, or retains real or personal property of an elder or dependent adult for a wrongful use or with intent to defraud, or both; (2) Assists in taking, secreting, appropriating, obtaining, or retaining real or personal property of an elder or dependent adult for a wrongful use or with intent to defraud, or both; or (3)", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);

        // --- PAGE 4 ---
        y = pages[3].getHeight() - 70;
        y = drawWrappedText(pages[3], "Takes, secretes, appropriates, obtains, or retains real or personal property of an elder or dependent adult by undue influence, as defined in Section 15610.70 (WIC Section 15610.30).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[3], "Abandonment means the desertion or willful forsaking of an elder or a dependent adult by anyone having care or custody of that person under circumstances in which a reasonable person would continue to provide care and custody (WIC Section 15610.05).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[3], "Isolation means any of the following: (1) Acts intentionally committed for the purpose of preventing, and that do serve to prevent, an elder or dependent adult from receiving his or her mail or telephone calls; (2) Telling a caller or prospective visitor that an elder or dependent adult is not present, or does not wish to talk with the caller, or does not wish to meet with the visitor where the statement is false, is contrary to the express wishes of the elder or the dependent adult, whether he or she is competent or not, and is made for the purpose of preventing the elder or dependent adult from having contact with family, friends, or concerned persons; (3) False imprisonment, as defined in Section 236 of the Penal Code; or (4) Physical restraint of an elder or dependent adult, for the purpose of preventing the elder or dependent adult from meeting with visitors (WIC Section 15610.43).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[3], "Abduction means the removal from this state and the restraint from returning to this state, or the restraint from returning to this state, of any elder or dependent adult who does not have the capacity to consent to the removal from this state and the restraint from returning to this state, or the restraint from returning to this state, as well as the removal from this state or the restraint from returning to this state, of any conservatee without the consent of the conservator or the court (WIC Section 15610.06).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[3], "AS AN EMPLOYEE OR VOLUNTEER OF THIS FACILITY, YOU MUST COMPLY WITH THE DEPENDENT ADULT AND ELDER ABUSE REQUIREMENTS, AS STATED ABOVE. IF YOU DO NOT COMPLY, YOU MAY BE SUBJECT TO CRIMINAL PENALTY. IF YOU ARE A LONG-TERM CARE OMBUDSMAN, YOU MUST COMPLY WITH FEDERAL AND STATE LAWS, WHICH PROHIBIT YOU FROM DISCLOSING THE IDENTITIES OF LONG-TERM RESIDENTS AND COMPLAINANTS TO ANYONE UNLESS CONSENT TO DISCLOSE IS PROVIDED BY THE RESIDENT OR COMPLAINANT OR DISCLOSURE IS REQUIRED BY COURT ORDER (Title 42 United States Code Section 3058g(d)(2); WIC Section 9725).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        
        const finalStatement = `I, ${formData.fullName || '[Your Name]'} have read and understand my responsibility to report known or suspected abuse of dependent adults or elders. I will comply with the reporting requirements.`;
        y = drawWrappedText(pages[3], finalStatement, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 30;

        if (formData.soc341aSignature) {
            await drawSignature(pages[3], formData.soc341aSignature, leftMargin + 80, y, 120, 24, pdfDoc);
        }
        pages[3].drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 250, y: y - 5 }, thickness: 0.5 });
        drawText(pages[3], "SIGNATURE", { x: leftMargin, y: y - 15, font, size: smallFontSize });

        const sigDate = (formData.soc341aSignatureDate && (formData.soc341aSignatureDate.toDate || isDate(formData.soc341aSignatureDate))) ? format(formData.soc341aSignatureDate.toDate ? formData.soc341aSignatureDate.toDate() : formData.soc341aSignatureDate, "MM/dd/yyyy") : '';
        if (sigDate) {
             drawText(pages[3], `DATE: ${sigDate}`, {x: leftMargin + 350, y: y+5, font, size: mainFontSize});
        }
        pages[3].drawLine({ start: { x: leftMargin + 340, y: y - 5 }, end: { x: leftMargin + 500, y: y - 5 }, thickness: 0.5 });


        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating SOC 341A PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}


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

export async function generateDrugAlcoholPolicyPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.3); // Enlarged logo
        
        const drawFieldBoxWithSignature = async (
            page: PDFPage,
            label: string,
            dateValue: string,
            sigValue: string | undefined,
            yPos: number,
            xPos: number,
            widthField: number
        ) => {
            if (sigValue) {
                await drawSignature(page, sigValue, xPos, yPos, 150, 20, pdfDoc);
            }
            page.drawLine({ start: { x: xPos, y: yPos - 5 }, end: { x: xPos + widthField, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, label, { x: xPos, y: yPos - 15, font, size: smallFontSize });

            if (dateValue) {
                drawText(page, dateValue, { x: xPos + widthField + 50, y: yPos, font, size: mainFontSize });
            }
            page.drawLine({ start: { x: xPos + widthField + 40, y: yPos - 5 }, end: { x: xPos + widthField + 150, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, "Date", { x: xPos + widthField + 40, y: yPos - 15, font, size: smallFontSize });
        };

        // --- Page 1 ---
        const page1 = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page1.getSize();
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;
        const lineHeight = 12;
        const mainFontSize = 10;
        const titleFontSize = 11;
        const smallFontSize = 8;
        
        page1.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: height - 50 - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });
        
        let y = height - 140;

        const title = "DRUG AND/OR ALCOHOL TESTING CONSENT FORM";
        drawText(page1, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, titleFontSize) / 2), y, font: boldFont, size: titleFontSize });
        y -= 15;
        const subTitle = "EMPLOYEE AGREEMENT AND CONSENT TO DRUG AND/OR ALCOHOL TESTING";
        drawText(page1, subTitle, { x: (width / 2) - (boldFont.widthOfTextAtSize(subTitle, titleFontSize) / 2), y, font: boldFont, size: titleFontSize });
        y -= 30;

        const p1 = `I hereby agree, upon a request made under the drug/alcohol testing policy of FirstLight HomeCare to submit to a drug or alcohol test and to furnish a sample of my saliva, urine, breath, and/or blood for analysis. I understand and agree that if I, at any time, refuse to submit to a drug or alcohol test under company policy, or if I otherwise fail to cooperate with the testing procedures, I will be subject to immediate termination. I further authorize and give full permission to have FirstLight HomeCare and/or a physician designated by FirstLight HomeCare send the specimen or specimens so collected to a laboratory for a screening test for the presence of any prohibited substances under the policy, and for the laboratory or other testing facility to release any and all documentation relating to such test to FirstLight HomeCare and/or to any governmental entity involved in a legal proceeding or investigation connected with the test. Finally, I authorize the FirstLight HomeCare to disclose any documentation relating to such test to any governmental entity involved in a legal proceeding or investigation connected with the test.`;
        y = drawWrappedText(page1, p1, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight;

        const p2 = `I understand that only duly-authorized FirstLight HomeCare officers, employees, and agents will have access to information furnished or obtained in connection with the test; that they will maintain and protect the confidentiality of such information to the greatest extent possible; and that they will share such information only to the extent necessary to make employment decisions and to respond to inquiries or notices from government entities.`;
        y = drawWrappedText(page1, p2, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);

        // --- Page 2 ---
        const page2 = pdfDoc.addPage(PageSizes.Letter);
        y = height - 70; // Reset y for new page

        const p3 = `I will hold harmless FirstLight HomeCare, its designated physician, and any testing laboratory that FirstLight HomeCare might use, meaning that I will not sue or hold responsible such parties for any alleged harm to me that might result from such testing, including loss of employment or any other kind of adverse job action that might arise as a result of the drug or alcohol test, even if FirstLight HomeCare officers, employees, and agents or laboratory representative makes an error in the administration or analysis of the test or the reporting of the results. I will further hold harmless FirstLight HomeCare, its designated physician, test vendor and any testing laboratory FirstLight HomeCare might use for any alleged harm to me that might result from the release or use of information or documentation relating to the drug or alcohol test, as long as the release or use of the information is within the scope of this policy and the procedures as explained in the paragraph above.`;
        y = drawWrappedText(page2, p3, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight;

        const p4 = `This policy and authorization have been explained to me in a language I understand, and I have been told that if I have any questions about the test or the policy, they will be answered.`;
        y = drawWrappedText(page2, p4, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 2;
        
        const p5 = `I UNDERSTAND FIRSTLIGHT HOMECARE WILL REQUIRE A DRUG SCREEN AND/OR ALCOHOL TEST UNDER THIS POLICY PRIOR TO EMPLOYMENT, WHENEVER I AM INVOLVED IN AN ON-THE-JOB ACCIDENT OR INJURY UNDER CIRCUMSTANCES THAT SUGGEST POSSIBLE INVOLVEMENT OR INFLUENCE OF DRUGS OR ALCOHOL IN THE ACCIDENT OR INJURY EVENT, AND I AGREE TO SUBMIT TO ANY SUCH TEST.`;
        y = drawWrappedText(page2, p5, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 40;

        // Signatures
        const employeeSigDate = (formData.drugAlcoholPolicySignatureDate && (formData.drugAlcoholPolicySignatureDate.toDate || isDate(formData.drugAlcoholPolicySignatureDate))) ? format(formData.drugAlcoholPolicySignatureDate.toDate ? formData.drugAlcoholPolicySignatureDate.toDate() : formData.drugAlcoholPolicySignatureDate, "MM/dd/yyyy") : '';
        await drawFieldBoxWithSignature(page2, "Signature of Employee", employeeSigDate, formData.drugAlcoholPolicySignature, y, leftMargin, 200);
        y -= 40;
        
        page2.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 350, y: y - 5 }, thickness: 0.5 });
        if (formData.drugAlcoholPolicyEmployeePrintedName) drawText(page2, formData.drugAlcoholPolicyEmployeePrintedName, {x: leftMargin + 5, y: y, font, size: mainFontSize});
        drawText(page2, "Employee's Name - Printed", {x: leftMargin, y: y-15, font, size: smallFontSize});
        y -= 40;

        const repSigDate = (formData.drugAlcoholPolicyRepDate && (formData.drugAlcoholPolicyRepDate.toDate || isDate(formData.drugAlcoholPolicyRepDate))) ? format(formData.drugAlcoholPolicyRepDate.toDate ? formData.drugAlcoholPolicyRepDate.toDate() : formData.drugAlcoholPolicyRepDate, "MM/dd/yyyy") : '';
        await drawFieldBoxWithSignature(page2, "FirstLight HomeCare Representative", repSigDate, formData.drugAlcoholPolicyRepSignature, y, leftMargin, 200);
        y -= 60;
        
        // Test Results
        drawText(page2, "TEST RESULTS – ORAL SALIVA", {x: (width / 2) - (boldFont.widthOfTextAtSize("TEST RESULTS – ORAL SALIVA", 10) / 2), y, font: boldFont, size: 10});
        y -= 20;
        drawText(page2, "______________ Negative", {x: leftMargin + 100, y, font, size: mainFontSize});
        drawText(page2, "______________ Positive _______________Drug", {x: leftMargin + 250, y, font, size: mainFontSize});
        y -= 40;

        drawText(page2, "TEST RESULTS – BLOOD", {x: (width / 2) - (boldFont.widthOfTextAtSize("TEST RESULTS – BLOOD", 10) / 2), y, font: boldFont, size: 10});
        y -= 20;
        drawText(page2, "______________ Negative", {x: leftMargin + 100, y, font, size: mainFontSize});
        drawText(page2, "______________ Positive _______________Drug", {x: leftMargin + 250, y, font, size: mainFontSize});

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Drug Alcohol Policy PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

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

export async function generateArbitrationAgreementPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.15);

        const drawFooter = (page: PDFPage, pageNum: number) => {
            const { width } = page.getSize();
            const footerTextLeft = "MUTUAL ARBITRATION AGREEMENT\nPolicy:\nStandard:\nOriginal:\nRevision:";
            const footerTextCenter = `Page ${pageNum} of 4`;
            const footerY = 30;
            const fontSize = 8;
            
            drawText(page, footerTextLeft, {
                x: 50,
                y: footerY + 30, // Adjust start y for multiline
                font,
                size: fontSize,
                lineHeight: 10
            });
            
            const centerTextWidth = font.widthOfTextAtSize(footerTextCenter, fontSize);
            drawText(page, footerTextCenter, {
                x: (width / 2) - (centerTextWidth / 2),
                y: footerY,
                font,
                size: fontSize
            });
        };
        
        const pages = [pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage()];
        pages.forEach((page, index) => {
            if (index > 0) { // Footer on pages 2, 3, 4
                drawFooter(page, index + 1);
            }
        });

        // --- Page 1 ---
        let page = pages[0];
        const { width, height } = page.getSize();
        const leftMargin = 50;
        const topMargin = height - 50;
        const contentWidth = width - (leftMargin * 2);
        const lineHeight = 11;
        const mainFontSize = 9;

        page.drawImage(logoImage, {
            x: leftMargin,
            y: topMargin - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        let y = topMargin - logoDims.height - 20;

        const title = "MUTUAL ARBITRATION AGREEMENT";
        drawText(page, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, 14) / 2), y, font: boldFont, size: 14 });
        y -= 30;
        
        const introText = "This Mutual Arbitration Agreement is a contract and covers important issues relating to your rights. It is your sole responsibility to read it and understand it. You are free to seek assistance from independent advisors of your choice outside the Company or to refrain from doing so if that is your choice.\n\nEl Acuerdo Mutuo de Arbitraje es un contrato y cubre aspectos importantes de sus derechos. Es tu absoluta responsabilidad leerlo y entenderlo. Tienes la libertad de buscar asistencia de asesores independientes de su elección fuera de la Compañia o de abstenerte de buscar asistencia si esa es su elección.";
        page.drawRectangle({x: leftMargin, y: y-65, width: contentWidth, height: 75, borderColor: rgb(0,0,0), borderWidth: 2});
        y = drawWrappedText(page, introText, font, 8, leftMargin + 5, y - 5, contentWidth - 10, 9);
        y -= 75;

        const textPage1 = [
            "1. This Mutual Arbitration Agreement (“Agreement”) is between Employee and [FIRSTLIGHT HOME CARE OF RANCHO CUCAMONGA] (“COMPANY”). The Federal Arbitration Act (9 U.S.C. §§ 1 et seq.) governs this Agreement, which evidences a transaction involving commerce. EXCEPT AS THIS AGREEMENT OTHERWISE PROVIDES, ALL DISPUTES COVERED BY THIS AGREEMENT WILL BE DECIDED BY AN ARBITRATOR THROUGH FINAL AND BINDING ARBITRATION AND NOT BY WAY OF COURT OR JURY TRIAL.",
            "2. COVERED CLAIMS/DISPUTES. Except as otherwise provided in this Agreement, this Agreement applies to any and all disputes, past, present or future, that may arise between Employee (sometimes “you” or “your”) and COMPANY, including without limitation any dispute arising out of or related to Employee’s application, employment and/or separation of employment with COMPANY. This Agreement applies to a covered dispute that COMPANY may have against Employee or that Employee may have against COMPANY, its parent companies, subsidiaries, related companies and affiliates, franchisors, or their officers, directors, principals, shareholders, members, owners, employees, and managers or agents, each and all of which may enforce this Agreement as direct or third-party beneficiaries.",
            "The claims subject to arbitration are those that absent this Agreement could be brought under applicable law. Except as it otherwise provides, this Agreement applies, without limitation, to claims based upon or related to the application for employment, background checks, privacy, the employment relationship, discrimination, harassment, retaliation, defamation (including claims of post-employment defamation or retaliation), breach of a contract or covenant, fraud, negligence, emotional distress, breach of fiduciary duty, trade secrets, unfair competition, wages, minimum wage and overtime or other compensation claimed to be owed, breaks and rest periods, expense reimbursement, seating, termination, tort claims, equitable claims, and all statutory and common law claims unless specifically excluded below. Except as it otherwise provides, the Agreement covers, without limitation, claims arising under the Fair Credit Reporting Act, Defend Trade Secrets Act, Title VII of the Civil Rights Act of 1964, 42 U.S.C. § 1981, the Americans With Disabilities Act, the Age Discrimination in Employment Act, the Family Medical Leave Act, the Fair Labor Standards Act, Rehabilitation Act, the Civil Rights Acts of 1866 and 1871, the Civil Rights Act of 1991, 8 U.S.C. § 1324 (unfair immigration related practices), the Pregnancy Discrimination Act, the Equal Pay Act, the Genetic Information Non-Discrimination Act, Employee Retirement Income Security Act of 1974 (except for claims for employee benefits under any benefit plan sponsored by the COMPANY and (a) covered by the Employee Retirement Income Security Act of 1974 or (b) funded by insurance), Affordable Care Act, Uniformed Services Employment and Reemployment Rights Act, Worker Adjustment and Retraining Notification Act, Older Workers Benefit Protection Act of 1990, False Claims Act, Occupational Safety and Health Act, Consolidated Omnibus Reconciliation Act of 1985, and state statutes or regulations, if any, addressing the same or similar subject matters, and all other federal or state legal claims arising out of or relating to Employee’s employment or the termination of employment.",
            "Additionally, except as provided in this Section 3 of this Agreement, Employee and the COMPANY agree that the arbitrator shall have exclusive authority to resolve any dispute relating to the scope, validity, conscionability, interpretation, applicability, or enforceability of this Agreement."
        ];

        for (const paragraph of textPage1) {
             const isBold = paragraph.startsWith("1.") || paragraph.startsWith("2.");
             const textToDraw = isBold ? paragraph.substring(3) : paragraph;
             const label = isBold ? paragraph.substring(0, 3) : "";

             if(isBold) {
                 drawText(page, label, {x: leftMargin, y, font: boldFont, size: mainFontSize});
                 y = drawWrappedText(page, textToDraw, font, mainFontSize, leftMargin + 15, y, contentWidth - 15, lineHeight);
             } else {
                 y = drawWrappedText(page, paragraph, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
             }
             y -= lineHeight;
        }

        // --- PAGE 2 ---
        page = pages[1];
        y = topMargin;
        const textPage2 = [
            { text: "EXCLUDED CLAIMS/DISPUTES. This Agreement does not apply to litigation between you and COMPANY pending in a state or federal court or arbitration as of the date of your receipt of this Agreement and in which you are a party or a member or putative member of an alleged class (“pending litigation”). If that pending litigation is subject to an agreement to arbitrate between Employee and the Company, that agreement will remain in full force and effect to that extent. The Agreement also does not apply to claims for worker’s compensation benefits, state disability insurance or unemployment insurance benefits; however, this Agreement applies to retaliation claims related to such benefits, such as claims for worker’s compensation retaliation.", isBold: false },
            { text: "Nothing contained in this Agreement shall be construed to prevent or excuse you (individually or in concert with others) or the COMPANY from utilizing the COMPANY's existing internal procedures for resolution of complaints, and this Agreement is not intended to be a substitute for the utilization of such procedures. In addition, either party may apply to a court of competent jurisdiction for temporary or preliminary injunctive relief in connection with an arbitrable controversy in accordance with applicable law, and any such application shall not be deemed incompatible with or waiver of this agreement to arbitrate. The court to which the application is made is authorized to consider the merits of the arbitrable controversy to the extent it deems necessary in making its ruling, but only to the extent permitted by applicable law. All determinations of final relief, however, will be decided in arbitration.", isBold: false },
            { text: "Nothing in this Agreement prevents you from making a report to or filing a claim or charge with a government agency, including without limitation the Equal Employment Opportunity Commission, U.S. Department of Labor, U.S. Securities and Exchange Commission, National Labor Relations Board, Occupational Health and Safety Administration or the Office of Federal Contract Compliance Programs. Nothing in this Agreement prevents the investigation by a government agency of any report, claim or charge otherwise covered by this Agreement. This Agreement also does not prevent federal administrative agencies from adjudicating claims and awarding remedies based on those claims, even if the claims would otherwise be covered by this Agreement. Nothing in this Agreement prevents or excuses a party from satisfying any conditions precedent and/or exhausting administrative remedies under applicable law before bringing a claim in arbitration. The COMPANY will not retaliate against you for filing a claim with an administrative agency or for exercising rights (individually or in concert with others) under Section 7 of the National Labor Relations Act.", isBold: false },
            { text: "This Agreement does not apply to any claim that an applicable federal statute states cannot be arbitrated or subject to a pre-dispute arbitration agreement.", isBold: false },
            { text: "3. CLASS AND COLLECTIVE ACTION WAIVER. Private attorney general representative actions brought on behalf of the state under the California Labor Code are not arbitrable, not within the scope of this Agreement and may be maintained in a court of law.. However, this Agreement affects your ability to otherwise participate in class and collective actions. Both you and COMPANY agree to bring any dispute in arbitration on an individual basis only, and not on a class or collective action basis on behalf of others. There will be no right or authority for any dispute to be brought, heard or arbitrated as a class or collective action and the arbitrator will have no authority to hear or preside over any such claim (\"Class Action Waiver\"). Regardless of anything else in this Agreement and/or the American Arbitration Association (“AAA\") Rules (described below), any dispute relating to the scope,, validity, conscionability, interpretation, applicability, or enforceability of the Class Action Waiver, or any dispute relating to whether this Arbitration Agreement precludes a class or collective action proceeding, may only be determined by a court and not an arbitrator. In any case in which (1) the dispute is filed as a class or collective action and (2) there is a final judicial determination that all or part of the Class Action Waiver is unenforceable, the class or collective action to that extent must be litigated in a civil court of competent jurisdiction, but the portion of the Class Action Waiver that is enforceable shall be enforced in arbitration. You will not be retaliated against, disciplined or threatened with discipline by the filing of or participation in a class or collective action in any forum. However, COMPANY may lawfully seek enforcement of this Agreement and the Class Action Waiver under the Federal Arbitration Act and seek dismissal of such class or collective actions or claims. The Class Action Waiver shall be severable in any case in which the dispute is filed as an individual action and severance is necessary to ensure that the individual action proceeds in arbitration.", isBold: true },
            { text: "4. ARBITRATOR SELECTION. If the claim is not resolved via informal resolution, the parties will proceed to arbitration before a single arbitrator and in accordance with the then current American Arbitration Association (“AAA”) Employment Arbitration Rules (“AAA Rules”) (the AAA Rules may be found at www.adr.org or by searching for “AAA Employment Arbitration Rules” using a service such as www.Google.com), however, that if there is a conflict between the AAA Rules and this", isBold: true }
        ];

        for(const item of textPage2) {
            const fontToUse = item.isBold ? boldFont : font;
            const text = item.text;
            if (item.text.startsWith("3.") || item.text.startsWith("4.")) {
                drawText(page, text.substring(0,2), {x: leftMargin, y, font: boldFont, size: mainFontSize});
                y = drawWrappedText(page, text.substring(3), font, mainFontSize, leftMargin + 15, y, contentWidth - 15, lineHeight);
            } else {
                 y = drawWrappedText(page, text, fontToUse, mainFontSize, leftMargin, y, contentWidth, lineHeight);
            }
             y -= lineHeight;
        }

        // --- PAGE 3 ---
        page = pages[2];
        y = topMargin;
        const textPage3 = [
            { text: "Agreement, this Agreement will govern. Unless the parties mutually agree otherwise, the Arbitrator will be either an attorney experienced in employment law or a retired judge. The AAA will give each party a list of eleven (11) arbitrators drawn from its panel of arbitrators. Ten days after AAA’s transmission of the list of neutrals, AAA will convene a telephone conference and the parties will strike names alternately from the list of common names, until only one remains. The party who strikes first will be determined by a coin toss. The person that remains will be designated as the Arbitrator. If for any reason, the individual selected cannot serve as the Arbitrator, AAA will issue another list of eleven (11) arbitrators and repeat the alternate striking selection process. If for any reason the AAA will not administer the arbitration, either party may apply to a court of competent jurisdiction with authority over the location where the arbitration will be conducted to appoint a neutral Arbitrator.", isBold: false },
            { text: "5. INITIATING ARBITRATION. A party who wishes to arbitrate a claim covered by this Agreement must make a written Request for Arbitration and deliver it to the other party by hand or mail no later than the expiration of the statute of limitations (deadline for filing) that applicable law prescribes for the claim. The Request for Arbitration shall identify the claims asserted, the factual basis for the claim(s), and the relief and/or remedy sought. The Arbitrator will resolve all disputes regarding the timeliness or propriety of the Request for Arbitration and apply the statute of limitations that would have applied if the claim(s) had been brought in court.", isBold: true },
            { text: "6. RULES/STANDARDS GOVERNING PROCEEDING. The Arbitrator may award any remedy to which a party is entitled under applicable law, but remedies are limited to those that would be available to a party in his or her individual capacity in a court of law for the claims presented to and decided by the Arbitrator, and no remedies that otherwise would be available to an individual under applicable law will be forfeited by this Agreement. Each party can take the deposition of one individual witness and any expert witness designated by another party. Each party also has the right to make requests for production of documents to any party. The parties can jointly agree to more discovery, and either party can ask the Arbitrator to order more discovery. Each party will also have the right to subpoena witnesses and documents for the arbitration, including documents relevant to the case from third parties. At least thirty (30) days before the final hearing, the parties must exchange a list of witnesses, excerpts of depositions to be introduced, and copies of all exhibits to be used.", isBold: true },
            { text: "Unless the parties jointly agree in writing otherwise, the arbitration will take place in or near the city and in the same state in which Employee is or was last employed by the COMPANY. The Arbitrator has the authority to hear and rule on pre-hearing disputes. The Arbitrator will have the authority to hear and decide a motion to dismiss and/or a motion for summary judgment by any party, consistent with Rule 12 or Rule 56 of the Federal Rules of Civil Procedure, and must set a briefing schedule for such motions upon the request of either party. The Arbitrator will issue a written decision or award, stating the essential findings of fact and conclusions of law. A court of competent jurisdiction will have the authority to enter judgment upon the Arbitrator’s decision/award.", isBold: false },
            { text: "7. PAYMENT OF FEES. The COMPANY will pay the Arbitrator’s and arbitration fees and costs, except for the filing fee as required by the AAA. If you are financially unable to pay a filing fee, the COMPANY will pay the filing fee, and you will be relieved of the obligation to pay the filing fee. Disputes regarding the apportionment of fees will be decided by the Arbitrator. Each party will pay for its own costs and attorneys' fees, if any, but if any party prevails on a claim which affords the prevailing party costs or attorneys' fees, the Arbitrator may award costs and fees to the prevailing party as provided by law.", isBold: true },
            { text: "8. ENTIRE AGREEMENT/SEVERABILITY. Except as provided in Section 2, above, regarding pending litigation, this Agreement replaces all prior agreements regarding the arbitration of disputes and is the full and complete agreement relating to the resolution of disputes covered by this Agreement. If any portion of this Agreement is deemed invalid, void, voidable or otherwise unenforceable, the unenforceable provision will be severed from the Agreement and the remainder of the Agreement will be enforceable. This Agreement will survive the termination of Employee’s employment and the expiration of any benefit. This Agreement will also continue to apply notwithstanding any change in Employee’s duties, responsibilities, position, or title, or if Employee transfers to any affiliate of the COMPANY. This Agreement does not alter the \"at-will\" status of Employee’s employment. Notwithstanding any contrary language in any COMPANY policy or employee handbook, this Agreement may not be modified or terminated absent consent by both parties.", isBold: true },
            { text: "9. CONSIDERATION. The COMPANY and Employee agree that the mutual obligations by the COMPANY and Employee to arbitrate disputes provide adequate consideration for this Agreement.", isBold: true },
            { text: "10. EFFECTIVE DATE. By signing this Agreement, it becomes effective immediately. However, should EMPLOYEE not sign this", isBold: true }
        ];

         for(const item of textPage3) {
            const fontToUse = item.isBold ? boldFont : font;
            const text = item.text;
            if (/^\d+\./.test(text)) {
                drawText(page, text.substring(0,2), {x: leftMargin, y, font: boldFont, size: mainFontSize});
                y = drawWrappedText(page, text.substring(3), font, mainFontSize, leftMargin + 15, y, contentWidth - 15, lineHeight);
            } else {
                 y = drawWrappedText(page, text, fontToUse, mainFontSize, leftMargin, y, contentWidth, lineHeight);
            }
             y -= lineHeight;
        }

        // --- PAGE 4 ---
        page = pages[3];
        y = topMargin;
        const textPage4 = [
            {text: "Agreement, continuing your employment with the COMPANY for a period of 30 days after your receipt of this Agreement constitutes mutual acceptance of the terms of this Agreement commencing upon completion of that 30-day period, and the Agreement will be binding on you and the Company. You have the right to consult with counsel of your choice concerning this Agreement.", isBold: false},
        ];
        
        for(const item of textPage4) {
             const fontToUse = item.isBold ? boldFont : font;
             y = drawWrappedText(page, item.text, fontToUse, mainFontSize, leftMargin, y, contentWidth, lineHeight);
             y -= lineHeight;
        }

        y -= 30;
        drawText(page, "AGREED: [FIRSTLIGHT HOME CARE OF RANCHO CUCAMONGA]", {x: leftMargin, y, font: boldFont, size: mainFontSize});
        y -= 20;
        drawText(page, "RECEIVED AND AGREED:", {x: leftMargin, y, font: boldFont, size: mainFontSize});
        y -= 40;

        if (formData.arbitrationAgreementSignature) await drawSignature(page, formData.arbitrationAgreementSignature, leftMargin, y, 200, 20, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y-5 }, end: { x: leftMargin + 250, y: y - 5 }, thickness: 0.5 });
        drawText(page, "APPLICANT/EMPLOYEE SIGNATURE", {x: leftMargin, y: y-15, font, size: 8});

        const sigDate = (formData.arbitrationAgreementSignatureDate && (formData.arbitrationAgreementSignatureDate.toDate || isDate(formData.arbitrationAgreementSignatureDate))) ? format(formData.arbitrationAgreementSignatureDate.toDate ? formData.arbitrationAgreementSignatureDate.toDate() : formData.arbitrationAgreementSignatureDate, "MM/dd/yyyy") : '';
        if (sigDate) drawText(page, sigDate, {x: leftMargin + 300, y, font, size: mainFontSize});
        page.drawLine({ start: { x: leftMargin + 280, y: y - 5 }, end: { x: leftMargin + 430, y: y - 5 }, thickness: 0.5 });
        drawText(page, "DATE", {x: leftMargin + 280, y: y-15, font, size: 8});
        y -= 30;

        if(formData.applicantPrintedName) drawText(page, formData.applicantPrintedName, {x: leftMargin, y, font, size: mainFontSize});
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 300, y: y - 5 }, thickness: 0.5 });
        drawText(page, "APPLICANT/EMPLOYEE NAME PRINTED", {x: leftMargin, y: y-15, font, size: 8});


        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Mutual Arbitration Agreement PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

export async function generateEmployeeOrientationAgreementPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.3);

        const addPageContent = async (page: PDFPage, content: { text: string; isBold?: boolean; isList?: boolean }[], startY: number, leftMargin: number, contentWidth: number, lineHeight: number, mainFontSize: number) => {
            let y = startY;
            for (const item of content) {
                const fontToUse = item.isBold ? boldFont : font;
                const indent = item.isList ? 15 : 0;
                y = drawWrappedText(page, item.text, fontToUse, mainFontSize, leftMargin + indent, y, contentWidth - indent, lineHeight);
                y -= lineHeight * (item.isList ? 0.5 : 1);
                 if (y < 60) {
                    return y; // Stop if we're near the bottom of the page
                }
            }
            return y;
        };

        const page1 = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page1.getSize();
        const leftMargin = 60;
        const contentWidth = width - (leftMargin * 2);
        const lineHeight = 11;
        const mainFontSize = 9;

        page1.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: height - 50 - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        let y = height - 120;
        const title = "EMPLOYEE ORIENTATION AGREEMENT";
        drawText(page1, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, 14) / 2), y, font: boldFont, size: 14 });
        y -= 30;

        const page1Content = [
            { text: "I certify that I have received a copy of the FirstLight Employee Manual or have access to the online version and will read and familiarize myself with its contents. I understand that the FirstLight Home Care Administrator or Care Coordinator will answer any questions I may have regarding the contents of the document.", isBold: false },
            { text: "I understand that the policies contained in the Manual are intended for guidance only, and may be unilaterally amended by FirstLight without notice.", isBold: false },
            { text: "I further understand that the FirstLight Manual does not create a contract of employment, but rather my employment with FirstLight is on an at-will basis. As such, I am free to resign at anytime, and FirstLight may end my employment at anytime, for any reason or no reason at all, with or without notice.", isBold: false },
            { text: "I further agree to follow the policies and procedures, which are emphasized during my orientation as outlined below:", isBold: false },
            { text: "EMPLOYMENT POLICIES:", isBold: true },
            { text: "• I understand that as a FirstLight employee I will begin employment on a 90-day probationary period. Work performance and punctuality will be monitored and documented during this time.", isList: true },
            { text: "• I understand FirstLight payroll procedures and cycle.", isList: true },
            { text: "• I further understand that I will not be paid unless I follow the clock-in and clock-out procedure outlined in the Clock-In Instructions document and Caregiver Portal Brochure.", isList: true },
            { text: "• I understand that only neat and clean attire are considered appropriate dress for assignments.", isList: true },
            { text: "• I will not actively seek employment with a FirstLight customer.", isList: true },
            { text: "• I further understand that accepting employment with a FirstLight customer in which I was placed on an assignment can result in monies owed to FirstLight by the Client and myself of up to $5,000.", isList: true },
            { text: "• If I am unable to report to work or if I will be late, I will call FirstLight four (4) business hours prior to the start of my assignment. If I do not report to work and fail to call with an explanation, my action will be considered a \"voluntary resignation\".", isList: true },
            { text: "• I understand that switching shifts or days with other FirstLight employees without prior authorization from FirstLight staff approval is not allowed.", isList: true },
            { text: "• FirstLight employees are authorized to schedule shifts with institutional work site managers without prior authorization of FirstLight staff. Please notify the office as soon as possible to ensure the schedule reflects the change.", isList: true },
            { text: "• I understand that FirstLight cannot control customer cancellations of shifts assigned.", isList: true },
        ];

        y = await addPageContent(page1, page1Content, y, leftMargin, contentWidth, lineHeight, mainFontSize);
        
        const page2 = pdfDoc.addPage(PageSizes.Letter);
        y = height - 70; // Reset y for new page

        const page2Content = [
            { text: "• I understand that if I call off for two(2) or more consecutive shifts(days) for medical reasons, I may be asked to provide a doctor's clearance to work prior to future scheduling of shifts.", isList: true },
            { text: "• I understand the Communicable Disease guidelines and will report changes in my health status to FirstLight.", isList: true },
            { text: "• I understand that repeated tardiness for scheduled shifts will result in customer requests not to schedule me on future assignments. This can also result in termination of employment with FirstLight.", isList: true },
            { text: "• I understand that, if available, I have the option of choosing whether to have benefits(health insurance and paid vacation time) or to be paid more money per hour if I do not need or want benefits. It is my responsibility to complete the benefits enrollment process within the time period stated. I understand that I must enroll for FirstLight benefits within my first 90 days of employment. If I choose not to, or fail to enroll by this date, I will not be able to enroll for benefits until the next open enrollment period(subject to change).", isList: true },
            { text: "• I will not smoke in a client’s home, even if that client is a smoker.", isList: true },
            { text: "• I am obligated to notify FirstLight by the next working day if I am being investigated by any governmental agency for any act, offense or omission, including an investigation related to the abuse or neglect, or threat of abuse or neglect to a child or other client, or an investigation related to misappropriation of a client’s property.", isList: true },
            { text: "• I understand that my image reflects directly upon FirstLight.", isList: true },
            { text: "• I will conduct myself professionally, will not use profanity, and will not disclose a client’s personal information to anyone.", isList: true },
            { text: "• I understand that the sale or use of drugs and/or intoxicating beverages while on a FirstLight assignment is strictly prohibited.", isList: true },
            { text: "• I understand that I may be tested and checked for drugs and/or alcohol if I am injured on the job and go to a medical facility for treatment.", isList: true },
            { text: "• If I am injured while in the course of my work, I will report the injury to my supervisor and to FirstLight at once. Any incident involving the client will be reported to FirstLight as soon as possible.", isList: true },
            { text: "• I have been familiarized with the forms I am expected to complete while working in the field.", isList: true },
            { text: "• I am aware that I should contact the office if I think a client could benefit from assistance from other community agencies.", isList: true },
            { text: "• I agree to finish all the training assigned to be before I get client assignment. I understand that I may not be provided a client assignment if the training is not completed.", isList: true },
        ];

        y = await addPageContent(page2, page2Content, y, leftMargin, contentWidth, lineHeight, mainFontSize);
        
        y -= 40;

        // Signature section on page 2
        const drawSigLine = (label: string, value: string | undefined, sigData: string | undefined, yPos: number) => {
            page2.drawLine({start: {x: leftMargin, y: yPos - 5}, end: {x: leftMargin + contentWidth, y: yPos - 5}, thickness: 0.5});
            drawText(page2, label, {x: leftMargin, y: yPos - 15, font, size: 8});
            if (value) drawText(page2, value, {x: leftMargin + 5, y: yPos, font, size: mainFontSize});
            if (sigData) drawSignature(page2, sigData, leftMargin + 5, yPos-2, 200, 20, pdfDoc);
        }
        
        const empName = formData.orientationAgreementEmployeeName;
        drawSigLine("Employee Name (Printed)", empName, undefined, y);
        y -= 40;
        
        const empSigDate = (formData.orientationAgreementSignatureDate && (formData.orientationAgreementSignatureDate.toDate || isDate(formData.orientationAgreementSignatureDate))) ? format(formData.orientationAgreementSignatureDate.toDate ? formData.orientationAgreementSignatureDate.toDate() : formData.orientationAgreementSignatureDate, "MM/dd/yyyy") : '';
        drawSigLine("Employee Signature", undefined, formData.orientationAgreementSignature, y);
        drawText(page2, `Date: ${empSigDate}`, {x: leftMargin + 350, y, font, size: mainFontSize});
        y -= 40;
        
        const witnessSigDate = (formData.orientationAgreementWitnessDate && (formData.orientationAgreementWitnessDate.toDate || isDate(formData.orientationAgreementWitnessDate))) ? format(formData.orientationAgreementWitnessDate.toDate ? formData.orientationAgreementWitnessDate.toDate() : formData.orientationAgreementWitnessDate, "MM/dd/yyyy") : '';
        drawSigLine("FirstLight Home Care Witness", undefined, formData.orientationAgreementWitnessSignature, y);
        drawText(page2, `Date: ${witnessSigDate}`, {x: leftMargin + 350, y, font, size: mainFontSize});

        const pdfBytes = await pdfDoc.save();
        return { success: true, pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Employee Orientation Agreement PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}


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
    


