
'use server';

import { Buffer } from 'buffer';
import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont } from 'pdf-lib';
import { format } from 'date-fns';

// Helper to draw text and handle undefined values
async function drawText(page: any, text: string | undefined, x: number, y: number, font: any, size: number, color = rgb(0, 0, 0)) {    
    if (text) {
        page.drawText(sanitizeText(text), { x, y, font, size, color });
    }
}

// Helper to draw a checkbox
async function drawCheckbox(page: any, checked: boolean | undefined, x: number, y: number, font: PDFFont) {
    if (checked) {
        // Draw a checkmark manually with lines instead of using a text character
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

function sanitizeText(text: string | null | undefined): string {
    if (!text) return '';
    return text.replace(/[\u2000-\u206F]/g, '');
}

function drawWrappedText(page: any, text: string, font: PDFFont, fontSize: number, x: number, y: number, maxWidth: number, lineHeight: number): number {
    text = sanitizeText(text);
    if (!text) return y;
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
    const fontSize = 9;

    page.drawText(footerText1, {
        x: 50,
        y: footerY,
        font: font,
        size: fontSize,
        color: rgb(0, 0, 0)
    });

    page.drawText(footerText2, {
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
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let y = height - 40; 
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;

        const lineSpacing = 18;
        const sectionSpacing = 22; 
        const mainFontSize = 9.5; 
        const titleFontSize = 11;
        const labelFontSize = 8.5;
        const headerFontSize = 8; 
        const subTitleFontSize = 7;
        const lightGray = rgb(0.92, 0.92, 0.92);

        // Header
        await drawText(page, 'State of California – Health and Human Services Agency', leftMargin, y, font, headerFontSize);
        await drawText(page, 'Community Care Licensing Division', width - font.widthOfTextAtSize('Community Care Licensing Division', headerFontSize) - leftMargin, y, font, headerFontSize);
        y -= 12;
        await drawText(page, 'California Department of Social Services', leftMargin, y, font, headerFontSize);
        await drawText(page, 'Home Care Services Bureau', width - font.widthOfTextAtSize('Home Care Services Bureau', headerFontSize) - leftMargin, y, font, headerFontSize);
        y -= 20;

        // Title
        const title = "PERSONNEL RECORD";
        page.drawText(title, { x: leftMargin, y, font: boldFont, size: titleFontSize });
        y -= sectionSpacing;

        // Personal Record Pane
        page.drawRectangle({ x: leftMargin - 10, y: y - 85, width: contentWidth + 20, height: 95, color: lightGray });

        const subTitle = '(Form to be kept current at all times) FOR HOME CARE ORGANIZATION (HCO) USE ONLY';
        page.drawText(subTitle, { x: (width / 2) - (font.widthOfTextAtSize(subTitle, subTitleFontSize)/2) , y, font, size: subTitleFontSize });
        y -= lineSpacing * 2;

        const drawFieldBox = async (label: string, value: string | undefined, x: number, yPos: number, boxWidth: number) => {
            await drawText(page, label, x, yPos + 6, font, labelFontSize);
            page.drawRectangle({x, y: yPos-12, width: boxWidth, height: 16, borderColor: rgb(0,0,0), borderWidth: 0.5});
            if(value) await drawText(page, value, x + 5, yPos-9, font, mainFontSize);
        }

        await drawFieldBox("HCO Number", "364700059", leftMargin, y, 180);
        await drawFieldBox("Employee’s PER ID", formData.perId, leftMargin + 200, y, 180);
        y -= lineSpacing * 2;
        await drawFieldBox("Hire Date", formData.hireDate ? format(new Date(formData.hireDate.seconds * 1000), "MM/dd/yyyy") : '', leftMargin, y, 180);
        await drawFieldBox("Date of Separation", formData.separationDate ? format(new Date(formData.separationDate.seconds * 1000), "MM/dd/yyyy") : '', leftMargin + 200, y, 180);

        y -= 40; 

        // Personal Section
        const personalTitle = "PERSONAL";
        page.drawText(personalTitle, { x: (width / 2) - (boldFont.widthOfTextAtSize(personalTitle, 11)/2), y, font: boldFont, size: 11 });
        page.drawLine({ start: { x: leftMargin, y: y + 6 }, end: { x: leftMargin + 230, y: y + 6 }, thickness: 0.5 });
        page.drawLine({ start: { x: width - leftMargin - 230, y: y + 6 }, end: { x: width - leftMargin, y: y + 6 }, thickness: 0.5 });
        y -= sectionSpacing;

        // Row 1
        await drawFieldBox("Name (Last First Middle)", formData.fullName, leftMargin, y, 280);
        await drawFieldBox("Area Code/Telephone", formData.phone, leftMargin + 300, y, contentWidth - 300);
        y -= lineSpacing * 2;

        const fullAddress = [formData.address, formData.city, formData.state, formData.zip].filter(Boolean).join(', ');
        await drawFieldBox("Address", fullAddress, leftMargin, y, contentWidth);
        y -= lineSpacing; 

        y -= lineSpacing; 

        await drawFieldBox("Date of Birth", formData.dob ? format(new Date(formData.dob.seconds * 1000), "MM/dd/yyyy") : '', leftMargin, y, 200);
        await drawFieldBox("Social Security Number (Voluntary for ID only)", formData.ssn, leftMargin + 220, y, contentWidth-220);
        y -= lineSpacing * 2;

        await drawFieldBox("Date of TB Test Upon Hire", formData.tbDate ? format(new Date(formData.tbDate.seconds * 1000), "MM/dd/yyyy") : '', leftMargin, y, 200);
        await drawFieldBox("Results of Last TB Test", formData.tbResults, leftMargin + 220, y, contentWidth - 220);
        y -= lineSpacing * 2;

        await drawFieldBox("Additional TB Test Dates (Please include test results)", formData.additionalTbDates, leftMargin, y, contentWidth);
        y -= lineSpacing * 2;

        await drawFieldBox("Please list any alternate names used (For example - maiden name)", formData.alternateNames, leftMargin, y, contentWidth);
        y -= lineSpacing * 2;

        await drawText(page, "Do you possess a valid California driver’s license?", leftMargin, y, font, mainFontSize);
        await drawCheckbox(page, formData.validLicense === 'yes', leftMargin + 250, y, font);
        await drawText(page, 'Yes', leftMargin + 265, y, font, mainFontSize);
        await drawCheckbox(page, formData.validLicense === 'no', leftMargin + 300, y, font);
        await drawText(page, 'No', leftMargin + 315, y, font, mainFontSize);
        await drawFieldBox("CDL Number:", formData.driversLicenseNumber, leftMargin + 350, y + 10, contentWidth - 350 -10);
        y -= sectionSpacing;
        
        // Position Information
        const posTitle = "POSITION INFORMATION";
        page.drawText(posTitle, { x: (width / 2) - (boldFont.widthOfTextAtSize(posTitle, 11)/2), y, font: boldFont, size: 11 });
        page.drawLine({ start: { x: leftMargin, y: y + 6 }, end: { x: leftMargin + 190, y: y + 6 }, thickness: 0.5 });
        page.drawLine({ start: { x: width - leftMargin - 190, y: y + 6 }, end: { x: width - leftMargin, y: y + 6 }, thickness: 0.5 });
        y -= sectionSpacing;

        await drawFieldBox("Title of Position", formData.titleOfPosition, leftMargin, y, contentWidth);
        y -= lineSpacing * 2;
        
        await drawText(page, "Notes:", leftMargin, y+10, font, labelFontSize);
        page.drawRectangle({x: leftMargin, y: y-35, width: contentWidth, height: 40, borderColor: rgb(0,0,0), borderWidth: 0.5});
        if (formData.hcs501Notes) drawWrappedText(page, formData.hcs501Notes, font, mainFontSize, leftMargin + 5, y - 5, contentWidth - 10, lineSpacing);
        y -= 50;

        // Certify Pane
        page.drawRectangle({ x: leftMargin - 10, y: y - 80, width: contentWidth + 20, height: 95, color: lightGray });

        const certifyText = "I hereby certify under penalty of perjury that I am 18 years of age or older and that the above statements are true and correct. I give my permission for any necessary verification.";
        y = drawWrappedText(page, certifyText, boldFont, 9, leftMargin, y, contentWidth - 20, 12);
        y -= 25;

        if(formData.hcs501EmployeeSignature) await drawSignature(page, formData.hcs501EmployeeSignature, leftMargin + 5, y, 240, 20, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y-5 }, end: { x: leftMargin + 250, y: y - 5 }, color: rgb(0, 0, 0), thickness: 0.5 });
        await drawText(page, "Employee Signature", leftMargin, y-15, font, labelFontSize);
        
        await drawFieldBox("Date", formData.hcs501SignatureDate ? format(new Date(formData.hcs501SignatureDate.seconds * 1000), "MM/dd/yyyy") : '', leftMargin + 300, y + 10, 200);

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
        
        // Logo
        page.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: y,
            width: logoDims.width,
            height: logoDims.height,
        });
        y -= logoDims.height + 20;

        // Title
        const title = "Caregiver Emergency Contact Numbers";
        page.drawText(title, {
            x: (width / 2) - (boldFont.widthOfTextAtSize(title, 16) / 2),
            y,
            font: boldFont,
            size: 16,
        });
        y -= 30;

        const boxStartY = y + 10;

        // Helper to draw a section
        const drawSection = (title: string, data: { [key: string]: string | undefined }, isFirst: boolean = false, subTitle?: string) => {
            if (!isFirst) {
                page.drawLine({ start: { x: leftMargin, y: y + 10 }, end: { x: width - leftMargin, y: y + 10 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
                y -= 20;
            }
            
            page.drawText(title, {
                x: leftMargin,
                y,
                font: boldFont,
                size: 12,
            });

            if (subTitle) {
                const subTitleWidth = boldFont.widthOfTextAtSize(subTitle, 12);
                page.drawText(subTitle, {
                    x: (width / 2) - (subTitleWidth / 2),
                    y,
                    font: boldFont,
                    size: 12,
                });
            }

            y -= 25;

            const drawField = (label: string, value: string | undefined) => {
                if (value) {
                    page.drawText(`${label}:`, { x: leftMargin + 20, y, font: boldFont, size: 11 });
                    page.drawText(value, { x: leftMargin + 150, y, font, size: 11 });
                    y -= 20;
                }
            };
            
            Object.entries(data).forEach(([label, value]) => drawField(label, value));
            y -= 10;
        };
        
        // Your Information
        const yourInfo = {
            "Name": formData.fullName,
            "Phone/Cell": formData.phone,
            "Address": formData.address,
            "City/State/Zip": `${formData.city || ''}, ${formData.state || ''} ${formData.zip || ''}`,
        };
        drawSection("Your Information", yourInfo, true, "General Information");
        
        // First Person
        if (formData.emergencyContact1_name) {
            const firstPersonInfo = {
                "Name": formData.emergencyContact1_name,
                "Phone/Cell": formData.emergencyContact1_phone,
                "Address": formData.emergencyContact1_address,
                "City/State/Zip": formData.emergencyContact1_cityStateZip,
            };
            drawSection("In Case of Emergency please notify: (First Person)", firstPersonInfo);
        }

        // Second Person
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

        // Footer
        page.drawText("REV 02/03/17", { x: leftMargin, y: 30, font, size: 9 });

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

        // 1. Logo
        page.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: y,
            width: logoDims.width,
            height: logoDims.height,
        });
        y -= logoDims.height + 20;

        // 2. Title with background
        const title = "FIRSTLIGHT HOMECARE REFERENCE VERIFICATION FORM";
        const titleWidth = boldFont.widthOfTextAtSize(title, 14);
        page.drawRectangle({
            x: (width / 2) - (titleWidth / 2) - 5,
            y: y - 5,
            width: titleWidth + 10,
            height: 20,
            color: rgb(0, 0, 0),
        });
        page.drawText(title, {
            x: (width / 2) - (titleWidth / 2),
            y: y,
            font: boldFont,
            size: 14,
            color: rgb(1, 1, 1), // White
        });
        y -= 30;
        
        // 3. PLEASE PRINT and separator
        const pleasePrint = "PLEASE PRINT";
        page.drawText(pleasePrint, {
            x: leftMargin,
            y: y,
            font: font,
            size: 10,
        });
        y -= 5;
        page.drawLine({
            start: { x: leftMargin, y: y },
            end: { x: rightMargin, y: y },
            thickness: 1,
        });
        y -= 20;

        // Applicant Info & Permission Text
        await drawText(page, `Applicant’s First Name Middle Last: ${formData.fullName || ''}`, leftMargin, y, font, 10);
        y -= 20;

        const permissionText = "I hereby give FirstLight HomeCare permission to obtain the employment references necessary to make a hiring decision and hold all persons giving references free from any and all liability resulting from this process. I waive any provision impeding the release of this information and agree to provide any information necessary for the release of this information beyond that provided on the employment application and this reference verification form.";
        y = drawWrappedText(page, permissionText, font, 9, leftMargin, y, contentWidth, 12);
        y -= 20;
        
        // Applicant Signature and Date
        if (formData.applicantSignature) {
            await drawSignature(page, formData.applicantSignature, leftMargin + 80, y - 5, 150, 30, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: y - 10 }, end: { x: leftMargin + 300, y: y - 10 }, thickness: 0.5 });
        await drawText(page, "Signature", leftMargin, y-20, font, 8);

        if (formData.applicantSignatureDate) {
             await drawText(page, `Date: ${format(new Date(formData.applicantSignatureDate.seconds * 1000), "MM/dd/yyyy")}`, leftMargin + 350, y, font, 10);
        }
        page.drawLine({ start: { x: leftMargin + 340, y: y-10 }, end: { x: leftMargin + 500, y: y - 10 }, thickness: 0.5 });
        await drawText(page, "Date", leftMargin + 340, y-20, font, 8);
        y -= 40;

        // 4. FORMER EMPLOYER CONTACT INFORMATION
        const employerBoxStartY = y;
        await drawText(page, "FORMER EMPLOYER CONTACT INFORMATION", leftMargin, y, boldFont, 12);
        y -= 25;

        const drawTwoColumnField = (label1: string, value1: string, label2: string, value2: string) => {
            if (value1) await drawText(page, `${label1}: ${value1}`, leftMargin + 5, y, font, 10);
            if (value2) await drawText(page, `${label2}: ${value2}`, leftMargin + contentWidth / 2, y, font, 10);
            y -= 20;
        };

        drawTwoColumnField("Company", formData.company, "Supervisor’s Name and Title", formData.supervisorName);
        drawTwoColumnField("Email and/or Fax #", formData.emailOrFax, "Phone", formData.phone);
        drawTwoColumnField("Dates of Employment", formData.employmentDates, "Position", formData.position);
        drawTwoColumnField("Starting Salary:", formData.startingSalary, "Ending Salary:", formData.endingSalary);
        y -= 5;
        const employerBoxEndY = y;
        page.drawRectangle({x: leftMargin - 5, y: employerBoxEndY, width: contentWidth+10, height: employerBoxStartY - employerBoxEndY + 15, borderColor: rgb(0,0,0), borderWidth: 1});
        y -= 25;


        // 5. REFERENCE INFORMATION
        const referenceBoxStartY = y;
        await drawText(page, "REFERENCE INFORMATION", leftMargin, y, boldFont, 12);
        y -= 15;
        await drawText(page, "Please rate yourself in the following categories as you feel your former supervisor will rate you:", leftMargin, y, font, 9);
        y -= 20;

        const drawRating = (label: string, value: string | undefined) => {
            y -= 5;
            y = drawWrappedText(page, label, boldFont, 9, leftMargin + 5, y, contentWidth - 10, 11);
            y -= 15;
            if(value) await drawText(page, `Rating: ${value}`, leftMargin + 15, y, font, 10);
            y -= 20;
        };

        drawRating("TEAMWORK: The degree to which you are willing to work harmoniously with others; the extent to which you conform to the policies of management.", formData.teamworkRating);
        drawRating("DEPENDABILITY: The extent to which you can be depended upon to be available for work and do it properly; the degree to which you are reliable and trustworthy; the extent to which you are able to work scheduled days and times, as well as your willingness to work additional hours if needed.", formData.dependabilityRating);
        drawRating("INITIATIVE: The degree to which you act independently in new situations; the extent to which you see what needs to be done and do it without being told; the degree to which you do your best to be an outstanding employee.", formData.initiativeRating);
        drawRating("QUALITY: The degree to which your work is free from errors and mistakes; the extent to which your work is accurate; the quality of your work in general.", formData.qualityRating);
        drawRating("CUSTOMER SERVICE: The degree to which you relate to the customer’s needs and/or concerns.", formData.customerServiceRating);
        drawRating("OVERALL PERFORMANCE: The degree to which your previous employer was satisfied with your efforts and achievements, as well as your eligibility for rehire.", formData.overallPerformanceRating);
        
        y -= 5;
        const referenceBoxEndY = y;
        page.drawRectangle({x: leftMargin - 5, y: referenceBoxEndY, width: contentWidth+10, height: referenceBoxStartY - referenceBoxEndY + 15, borderColor: rgb(0,0,0), borderWidth: 1});
        
        // Final Questions
        y -= 25;
        const drawYesNo = (label: string, value: string | undefined, yPos: number, xPos: number) => {
            if (value) {
                drawText(page, `${label}: ${value}`, xPos, yPos, font, 10);
            }
        };

        drawYesNo("Did you resign from this position?", formData.resignationStatus, y, leftMargin);
        drawYesNo("Discharged?", formData.dischargedStatus, y, leftMargin + 250);
        drawYesNo("Laid-Off?", formData.laidOffStatus, y, leftMargin + 400);
        y -= 20;
        drawYesNo("Are you eligible for rehire?", formData.eligibleForRehire, y, leftMargin);
        drawYesNo("Were you ever disciplined on the job?", formData.wasDisciplined, y, leftMargin + 250);
        y -= 20;
        if (formData.wasDisciplined === 'Yes' && formData.disciplineExplanation) {
            y = drawWrappedText(page, `Explain: ${formData.disciplineExplanation}`, font, 9, leftMargin, y, contentWidth, 11);
        }
        y-=20;
        drawWrappedText(page, "Someone from FirstLight HomeCare will be following up with your shortly regarding the employment reference verification check. If you have any questions, please call: 909-321-4466", font, 9, leftMargin, y, contentWidth, 11);

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Reference Verification PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}

    