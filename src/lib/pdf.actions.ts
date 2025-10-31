
"use server";

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont } from 'pdf-lib';
import { format } from 'date-fns';

const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

// Helper function to draw text and handle undefined values
async function drawText(page: any, text: string | undefined, x: number, y: number, font: any, size: number, color = rgb(0, 0, 0)) {    
    if (text) {
        page.drawText(text, { x, y, font, size, color });
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
    if (dataUrl) {
        const pngImage = await pdfDoc.embedPng(dataUrl);
        page.drawImage(pngImage, { x, y, width, height });
    }
}

async function drawHeader(page: any, pdfDoc: PDFDocument, logoImage: any) {
    const { width } = page.getSize();
    const logoWidth = 150;
    const logoHeight = 30;
    page.drawImage(logoImage, {
        x: (width / 2) - (logoWidth / 2),
        y: page.getHeight() - 40,
        width: logoWidth,
        height: logoHeight,
    });
}

async function drawFooter(page: any, font: PDFFont) {
    const { width } = page.getSize();
    const footerText1 = "Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated.";
    const footerText2 = "FIRST-0084-A (10/2018)";
    const footerY = 30;
    const fontSize = 8;

    page.drawText(footerText1, {
        x: 50,
        y: footerY,
        font: font,
        size: fontSize,
        color: rgb(0.5, 0.5, 0.5)
    });

    page.drawText(footerText2, {
        x: width - 50 - font.widthOfTextAtSize(footerText2, fontSize),
        y: footerY,
        font: font,
        size: fontSize,
        color: rgb(0.5, 0.5, 0.5)
    });
}


export async function generateClientIntakePdf(formData: any) {
    if (!formData) {
        throw new Error("Form data is missing.");
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Fetch and embed logo
    const logoBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
    const logoImage = await pdfDoc.embedPng(logoBytes);

    let page = pdfDoc.addPage(PageSizes.Letter);
    let { width, height } = page.getSize();
    let y = height - 70; // Start lower to accommodate header
    const leftMargin = 50;
    const rightMargin = width - 50;
    const lineSpacing = 16;
    const sectionSpacing = 25;

    // Draw header and footer on the first page
    await drawHeader(page, pdfDoc, logoImage);
    await drawFooter(page, font);

    // Helper to add a new page and reset y coordinate if needed
    const checkY = async (requiredSpace: number) => {
        if (y < requiredSpace + 50) { // +50 for footer margin
            page = pdfDoc.addPage(PageSizes.Letter);
            await drawHeader(page, pdfDoc, logoImage);
            await drawFooter(page, font);
            y = height - 70;
        }
    };
    
    const drawSectionHeader = async (text: string) => {
        await checkY(y - sectionSpacing);
        page.drawText(text, { x: leftMargin, y, font: boldFont, size: 12, color: rgb(0.1, 0.1, 0.1) });
        y -= lineSpacing * 1.5;
    };
    
    const drawField = async (label: string, value: any, isCheckbox = false, options: {width?: number} = {}) => {
        if (!value && !isCheckbox) return;
        await checkY(y - lineSpacing);
        page.drawText(`${label}:`, { x: leftMargin, y, font: boldFont, size: 9 });
        if (isCheckbox) {
            await drawCheckbox(page, value, leftMargin + (options.width || 150), y - 1, font);
        } else {
            await drawText(page, value, leftMargin + (options.width || 150), y, font, 9);
        }
        y -= lineSpacing;
    };
    
    const formatDate = (date: any) => {
        if (!date) return '';
        try {
            // Handle both Firestore Timestamps and string dates
            const dateObj = date.toDate ? date.toDate() : new Date(date);
            return format(dateObj, 'MM/dd/yyyy');
        } catch {
            return '';
        }
    };


    // --- START DRAWING CONTENT ---
    await drawSectionHeader("I. CLIENT INFORMATION");
    await drawField("Client Name", formData.clientName);
    await drawField("Address", `${formData.clientAddress || ''}, ${formData.clientCity || ''}, ${formData.clientState || ''} ${formData.clientPostalCode || ''}`);
    await drawField("Phone", formData.clientPhone);
    await drawField("Email", formData.clientEmail);
    await drawField("SSN", formData.clientSSN);
    await drawField("DOB", formData.clientDOB ? format(new Date(formData.clientDOB), 'MM/dd/yyyy') : '');
    y -= sectionSpacing;

    await drawSectionHeader("II. EMERGENCY CONTACT INFORMATION");
    await drawField("Emergency Contact Name", formData.emergencyContactName);
    await drawField("Relationship", formData.emergencyContactRelationship);
    await drawField("Home Phone", formData.emergencyContactHomePhone);
    await drawField("Work Phone", formData.emergencyContactWorkPhone);
    y -= lineSpacing;
    await drawField("2nd Emergency Contact", formData.secondEmergencyContactName);
    await drawField("2nd Relationship", formData.secondEmergencyContactRelationship);
    await drawField("2nd Phone", formData.secondEmergencyContactPhone);
    y -= sectionSpacing;
    
    await drawSectionHeader("III. TYPE OF SERVICE");
    await drawField("Homemaker/Companion", formData.homemakerCompanion, true);
    await drawField("Personal Care", formData.personalCare, true);
    y -= sectionSpacing;
    
    await drawSectionHeader("IV. SCHEDULE");
    await drawField("Frequency", formData.scheduledFrequency);
    await drawField("Days/Week", formData.daysPerWeek);
    await drawField("Hours/Day", formData.hoursPerDay);
    await drawField("Contract Start Date", formatDate(formData.contractStartDate));
    y -= sectionSpacing;

    await drawSectionHeader("V. PAYMENTS FOR THE SERVICES");
    await drawField("Hourly Rate", `$${formData.hourlyRate || 0}`);
    await drawField("Minimum Hours/Shift", `${formData.minimumHoursPerShift || 0}`);
    await drawField("Rate Card Date", formatDate(formData.rateCardDate));
    await drawField("Insurance Policy Number", formData.policyNumber);
    await drawField("Insurance Policy Period", formData.policyPeriod);
    y -= sectionSpacing;

    await checkY(250);

    await drawSectionHeader("ACKNOWLEDGEMENT & AGREEMENT");
    if(formData.clientSignature) {
        await drawField("Client Signature", "");
        await drawSignature(page, formData.clientSignature, leftMargin + 150, y, 150, 40, pdfDoc);
        y -= 30;
    }
    await drawField("Client Printed Name", formData.clientPrintedName);
    await drawField("Client Signature Date", formatDate(formData.clientSignatureDate));
    y -= lineSpacing;

    if(formData.clientRepresentativeSignature) {
        await drawField("Representative Signature", "");
        await drawSignature(page, formData.clientRepresentativeSignature, leftMargin + 150, y, 150, 40, pdfDoc);
        y -= 30;
    }
    await drawField("Representative Name", formData.clientRepresentativePrintedName);
    await drawField("Rep. Signature Date", formatDate(formData.clientRepresentativeSignatureDate));
    y -= lineSpacing;
    
    if(formData.firstLightRepresentativeSignature) {
        await drawField("FirstLight Rep. Signature", "");
        await drawSignature(page, formData.firstLightRepresentativeSignature, leftMargin + 150, y, 150, 40, pdfDoc);
        y -= 30;
    }
    await drawField("FirstLight Rep. Title", formData.firstLightRepresentativeTitle);
    await drawField("FirstLight Rep. Sig. Date", formatDate(formData.firstLightRepresentativeSignatureDate));
    
    // Continue with other pages...

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}

    
