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

        let y = height - 60; // Adjusted for content shift up
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;

        const lineSpacing = 18; // Increased slightly
        const sectionSpacing = 24; // Increased slightly
        const mainFontSize = 9.5; // Reduced slightly
        const titleFontSize = 13; // Reduced slightly
        const labelFontSize = 8.5; // Reduced slightly
        const headerFontSize = 8.5; // Reduced slightly
        const subTitleFontSize = 7.5; // Reduced slightly
        const lightGray = rgb(0.92, 0.92, 0.92);

        // Header
        await drawText(page, 'State of California – Health and Human Services Agency', leftMargin, y, font, headerFontSize);
        await drawText(page, 'Community Care Licensing Division', width - font.widthOfTextAtSize('Community Care Licensing Division', headerFontSize) - leftMargin, y, font, headerFontSize);
        y -= 12;
        await drawText(page, 'California Department of Social Services', leftMargin, y, font, headerFontSize);
        await drawText(page, 'Home Care Services Bureau', width - font.widthOfTextAtSize('Home Care Services Bureau', headerFontSize) - leftMargin, y, font, headerFontSize);
        y -= 28;

        // Title
        const title = "PERSONNEL RECORD";
        page.drawText(title, { x: leftMargin, y, font: boldFont, size: titleFontSize }); // Left aligned
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
        y -= lineSpacing * 2.5;
        await drawFieldBox("Hire Date", formData.hireDate ? format(new Date(formData.hireDate.seconds * 1000), "MM/dd/yyyy") : '', leftMargin, y, 180);
        await drawFieldBox("Date of Separation", formData.separationDate ? format(new Date(formData.separationDate.seconds * 1000), "MM/dd/yyyy") : '', leftMargin + 200, y, 180);

        y -= 60; // Move below the gray box

        // Personal Section
        const personalTitle = "PERSONAL";
        page.drawText(personalTitle, { x: (width / 2) - (boldFont.widthOfTextAtSize(personalTitle, 11)/2), y, font: boldFont, size: 11 });
        page.drawLine({ start: { x: leftMargin, y: y + 6 }, end: { x: leftMargin + 230, y: y + 6 }, thickness: 0.5 });
        page.drawLine({ start: { x: width - leftMargin - 230, y: y + 6 }, end: { x: width - leftMargin, y: y + 6 }, thickness: 0.5 });
        y -= sectionSpacing;

        // Row 1
        await drawFieldBox("Name (Last First Middle)", formData.fullName, leftMargin, y, 280);
        await drawFieldBox("Area Code/Telephone", formData.phone, leftMargin + 300, y, contentWidth - 300);
        y -= lineSpacing * 2.5;

        // Row 2 & 3 (merged)
        const fullAddress = [formData.address, formData.city, formData.state, formData.zip].filter(Boolean).join(', ');
        await drawFieldBox("Address", fullAddress, leftMargin, y, contentWidth);
        y -= lineSpacing * 1.25; // Reduced spacing here by 50%

        y -= lineSpacing * 2.5; // Added empty space where City/State/Zip row was

        // Row 4
        await drawFieldBox("Date of Birth", formData.dob ? format(new Date(formData.dob.seconds * 1000), "MM/dd/yyyy") : '', leftMargin, y, 200);
        await drawFieldBox("Social Security Number (Voluntary for ID only)", formData.ssn, leftMargin + 220, y, contentWidth-220);
        y -= lineSpacing * 2.5;

        // Row 5
        await drawFieldBox("Date of TB Test Upon Hire", formData.tbDate ? format(new Date(formData.tbDate.seconds * 1000), "MM/dd/yyyy") : '', leftMargin, y, 200);
        await drawFieldBox("Results of Last TB Test", formData.tbResults, leftMargin + 220, y, contentWidth - 220);
        y -= lineSpacing * 2.5;

        // Row 6
        await drawFieldBox("Additional TB Test Dates (Please include test results)", formData.additionalTbDates, leftMargin, y, contentWidth);
        y -= lineSpacing * 2.5;

        // Row 7
        await drawFieldBox("Please list any alternate names used (For example - maiden name)", formData.alternateNames, leftMargin, y, contentWidth);
        y -= lineSpacing * 2.5;

        // Row 8
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
        y -= lineSpacing * 2.5;
        
        await drawText(page, "Notes:", leftMargin, y+10, font, labelFontSize);
        page.drawRectangle({x: leftMargin, y: y-35, width: contentWidth, height: 40, borderColor: rgb(0,0,0), borderWidth: 0.5});
        if (formData.hcs501Notes) drawWrappedText(page, formData.hcs501Notes, font, mainFontSize, leftMargin + 5, y - 5, contentWidth - 10, lineSpacing);
        y -= 70; // Added extra space here

        // Certify Pane
        page.drawRectangle({ x: leftMargin - 10, y: y - 80, width: contentWidth + 20, height: 95, color: lightGray });

        const certifyText = "I hereby certify under penalty of perjury that I am 18 years of age or older and that the above statements are true and correct. I give my permission for any necessary verification.";
        y = drawWrappedText(page, certifyText, boldFont, 9, leftMargin, y, contentWidth - 20, 12);
        y -= 25;

        // Signature and date
        if(formData.hcs501EmployeeSignature) await drawSignature(page, formData.hcs501EmployeeSignature, leftMargin + 5, y, 240, 20, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y-5 }, end: { x: leftMargin + 250, y: y - 5 }, color: rgb(0, 0, 0), thickness: 0.5 });
        await drawText(page, "Employee Signature", leftMargin, y-15, font, labelFontSize);
        
        await drawFieldBox("Date", formData.hcs501SignatureDate ? format(new Date(formData.hcs501SignatureDate.seconds * 1000), "MM/dd/yyyy") : '', leftMargin + 300, y + 10, 200);

        // Footer
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
        y -= 40;

        // Helper to draw a section
        const drawSection = (title: string, data: { [key: string]: string | undefined }, isFirst: boolean = false) => {
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
        drawSection("Your Information", yourInfo, true);
        
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

        // Footer
        page.drawText("REV 02/03/17", { x: leftMargin, y: 30, font, size: 9 });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Emergency Contact PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
