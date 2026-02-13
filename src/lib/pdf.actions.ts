
'use server';

import { Buffer } from 'buffer';
import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont } from 'pdf-lib';
import { format, isDate } from 'date-fns';

// Helper to sanitize text for pdf-lib
function sanitizeText(text: string | null | undefined): string {
    if (!text) return '';
    // This regex removes most control characters that can cause issues with pdf-lib fonts
    // It keeps standard characters, newlines, and carriage returns.
    return text.replace(/[^\p{L}\p{N}\p{P}\p{Z}\r\n]/gu, '');
}

// Standardized helper to draw text using an options object
function drawText(page: any, text: string | undefined, options: { x: number; y: number; font: PDFFont; size: number; color?: any; }) {
    if (text) {
        page.drawText(sanitizeText(text), options);
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
    
    const words = text.split(' ');
    let line = '';
    let currentY = y;

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

        page.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: y,
            width: logoDims.width,
            height: logoDims.height,
        });
        y -= (logoDims.height) + 5; 

        const title = "FIRSTLIGHT HOMECARE REFERENCE VERIFICATION FORM";
        const titleWidth = boldFont.widthOfTextAtSize(title, 10);
        page.drawRectangle({
            x: (width / 2) - (titleWidth / 2) - 5,
            y: y - 4,
            width: titleWidth + 10,
            height: 18,
            color: rgb(0, 0, 0),
        });
        drawText(page, title, {
            x: (width / 2) - (titleWidth / 2),
            y: y,
            font: boldFont,
            size: 10,
            color: rgb(1, 1, 1),
        });
        y -= 15;
        
        const pleasePrint = "PLEASE PRINT";
        drawText(page, pleasePrint, {x: leftMargin, y: y, font, size: 6});
        y -= 2;
        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 0.5 });
        y -= 12;

        drawText(page, `Applicant’s First Name Middle Last: ${formData.fullName || ''}`, {x: leftMargin, y, font, size: 6});
        y -= 12;

        const permissionText = "I hereby give FirstLight HomeCare permission to obtain the employment references necessary to make a hiring decision and hold all persons giving references free from any and all liability resulting from this process. I waive any provision impeding the release of this information and agree to provide any information necessary for the release of this information beyond that provided on the employment application and this reference verification form.";
        y = drawWrappedText(page, permissionText, font, 6, leftMargin, y, contentWidth, 8);
        y -= 15;
        
        if (formData.applicantSignature) {
            await drawSignature(page, formData.applicantSignature, leftMargin + 80, y - 5, 120, 24, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: y - 10 }, end: { x: leftMargin + 300, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Signature", {x: leftMargin, y: y-20, font, size: 6});

        const sigDate = (formData.applicantSignatureDate && (formData.applicantSignatureDate.toDate || isDate(formData.applicantSignatureDate))) ? format(formData.applicantSignatureDate.toDate ? formData.applicantSignatureDate.toDate() : formData.applicantSignatureDate, "MM/dd/yyyy") : '';
        if (sigDate) {
             drawText(page, `Date: ${sigDate}`, {x: leftMargin + 350, y, font, size: 6});
        }
        page.drawLine({ start: { x: leftMargin + 340, y: y-10 }, end: { x: leftMargin + 500, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Date", {x: leftMargin + 340, y: y-20, font, size: 6});
        y -= 25;

        const employerBoxStartY = y;
        drawText(page, "FORMER EMPLOYER CONTACT INFORMATION", {x: leftMargin, y, font: boldFont, size: 6});
        y -= 12;

        const drawTwoColumnField = (label1: string, value1: string | undefined, label2: string, value2: string | undefined) => {
            const smallFontSize = 6;
            drawText(page, `${label1}: ${value1 || ''}`, {x: leftMargin + 5, y, font, size: smallFontSize});
            drawText(page, `${label2}: ${value2 || ''}`, {x: leftMargin + contentWidth / 2, y, font, size: smallFontSize});
            y -= 9;
        };

        drawTwoColumnField("Company", formData.company, "Supervisor’s Name and Title", formData.supervisorName);
        drawTwoColumnField("Email and/or Fax #", formData.emailOrFax, "Phone", formData.phone);
        drawTwoColumnField("Dates of Employment", formData.employmentDates, "Position", formData.position);
        drawTwoColumnField("Starting Salary:", formData.startingSalary, "Ending Salary:", formData.endingSalary);
        
        const employerBoxEndY = y;
        page.drawRectangle({x: leftMargin - 5, y: employerBoxEndY, width: contentWidth+10, height: employerBoxStartY - employerBoxEndY + 5, borderColor: rgb(0,0,0), borderWidth: 1});
        y -= 12;

        const referenceBoxStartY = y;
        drawText(page, "REFERENCE INFORMATION", {x: leftMargin, y, font: boldFont, size: 6});
        y -= 8;
        drawText(page, "Please rate yourself in the following categories as you feel your former supervisor will rate you:", {x: leftMargin, y, font, size: 6});
        y -= 8;

        const drawRating = (label: string, value: string | undefined) => {
            const smallFontSize = 6;
            y = drawWrappedText(page, label, boldFont, smallFontSize, leftMargin + 5, y, contentWidth - 10, 7);
            y -= 7;
            if(value) drawText(page, `Rating: ${value}`, {x: leftMargin + 15, y, font, size: smallFontSize});
            y -= 10;
        };

        drawRating("TEAMWORK: The degree to which you are willing to work harmoniously with others; the extent to which you conform to the policies of management.", formData.teamworkRating);
        drawRating("DEPENDABILITY: The extent to which you can be depended upon to be available for work and do it properly; the degree to which you are reliable and trustworthy; the extent to which you are able to work scheduled days and times, as well as your willingness to work additional hours if needed.", formData.dependabilityRating);
        drawRating("INITIATIVE: The degree to which you act independently in new situations; the extent to which you see what needs to be done and do it without being told; the degree to which you do your best to be an outstanding employee.", formData.initiativeRating);
        drawRating("QUALITY: The degree to which your work is free from errors and mistakes; the extent to which your work is accurate; the quality of your work in general.", formData.qualityRating);
        drawRating("CUSTOMER SERVICE: The degree to which you relate to the customer’s needs and/or concerns.", formData.customerServiceRating);
        drawRating("OVERALL PERFORMANCE: The degree to which your previous employer was satisfied with your efforts and achievements, as well as your eligibility for rehire.", formData.overallPerformanceRating);
        
        const referenceBoxEndY = y;
        page.drawRectangle({x: leftMargin - 5, y: referenceBoxEndY, width: contentWidth+10, height: referenceBoxStartY - referenceBoxEndY + 5, borderColor: rgb(0,0,0), borderWidth: 1});
        
        y -= 12;
        const drawYesNo = (label: string, value: string | undefined, yPos: number, xPos: number) => {
            drawText(page, `${label}: ${value || ''}`, {x: xPos, y: yPos, font, size: 6});
        };

        drawYesNo("Did you resign from this position?", formData.resignationStatus, y, leftMargin);
        drawYesNo("Discharged?", formData.dischargedStatus, y, leftMargin + 250);
        drawYesNo("Laid-Off?", formData.laidOffStatus, y, leftMargin + 400);
        y -= 9;
        drawYesNo("Are you eligible for rehire?", formData.eligibleForRehire, y, leftMargin);
        drawYesNo("Were you ever disciplined on the job?", formData.wasDisciplined, y, leftMargin + 250);
        y -= 9;
        if (formData.wasDisciplined === 'Yes' && formData.disciplineExplanation) {
            y = drawWrappedText(page, `Explain: ${formData.disciplineExplanation}`, font, 6, leftMargin, y, contentWidth, 8);
        }
        y-=9;
        drawWrappedText(page, "Someone from FirstLight HomeCare will be following up with your shortly regarding the employment reference verification check. If you have any questions, please call: 909-321-4466", font, 6, leftMargin, y, contentWidth, 8);

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
        
        const drawHeaderAndFooter = (page: any, pageNum: number) => {
            const { width, height } = page.getSize();
            const headerY = height - 30;
            const footerY = 30;
            const fontSize = 11; 

            drawText(page, "State of California - Health and Human Services Agency", { x: 50, y: headerY, font, size: fontSize });
            drawText(page, "California Department of Social Services", { x: width - font.widthOfTextAtSize("California Department of Social Services", fontSize) - 50, y: headerY, font, size: fontSize });

            drawText(page, "LIC 508 (7/21)", { x: 50, y: footerY, font, size: fontSize });
            drawText(page, `Page ${pageNum} of 5`, { x: width - font.widthOfTextAtSize(`Page ${pageNum} of 5`, fontSize) - 50, y: footerY, font, size: fontSize });
        };

        pages.forEach((page, index) => drawHeaderAndFooter(page, index + 1));
        
        // --- PAGE 1 ---
        let page = pages[0];
        let { width, height } = page.getSize();
        let y = height - 70;
        const leftMargin = 60;
        const rightMargin = width - 60;
        const contentWidth = rightMargin - leftMargin;
        const mainFontSize = 11.5;
        const titleFontSize = 16;
        const smallFontSize = 11;
        const lineHeight = 15; 

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
        drawText(page, 'Have you ever been convicted of a crime in California?', {x: leftMargin + 100, y, font: boldFont, size: mainFontSize});
        y -= 15;
        
        const p1_line2 = "You do not need to disclose any marijuana-related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7.";
        y = drawWrappedText(page, p1_line2, font, smallFontSize, leftMargin, y, contentWidth, 12);
        y -= 20;

        drawCheckbox(page, formData.convictedOutOfState === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.convictedOutOfState === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        y = drawWrappedText(page, 'Have you ever been convicted of a crime from another state, federal court, military, or jurisdiction outside of U.S.?', boldFont, mainFontSize, leftMargin + 100, y, contentWidth - 100, lineHeight);
        y -= 15;
        
        const p1_line3 = "You do not need to disclose convictions that were a result of one's status as a victim of human trafficking and that were dismissed pursuant to Penal Code Section 1203.49, nor any marijuana related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7. However you are required to disclose convictions that were dismissed pursuant to Penal Code Section 1203.4(a)";
        y = drawWrappedText(page, p1_line3, font, smallFontSize, leftMargin, y, contentWidth, 12);
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
        drawText(page, 'Have you lived in a state other than California within the last five years?', {x: leftMargin + 100, y, font: boldFont, size: mainFontSize});
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
        const labelFontSize_p2 = 11;
        
        const p2_note = "NOTE: IF THE CRIMINAL BACKGROUND CHECK REVEALS ANY CONVICTION(S) THAT YOU DID NOT REPORT ON THIS FORM BY CHECKING YES, YOUR FAILURE TO DISCLOSE THE CONVICTION(S) MAY RESULT IN AN EXEMPTION DENIAL, APPLICATION DENIAL, LICENSE REVOCATION, DECERTIFICATION, RESCISSION OF APPROVAL, OR EXCLUSION FROM A LICENSED FACILITY, CERTIFIED FAMILY HOME, OR THE HOME OF A RESOURCE FAMILY.";
        y = drawWrappedText(page, p2_note, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 20;

        const p2_move_note = "If you move or change your mailing address, you must send your updated information to the Caregiver Background Check Bureau within 10 days to:";
        y = drawWrappedText(page, p2_move_note, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        drawText(page, "Caregiver Background Check Bureau", { x: leftMargin + 20, y, font: boldFont, size: mainFontSize }); y -= lineHeight;
        drawText(page, "744 P Street, M/S T9-15-62", { x: leftMargin + 20, y, font, size: mainFontSize }); y -= lineHeight;
        drawText(page, "Sacramento, CA 95814", { x: leftMargin + 20, y, font, size: mainFontSize });
        y -= 20;

        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1 });
        y -= 20;
        
        const drawFieldBox_p2 = (page: any, label: string, value: string | undefined, x: number, yPos: number, boxWidth: number) => {
            drawText(page, label, {x, y: yPos + 12, font, size: labelFontSize_p2});
            page.drawRectangle({x, y: yPos-12, width: boxWidth, height: 20, borderColor: rgb(0,0,0), borderWidth: 0.5});
            if(value) drawText(page, value, {x: x + 5, y: yPos-7, font, size: mainFontSize});
        };
        
        drawFieldBox_p2(page, "FACILITY/ORGANIZATION/AGENCY NAME:", "FirstLight Home Care of Rancho Cucamonga", leftMargin, y + 12, 300);
        drawFieldBox_p2(page, "FACILITY/ORGANIZATION/AGENCY NUMBER:", "364700059", leftMargin + 320, y + 12, contentWidth - 320);
        y -= lineHeight * 2;

        drawFieldBox_p2(page, "YOUR NAME (print clearly):", formData.fullName, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 2;

        drawFieldBox_p2(page, "Street Address:", formData.address, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 2;

        drawFieldBox_p2(page, "City", formData.city, leftMargin, y + 12, 200);
        drawFieldBox_p2(page, "State", formData.state, leftMargin + 220, y + 12, 100);
        drawFieldBox_p2(page, "Zip Code", formData.zip, leftMargin + 340, y + 12, contentWidth - 340);
        y -= lineHeight * 2;

        drawFieldBox_p2(page, "SOCIAL SECURITY NUMBER:", formData.ssn, leftMargin, y + 12, 200);
        drawFieldBox_p2(page, "DRIVER’S LICENSE NUMBER/STATE:", formData.driversLicenseNumber, leftMargin + 220, y + 12, contentWidth - 220);
        y -= lineHeight * 2;

        const dobDateForField_p2 = (formData.dob && (formData.dob.toDate || isDate(formData.dob))) ? format(formData.dob.toDate ? formData.dob.toDate() : formData.dob, "MM/dd/yyyy") : '';
        drawFieldBox_p2(page, "DATE OF BIRTH:", dobDateForField_p2, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 2;

        if (formData.lic508Signature) await drawSignature(page, formData.lic508Signature, leftMargin + 5, y, 290, 20, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 300, y: y - 5 }, color: rgb(0, 0, 0), thickness: 0.5 });
        drawText(page, "SIGNATURE:", { x: leftMargin, y: y - 15, font, size: labelFontSize_p2 });

        const sigDateForField_p2 = (formData.lic508SignatureDate && (formData.lic508SignatureDate.toDate || isDate(formData.lic508SignatureDate))) ? format(formData.lic508SignatureDate.toDate ? formData.lic508SignatureDate.toDate() : formData.lic508SignatureDate, "MM/dd/yyyy") : '';
        drawFieldBox_p2(page, "DATE:", sigDateForField_p2, leftMargin + 320, y + 12, contentWidth - 320);
        y -= 40;

        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1 });
        y -= 15;

        const instructionsLicensees_p2 = "Instructions to Licensees:";
        drawText(page, instructionsLicensees_p2, { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        const p2_inst1 = "If the person discloses that they have ever been convicted of a crime, maintain this form in your facility/organization personnel file and send a copy to your Licensed Program Analyst (LPA) or assigned analyst.";
        y = drawWrappedText(page, p2_inst1, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        const instructionsRegional_p2 = "Instructions to Regional Offices and Foster Family Agencies:";
        drawText(page, instructionsRegional_p2, { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        const p2_inst2 = "If ‘Yes’ is indicated in any box above, forward a copy of this completed form (and the LIC 198B, as applicable) to the Caregiver Background Check Bureau, 744 P Street, MS T9-15-62, Sacramento, CA 95814.";
        y = drawWrappedText(page, p2_inst2, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 2;
        const p2_inst3 = "If ‘No’ is indicated above in all boxes, keep this completed form in the facility file.";
        y = drawWrappedText(page, p2_inst3, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);

        // --- PAGE 3 ---
        page = pages[2];
        y = height - 70;
        let boxStartY_p3 = y + 10;
        
        drawText(page, "Privacy Notice", { x: (width / 2) - (boldFont.widthOfTextAtSize("Privacy Notice", titleFontSize) / 2), y, font: boldFont, size: titleFontSize }); y -= 15;
        drawText(page, "As Required by Civil Code § 1798.17", { x: (width / 2) - (font.widthOfTextAtSize("As Required by Civil Code § 1798.17", smallFontSize) / 2), y, font, size: smallFontSize }); y -= 25;

        y = drawWrappedText(page, "Collection and Use of Personal Information. The California Justice Information Services (CJIS) Division in the Department of Justice (DOJ) collects the information requested on this form as authorized by Penal Code sections 11100-11112; Health and Safety Code sections 1522, 1569.10-1569.24, 1596.80-1596.879; Family Code sections 8700-87200; Welfare and Institutions Code sections 16500-16523.1; and other various state statutes and regulations. The CJIS Division uses this information to process requests of authorized entities that want to obtain information as to the existence and content of a record of state or federal convictions to help determine suitability for employment, or volunteer work with children, elderly, or disabled; or for adoption or purposes of a license, certification, or permit. In addition, any personal information collected by state agencies is subject to the limitations in the Information Practices Act and state policy. The DOJ’s general privacy policy is available at http://oag.ca.gov/privacy-policy.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;
        y = drawWrappedText(page, "Providing Personal Information. All the personal information requested in the form must be provided. Failure to provide all the necessary information will result in delays and/or the rejection of your request. Notice is given for the request of the Social Security Number (SSN) on this form. The California Department of Justice uses a person’s SSN as an identifying number. The requested SSN is voluntary. Failure to provide the SSN may delay the processing of this form and the criminal record check.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;
        y = drawWrappedText(page, "Access to Your Information. You may review the records maintained by the CJIS Division in the DOJ that contain your personal information, as permitted by the Information Practices Act. See below for contact information.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;
        y = drawWrappedText(page, "Possible Disclosure of Personal Information. In order to be licensed, work at, or be present at, a licensed facility/organization, or be placed on a registry administered by the Department, the law requires that you complete a criminal background check. (Health and Safety Code sections 1522, 1568.09, 1569.17 and 1596.871). The Department will create a file concerning your criminal background check that will contain certain documents, including personal information that you provide. You have the right to access certain records containing your personal information maintained by the Department (Civil Code section 1798 et seq.). Under the California Public Records Act (Government Code section 6250 et seq.), the Department may have to provide copies of some of the records in the file to members of the public who ask for them, including newspaper and television reporters.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;
        
        y = drawWrappedText(page, "NOTE: IMPORTANT INFORMATION", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y = drawWrappedText(page, "The Department is required to tell people who ask, including the press, if someone in a licensed facility/ organization has a criminal record exemption. The Department must also tell people who ask the name of a licensed facility/organization that has a licensee, employee, resident, or other person with a criminal record exemption. This does not apply to Resource Family Homes, Small Family Child Care Homes, or the Home Care Aide Registry. The Department shall not release any information regarding Home Care Aides in response to a Public Records Act request, other than their Home Care Aide number.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;
        
        y = drawWrappedText(page, "The information you provide may also be disclosed in the following circumstances:", font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y = drawWrappedText(page, "• With other persons or agencies where necessary to perform their legal duties, and their use of your information is compatible and complies with state law, such as for investigations or for licensing, certification, or regulatory purposes.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        y = drawWrappedText(page, "• To another government agency as required by state or federal law.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        
        let boxEndY_p3 = y - 20;
        page.drawRectangle({ x: leftMargin - 10, y: boxEndY_p3, width: contentWidth + 20, height: boxStartY_p3 - boxEndY_p3, borderColor: rgb(0,0,0), borderWidth: 1 });

        // --- PAGE 4 ---
        page = pages[3];
        y = height - 70;
        let boxStartY_p4 = y + 10;

        drawText(page, "Contact Information", { x: leftMargin, y, font: boldFont, size: mainFontSize }); y -= (lineHeight + 5);

        y = drawWrappedText(page, "For questions about this notice, CDSS programs, and the authorized use of your criminal history information, please contact your local licensing regional office.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 15;
        y = drawWrappedText(page, "For further questions about this notice or your criminal records, you may contact the Associate Governmental Program Analyst at the DOJ’s Keeper of Records at (916) 210-3310, by email at keeperofrecords@doj.ca.gov, or by mail at:", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 15;

        drawText(page, "Department of Justice", { x: leftMargin + 20, y, font: boldFont, size: mainFontSize }); y -= lineHeight;
        drawText(page, "Bureau of Criminal Information & Analysis Keeper of Records", { x: leftMargin + 20, y, font, size: mainFontSize }); y -= lineHeight;
        drawText(page, "P.O. Box 903417", { x: leftMargin + 20, y, font, size: mainFontSize }); y -= lineHeight;
        drawText(page, "Sacramento, CA 94203-4170", { x: leftMargin + 20, y, font, size: mainFontSize }); y -= 20;
        
        const anrcTitle = "Applicant Notification and Record Challenge";
        drawText(page, anrcTitle, { x: (width / 2) - (boldFont.widthOfTextAtSize(anrcTitle, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight;
        y = drawWrappedText(page, "Your fingerprints will be used to check the criminal history records of the FBI. You have the opportunity to complete or challenge the accuracy of the information contained in the FBI identification record. The procedure for obtaining a change, correction, or updating an FBI identification record are set forth in Title 28, CFR, 16.34. You can find additional information on the FBI website at https://www.fbi.gov/about-us/cjis/background-checks.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;

        const fpasTitle = "Federal Privacy Act Statement";
        drawText(page, fpasTitle, { x: (width / 2) - (boldFont.widthOfTextAtSize(fpasTitle, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight;

        y = drawWrappedText(page, "Authority: The FBI’s acquisition, preservation, and exchange of fingerprints and associated information is generally authorized under 28 U.S.C. 534. Depending on the nature of your application, supplemental authorities include Federal statutes, State statutes pursuant to Pub. L. 92-544, Presidential Executive Orders, and federal regulations. Providing your fingerprints and associated information is voluntary; however, failure to do so may affect completion or approval of your application.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;
        y = drawWrappedText(page, "Principal Purpose: Certain determinations, such as employment, licensing, and security clearances, may be predicated on fingerprint-based background checks. Your fingerprints and associated information/biometrics may be provided to the employing, investigating, or otherwise responsible agency, and/or the FBI for the purpose of comparing your fingerprints to other fingerprints in the FBI’s Next Generation Identification (NGI) system or its successor systems (including civil, criminal, and latent fingerprint repositories) or other available records of the employing, investigating, or otherwise responsible agency. The FBI may retain your fingerprints and associated information/biometrics in NGI after the completion of this application and, while retained, your fingerprints may continue to be compared against other fingerprints submitted to or retained by NGI.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;
        y = drawWrappedText(page, "Routine Uses: During the processing of this application and for as long thereafter as your fingerprints and associated information/biometrics are retained in NGI, your information may be disclosed pursuant to your consent, and may be disclosed without your consent as permitted by the Privacy Act of 1974 and all applicable Routine Uses as may be published at any time in the Federal Register, including the Routine Uses for the NGI system and the FBI’s Blanket Routine Uses. Routine uses include, but are not limited to, disclosures to:", font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y = drawWrappedText(page, "• employing, governmental or authorized non-governmental agencies responsible for employment, contracting, licensing, security clearances, and other suitability determinations;", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        y = drawWrappedText(page, "• local, state, tribal, or federal law enforcement agencies; criminal justice agencies; and agencies responsible for national security or public safety.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= 20;
        
        const njarprTitle = "Noncriminal Justice Applicant’s Privacy Rights";
        drawText(page, njarprTitle, { x: (width / 2) - (boldFont.widthOfTextAtSize(njarprTitle, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight;
        y = drawWrappedText(page, "As an applicant who is the subject of a national fingerprint-based criminal history record check for a noncriminal justice purpose (such as an application for employment or a license, an immigration or naturalization matter, security clearance, or adoption), you have certain rights which are discussed below.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        
        let boxEndY_p4 = y - 10;
        page.drawRectangle({ x: leftMargin - 10, y: boxEndY_p4, width: contentWidth + 20, height: boxStartY_p4 - boxEndY_p4, borderColor: rgb(0,0,0), borderWidth: 1 });

        // --- PAGE 5 ---
        page = pages[4];
        y = height - 70;
        let boxStartY_p5 = y + 10;
        
        const page5_items = [
            "You must be provided written notification(1) that your fingerprints will be used to check the criminal history records of the FBI.",
            "You must be provided, and acknowledge receipt of, an adequate Privacy Act Statement when you submit your fingerprints and associated personal information. This Privacy Act Statement should explain the authority for collecting your information and how your information will be used, retained, and shared.(2)",
            "If you have a criminal history record, the officials making a determination of your suitability for the employment, license, or other benefit must provide you the opportunity to complete or challenge the accuracy of the information in the record.",
            "The officials must advise you that the procedures for obtaining a change, correction, or update of your criminal history record are set forth at Title 28, Code of Federal Regulations (CFR), Section 16.34.",
            "If you have a criminal history record, you should be afforded a reasonable amount of time to correct or complete the record (or decline to do so) before the officials deny you the employment, license, or other benefit based on information in the criminal history record.(3)",
            "You have the right to expect that officials receiving the results of the criminal history record check will use it only for authorized purposes and will not retain or disseminate it in violation of federal statute, regulation or executive order, or rule, procedure or standard established by the National Crime Prevention and Privacy Compact Council.(4)"
        ];
        
        page5_items.forEach(item => {
            y = drawWrappedText(page, `• ${item}`, font, mainFontSize, leftMargin + 10, y, contentWidth - 20, lineHeight);
        });

        y = drawWrappedText(page, "If agency policy permits, the officials may provide you with a copy of your FBI criminal history record for review and possible challenge. If agency policy does not permit it to provide you a copy of the record, you may obtain a copy of the record by submitting fingerprints and a fee to the FBI. Information regarding this process may be obtained at https://www.fbi.gov/services/cjis/identity-history-summary-checks.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y = drawWrappedText(page, "If you decide to challenge the accuracy or completeness of your FBI criminal history record, you should send your challenge to the agency that contributed the questioned information to the FBI. Alternatively, you may send your challenge directly to the FBI. The FBI will then forward your challenge to the agency that contributed the questioned information and request the agency to verify or correct the challenged entry. Upon receipt of an official communication from that agency, the FBI will make any necessary changes/corrections to your record in accordance with the information supplied by that agency. (See 28 CFR 16.30 through 16.34.) You can find additional information on the FBI website at https://www.fbi.gov/about-us/cjis/background-checks.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= 20;

        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y-= 15;

        drawText(page, "(1) Written notification includes electronic notification, but excludes oral notification.", { x: leftMargin, y, font, size: smallFontSize }); y -= 10;
        drawText(page, "(2) https://www.fbi.gov/services/cjis/compact-council/privacy-act-statement", { x: leftMargin, y, font, size: smallFontSize }); y -= 10;
        drawText(page, "(3) See 28 CFR 50.12(b)", { x: leftMargin, y, font, size: smallFontSize }); y -= 10;
        drawText(page, "(4) See U.S.C. 552a(b); 28 U.S.C. 534(b); 34 U.S.C. § 40316 (formerly cited as 42 U.S.C. § 14616), Article IV(c)", { x: leftMargin, y, font, size: smallFontSize });


        let boxEndY_p5 = y - 10;
        page.drawRectangle({ x: leftMargin - 10, y: boxEndY_p5, width: contentWidth + 20, height: boxStartY_p5 - boxEndY_p5, borderColor: rgb(0,0,0), borderWidth: 1 });
        
        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating LIC 508 PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
