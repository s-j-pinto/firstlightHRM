
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
            page.drawText(line, { x: x, y: currentY, font, size: fontSize });
            line = word + ' ';
            currentY -= lineHeight;
        } else {
            line = testLine;
        }
    }
    if (line.trim().length > 0) {
        page.drawText(line.trim(), { x: x, y: currentY, font, size: fontSize });
    }
    
    return line.trim() ? currentY - lineHeight : y; 
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

        let y = height - 50; 
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;

        const lineSpacing = 22; // Increased spacing
        const sectionSpacing = 28;
        const mainFontSize = 11;
        const titleFontSize = 14;
        const labelFontSize = 10;
        const headerFontSize = 9; 
        const subTitleFontSize = 8;
        const lightGray = rgb(0.92, 0.92, 0.92);
        
        y -= 10; // Move everything up a bit

        // Header
        drawText(page, 'State of California – Health and Human Services Agency', { x: leftMargin, y, font, size: headerFontSize });
        const rightHeaderText1 = 'Community Care Licensing Division';
        drawText(page, rightHeaderText1, { x: width - font.widthOfTextAtSize(rightHeaderText1, headerFontSize) - leftMargin, y, font, size: headerFontSize });
        y -= 12;
        drawText(page, 'California Department of Social Services', { x: leftMargin, y, font, size: headerFontSize });
        const rightHeaderText2 = 'Home Care Services Bureau';
        drawText(page, rightHeaderText2, { x: width - font.widthOfTextAtSize(rightHeaderText2, headerFontSize) - leftMargin, y, font, size: headerFontSize });
        
        y -= 25;

        // Title
        const title = "PERSONNEL RECORD";
        drawText(page, title, { x: leftMargin, y, font: boldFont, size: titleFontSize });
        y -= sectionSpacing;

        // Personal Record Pane
        page.drawRectangle({ x: leftMargin - 10, y: y - 85, width: contentWidth + 20, height: 95, color: lightGray });

        const subTitle = '(Form to be kept current at all times) FOR HOME CARE ORGANIZATION (HCO) USE ONLY';
        drawText(page, subTitle, { x: (width / 2) - (font.widthOfTextAtSize(subTitle, subTitleFontSize)/2) , y, font, size: subTitleFontSize });
        y -= lineSpacing * 2;

        const drawFieldBox = (label: string, value: string | undefined, x: number, yPos: number, boxWidth: number) => {
            drawText(page, label, {x, y: yPos + 12, font, size: labelFontSize}); // label
            page.drawRectangle({x, y: yPos-12, width: boxWidth, height: 20, borderColor: rgb(0,0,0), borderWidth: 0.5});
            if(value) drawText(page, value, {x: x + 5, y: yPos-7, font, size: mainFontSize}); // value
        }

        drawFieldBox("HCO Number", "364700059", leftMargin, y, 180);
        drawFieldBox("Employee’s PER ID", formData.perId, leftMargin + 200, y, 180);
        y -= lineSpacing * 2;
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
        y -= lineSpacing * 2;

        const fullAddress = [formData.address, formData.city, formData.state, formData.zip].filter(Boolean).join(', ');
        drawFieldBox("Address", fullAddress, leftMargin, y, contentWidth);
        y -= lineSpacing * 1.5; 

        const dobDate = (formData.dob && formData.dob.toDate) ? format(formData.dob.toDate(), "MM/dd/yyyy") : (isDate(formData.dob) ? format(formData.dob, "MM/dd/yyyy") : '');
        drawFieldBox("Date of Birth", dobDate, leftMargin, y, 200);
        drawFieldBox("Social Security Number (Voluntary for ID only)", formData.ssn, leftMargin + 220, y, contentWidth-220);
        y -= lineSpacing * 2;

        const tbDate = (formData.tbDate && formData.tbDate.toDate) ? format(formData.tbDate.toDate(), "MM/dd/yyyy") : (isDate(formData.tbDate) ? format(formData.tbDate, "MM/dd/yyyy") : '');
        drawFieldBox("Date of TB Test Upon Hire", tbDate, leftMargin, y, 200);
        drawFieldBox("Results of Last TB Test", formData.tbResults, leftMargin + 220, y, contentWidth - 220);
        y -= lineSpacing * 2;

        drawFieldBox("Additional TB Test Dates (Please include test results)", formData.additionalTbDates, leftMargin, y, contentWidth);
        y -= lineSpacing * 2;

        drawFieldBox("Please list any alternate names used (For example - maiden name)", formData.alternateNames, leftMargin, y, contentWidth);
        y -= lineSpacing * 2;

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
        y -= lineSpacing * 2 + 5; 
        
        drawText(page, "Notes:", {x: leftMargin, y: y+12, font, size: labelFontSize});
        page.drawRectangle({x: leftMargin, y: y-35, width: contentWidth, height: 40, borderColor: rgb(0,0,0), borderWidth: 0.5});
        if (formData.hcs501Notes) y = drawWrappedText(page, formData.hcs501Notes, font, mainFontSize, leftMargin + 5, y - 5, contentWidth - 10, lineSpacing);
        y -= 50; 

        // Certify Pane
        page.drawRectangle({ x: leftMargin - 10, y: y - 80, width: contentWidth + 20, height: 95, color: lightGray });

        const certifyText = "I hereby certify under penalty of perjury that I am 18 years of age or older and that the above statements are true and correct. I give my permission for any necessary verification.";
        y = drawWrappedText(page, certifyText, boldFont, 10, leftMargin, y, contentWidth - 20, 14);
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
        const logoDims = logoImage.scale(0.25);

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
        y -= logoDims.height + 5; // Reduced space

        const title = "FIRSTLIGHT HOMECARE REFERENCE VERIFICATION FORM";
        const titleWidth = boldFont.widthOfTextAtSize(title, 14);
        page.drawRectangle({
            x: (width / 2) - (titleWidth / 2) - 5,
            y: y - 5,
            width: titleWidth + 10,
            height: 20,
            color: rgb(0, 0, 0),
        });
        drawText(page, title, {
            x: (width / 2) - (titleWidth / 2),
            y: y,
            font: boldFont,
            size: 14,
            color: rgb(1, 1, 1),
        });
        y -= 20;
        
        const pleasePrint = "PLEASE PRINT";
        drawText(page, pleasePrint, { x: leftMargin, y: y, font, size: 8 });
        y -= 5;
        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1 });
        y -= 15;

        drawText(page, `Applicant’s First Name Middle Last: ${formData.fullName || ''}`, {x: leftMargin, y, font, size: 8});
        y -= 15;

        const permissionText = "I hereby give FirstLight HomeCare permission to obtain the employment references necessary to make a hiring decision and hold all persons giving references free from any and all liability resulting from this process. I waive any provision impeding the release of this information and agree to provide any information necessary for the release of this information beyond that provided on the employment application and this reference verification form.";
        y = drawWrappedText(page, permissionText, font, 8, leftMargin, y, contentWidth, 10);
        y -= 20;
        
        if (formData.applicantSignature) {
            await drawSignature(page, formData.applicantSignature, leftMargin + 80, y - 5, 150, 30, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: y - 10 }, end: { x: leftMargin + 300, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Signature", {x: leftMargin, y: y-20, font, size: 7});

        if (formData.applicantSignatureDate && (formData.applicantSignatureDate.toDate || isDate(formData.applicantSignatureDate))) {
            const dateToFormat = formData.applicantSignatureDate.toDate ? formData.applicantSignatureDate.toDate() : formData.applicantSignatureDate;
             drawText(page, `Date: ${format(dateToFormat, "MM/dd/yyyy")}`, {x: leftMargin + 350, y, font, size: 8});
        }
        page.drawLine({ start: { x: leftMargin + 340, y: y-10 }, end: { x: leftMargin + 500, y: y - 10 }, thickness: 0.5 });
        drawText(page, "Date", {x: leftMargin + 340, y: y-20, font, size: 7});
        y -= 30;

        const employerBoxStartY = y;
        drawText(page, "FORMER EMPLOYER CONTACT INFORMATION", {x: leftMargin, y, font: boldFont, size: 9});
        y -= 15;

        const drawTwoColumnField = (label1: string, value1: string | undefined, label2: string, value2: string | undefined) => {
            if (value1) drawText(page, `${label1}: ${value1}`, {x: leftMargin + 5, y, font, size: 7});
            if (value2) drawText(page, `${label2}: ${value2}`, {x: leftMargin + contentWidth / 2, y, font, size: 7});
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
        drawText(page, "REFERENCE INFORMATION", {x: leftMargin, y, font: boldFont, size: 9});
        y -= 10;
        drawText(page, "Please rate yourself in the following categories as you feel your former supervisor will rate you:", {x: leftMargin, y, font, size: 7});
        y -= 12;

        const drawRating = (label: string, value: string | undefined) => {
            y = drawWrappedText(page, label, boldFont, 7, leftMargin + 5, y, contentWidth - 10, 9);
            y -= 4; // Reduced space
            if(value) drawText(page, `Rating: ${value}`, {x: leftMargin + 15, y, font, size: 7});
            y -= 10; // Reduced space
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
            if (value) {
                drawText(page, `${label}: ${value}`, {x: xPos, y: yPos, font, size: 7});
            }
        };

        drawYesNo("Did you resign from this position?", formData.resignationStatus, y, leftMargin);
        drawYesNo("Discharged?", formData.dischargedStatus, y, leftMargin + 250);
        drawYesNo("Laid-Off?", formData.laidOffStatus, y, leftMargin + 400);
        y -= 12;
        drawYesNo("Are you eligible for rehire?", formData.eligibleForRehire, y, leftMargin);
        drawYesNo("Were you ever disciplined on the job?", formData.wasDisciplined, y, leftMargin + 250);
        y -= 12;
        if (formData.wasDisciplined === 'Yes' && formData.disciplineExplanation) {
            y = drawWrappedText(page, `Explain: ${formData.disciplineExplanation}`, font, 7, leftMargin, y, contentWidth, 9);
        }
        y-=12;
        drawWrappedText(page, "Someone from FirstLight HomeCare will be following up with your shortly regarding the employment reference verification check. If you have any questions, please call: 909-321-4466", font, 7, leftMargin, y, contentWidth, 9);

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
            const fontSize = 8;

            drawText(page, "State of California – Health and Human Services Agency", { x: 50, y: headerY, font, size: fontSize });
            drawText(page, "California Department of Social Services", { x: width - font.widthOfTextAtSize("California Department of Social Services", fontSize) - 50, y: headerY, font, size: fontSize });

            drawText(page, "LIC 508 (7/21)", { x: 50, y: footerY, font, size: fontSize });
            drawText(page, `Page ${pageNum} of 5`, { x: width - font.widthOfTextAtSize(`Page ${pageNum} of 5`, fontSize) - 50, y: footerY, font, size: fontSize });
        };

        pages.forEach((page, index) => drawHeaderAndFooter(page, index + 1));
        
        let page = pages[0];
        const { width, height } = page.getSize();
        let y = height - 70;
        const leftMargin = 60;
        const rightMargin = width - 60;
        const contentWidth = rightMargin - leftMargin;
        const mainFontSize = 9.5;
        const smallFontSize = 8;
        const titleFontSize = 14;
        const lineHeight = 12;

        // Page 1
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
        y = drawWrappedText(page, p1_line2, font, smallFontSize, leftMargin, y, contentWidth, 10);
        y -= 20;

        drawCheckbox(page, formData.convictedOutOfState === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.convictedOutOfState === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        y = drawWrappedText(page, 'Have you ever been convicted of a crime from another state, federal court, military, or jurisdiction outside of U.S.?', boldFont, mainFontSize, leftMargin + 100, y, contentWidth - 100, lineHeight);
        y -= 15;
        
        const p1_line3 = "You do not need to disclose convictions that were a result of ones's status as a victim of human trafficking and that were dismissed pursuant to Penal Code Section 1203.49, nor any marijuana related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7. However you are required to disclose convictions that were dismissed pursuant to Penal Code Section 1203.4(a)";
        y = drawWrappedText(page, p1_line3, font, smallFontSize, leftMargin, y, contentWidth, 10);
        y -= 20;

        drawText(page, "Criminal convictions from another State or Federal court are considered the same as criminal convictions in California.", {x: leftMargin, y, font, size: smallFontSize, color: rgb(0.5, 0.5, 0.5)});
        y -= 20;
        
        const p1_childrens_text = "For Children's Residential Facilities, not including Foster Family Agency Staff, Youth Homelessness Prevention Centers , Private Alternative Boarding Schools, Private Alternative Outdoor Program, or Crisis Nurseries: ";
        y = drawWrappedText(page, p1_childrens_text, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        drawCheckbox(page, formData.livedOutOfStateLast5Years === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.livedOutOfStateLast5Years === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        drawText(page, 'Have you lived in a state other than California within the last five years?', {x: leftMargin + 100, y, font: boldFont, size: mainFontSize});
        y -= 15;

        drawText(page, `If yes, list each state below and then complete an LIC 198B for each state: ${formData.outOfStateHistory || ''}`, {x: leftMargin, y, font, size: mainFontSize});
        y -= 20;

        // Add 30 blank lines as requested
        y -= lineHeight * 30;
        
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
            y -= lineHeight;
            drawText(page, `• ${item}`, { x: leftMargin + 10, y, font, size: mainFontSize });
        });
        
        // ... (rest of the pages would be implemented here)

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating LIC 508 PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
