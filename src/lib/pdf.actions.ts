
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
    if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
        try {
            const pngImage = await pdfDoc.embedPng(dataUrl);
            page.drawImage(pngImage, { x, y, width, height });
        } catch (e) {
            console.error("Failed to embed signature:", e);
        }
    }
}

async function drawHeader(page: any, pdfDoc: PDFDocument, logoImage: any) {
    const { width } = page.getSize();
    const logoWidth = 150;
    const logoHeight = 30;
    page.drawImage(logoImage, {
        x: 50,
        y: page.getHeight() - 50,
        width: logoWidth,
        height: logoHeight,
    });
    page.drawText("NO. 00000", {
        x: width - 50 - 50,
        y: page.getHeight() - 45,
        font: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
        size: 10,
        color: rgb(0.8, 0, 0),
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

function drawWrappedText(page: any, text: string, font: PDFFont, fontSize: number, x: number, y: number, maxWidth: number, lineHeight: number): number {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth) {
            page.drawText(line, { x, y: currentY, font, size: fontSize });
            line = word + ' ';
            currentY -= lineHeight;
        } else {
            line = testLine;
        }
    }
    page.drawText(line, { x, y: currentY, font, size: fontSize });
    return currentY - lineHeight; // Return the Y for the next line
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
    const lineSpacing = 15;
    const sectionSpacing = 20;

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
    
    const drawSectionHeader = async (text: string, options: { centered?: boolean } = {}) => {
        await checkY(y - sectionSpacing);
        const textWidth = boldFont.widthOfTextAtSize(text, 12);
        const xPos = options.centered ? (width / 2) - (textWidth / 2) : leftMargin;
        page.drawText(text, { x: xPos, y, font: boldFont, size: 12, color: rgb(0.1, 0.1, 0.1) });
        y -= lineSpacing * 1.5;
    };
    
    const drawField = async (label: string, value: any, xOffset: number, currentY: number, options: { isCheckbox?: boolean, isDate?: boolean, fieldWidth?: number } = {}) => {
        const fieldX = leftMargin + xOffset;
        page.drawText(`${label}:`, { x: fieldX, y: currentY, font: boldFont, size: 9 });
        const labelWidth = boldFont.widthOfTextAtSize(`${label}: `, 9);
        const valueX = fieldX + labelWidth + 5;
        if (options.isCheckbox) {
            await drawCheckbox(page, value, valueX, currentY - 1, font);
        } else {
            let displayValue = value;
            if (options.isDate && value) {
                try {
                    displayValue = format(value.toDate ? value.toDate() : new Date(value), 'MM/dd/yyyy');
                } catch {
                    displayValue = '';
                }
            }
            await drawText(page, displayValue, valueX, currentY, font, 9);
        }
    };

    const drawSignatureBlock = async (sigLabel: string, nameLabel: string, dateLabel: string, sigData: string | undefined, nameData: string | undefined, dateData: any) => {
        await checkY(y - 70);
        const blockY = y;
        // Signature Line
        page.drawLine({ start: { x: leftMargin, y: blockY - 15 }, end: { x: leftMargin + 200, y: blockY - 15 }, color: rgb(0, 0, 0), thickness: 0.5 });
        if(sigData) await drawSignature(page, sigData, leftMargin + 10, blockY - 10, 180, 40, pdfDoc);
        page.drawText(sigLabel, { x: leftMargin, y: blockY - 25, font: font, size: 8 });

        // Name Line
        page.drawLine({ start: { x: leftMargin + 250, y: blockY - 15 }, end: { x: leftMargin + 400, y: blockY - 15 }, color: rgb(0, 0, 0), thickness: 0.5 });
        await drawText(page, nameData, leftMargin + 255, blockY - 10, font, 9);
        page.drawText(nameLabel, { x: leftMargin + 250, y: blockY - 25, font: font, size: 8 });
        
        // Date Line
        page.drawLine({ start: { x: leftMargin + 450, y: blockY - 15 }, end: { x: rightMargin, y: blockY - 15 }, color: rgb(0, 0, 0), thickness: 0.5 });
        await drawText(page, dateData ? formatDate(dateData) : '', leftMargin + 455, blockY-10, font, 9);
        page.drawText(dateLabel, { x: leftMargin + 450, y: blockY - 25, font: font, size: 8 });

        y -= 60;
    }
    
    const formatDate = (date: any) => {
        if (!date) return '';
        try {
            const dateObj = date.toDate ? date.toDate() : new Date(date);
            return format(dateObj, 'MM/dd/yyyy');
        } catch {
            return '';
        }
    };


    // --- START DRAWING CONTENT ---
    await drawSectionHeader("CLIENT SERVICE AGREEMENT", { centered: true });
    const introText = "Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (the \"Agreement\") is entered into between the client, or his or her authorized representative, (the \"Client\") and FirstLight Home Care of Rancho Cucamonga CA, address 9650 Business Center drive, Suite 132, Rancho Cucamonga CA 91730 phone number 9093214466 (\"FirstLight Home Care\")";
    y = drawWrappedText(page, introText, font, 9, leftMargin, y, rightMargin - leftMargin, lineSpacing);
    y -= sectionSpacing / 2;

    await drawSectionHeader("I. CLIENT INFORMATION", { centered: true });
    await drawField("Client Name", formData.clientName, 0, y);
    await drawField("Address", `${formData.clientAddress || ''}, ${formData.clientCity || ''}, ${formData.clientState || ''} ${formData.clientPostalCode || ''}`, 250, y);
    y -= lineSpacing;
    await drawField("Phone", formData.clientPhone, 0, y);
    await drawField("Email", formData.clientEmail, 250, y);
    y -= lineSpacing;
    await drawField("SSN", formData.clientSSN, 0, y);
    await drawField("DOB", formData.clientDOB ? format(new Date(formData.clientDOB), 'MM/dd/yyyy') : '', 250, y);
    y -= sectionSpacing;

    await drawSectionHeader("II. EMERGENCY CONTACT INFORMATION", { centered: true });
    await drawField("Emergency Contact Name", formData.emergencyContactName, 0, y);
    await drawField("Relationship", formData.emergencyContactRelationship, 250, y);
    y -= lineSpacing;
    await drawField("Contact Home Phone", formData.emergencyContactHomePhone, 0, y);
    await drawField("Contact Work Phone", formData.emergencyContactWorkPhone, 250, y);
    y -= lineSpacing * 1.5;
    await drawField("2nd Emergency Contact", formData.secondEmergencyContactName, 0, y);
    await drawField("Relationship", formData.secondEmergencyContactRelationship, 250, y);
    await drawField("Phone", formData.secondEmergencyContactPhone, 400, y);
    y -= sectionSpacing;
    
    await drawSectionHeader("III. TYPE OF SERVICE", { centered: true });
    await drawField("Homemaker/Companion", formData.homemakerCompanion, 100, y, { isCheckbox: true });
    await drawField("Personal Care", formData.personalCare, 300, y, { isCheckbox: true });
    y -= sectionSpacing;
    
    await drawSectionHeader("IV. SCHEDULE", { centered: true });
    await drawField("Scheduled Frequency", formData.scheduledFrequency, 0, y, {fieldWidth: 120});
    await drawField("Days/Wk", formData.daysPerWeek, 200, y, {fieldWidth: 50});
    await drawField("Hrs/Day", formData.hoursPerDay, 300, y, {fieldWidth: 50});
    await drawField("Contract Start Date", formData.contractStartDate, 400, y, {isDate: true, fieldWidth: 100});
    y -= lineSpacing;
    const servicePlanText = "FirstLight Home Care of Rancho Cucamonga will provide non-medical in-home services (the \"Services\") specified in the attached Service Plan Agreement (the \"Service Plan\")";
    y = drawWrappedText(page, servicePlanText, font, 9, leftMargin, y, rightMargin - leftMargin, lineSpacing);
    y -= sectionSpacing;

    await drawSectionHeader("V. PAYMENTS FOR THE SERVICES", { centered: true });
    const paymentText = `The hourly rate for providing the Services is $${formData.hourlyRate || '__'} per hour. The rate is based on the Client utilizing the services of FirstLight Home Care of Rancho Cucamonga for a minimum of ${formData.minimumHoursPerShift || '__'} hours per shift. The rates are provided on a current rate card dated ${formatDate(formData.rateCardDate)} and will be used to calculate the Client's rate for Services. Rates are subject to change with two (2) weeks' written notice (See attached rate sheet.).`;
    y = drawWrappedText(page, paymentText, font, 9, leftMargin, y, rightMargin - leftMargin, lineSpacing);
    
    const paymentText2 = "Invoices are to be presented on a regular scheduled basis. Payment is due upon receipt or not more than seven days after an invoice has been received by the Client. The Client should submit payment to the address listed above. Full refunds of any advance deposit fees collected for unused services will occur within ten (10) business days of last date of service. FirstLight Home Care of Rancho Cucamonga does not participate in and is not credentialed with any government or commercial health insurance plans and therefore does not submit bills or claims for Services as in-network, out-of-network or any other status to any government or commercial health plans. Client acknowledges and agrees that Client does not have insurance through any government health insurance plan; that Client requests to pay for Services out-of-pocket; and that because FirstLight Home Care of Rancho Cucamonga does not participate in or accept any form of government or commercial health insurance, FirstLight Home Care of Rancho Cucamonga will bill Client directly for the Services and Client is responsible for paying such charges.";
    y = drawWrappedText(page, paymentText2, font, 9, leftMargin, y, rightMargin - leftMargin, lineSpacing);
    y -= lineSpacing / 2;
    page.drawRectangle({x: leftMargin, y: y-20, width: rightMargin - leftMargin, height: 25, color: rgb(1, 0.9, 0.6)});
    const cancellationText = "If there is same day cancellation, client will be charged for full scheduled hours, except if there is a medical emergency.";
    y = drawWrappedText(page, cancellationText, boldFont, 9, leftMargin + 5, y - 5, rightMargin - leftMargin - 10, lineSpacing);
    y -= sectionSpacing;
    
    await drawSectionHeader("ACKNOWLEDGEMENT & AGREEMENT", { centered: true });
    const ackText = "The Client, or his or her authorized representative, consents to receive the Services and acknowledges he or she or they have read, accept, and consent to this Agreement, including the \"Terms and Conditions\" and all other attached documents, all of which are incorporated into this Agreement.";
    y = drawWrappedText(page, ackText, font, 9, leftMargin, y, rightMargin - leftMargin, lineSpacing);
    y -= lineSpacing;

    await drawSignatureBlock(
        "(Client Signature)",
        "(Client Printed Name)",
        "Date",
        formData.clientSignature,
        formData.clientPrintedName,
        formData.clientSignatureDate
    );
     await drawSignatureBlock(
        "(Client Representative Signature)",
        "(Client Representative Printed Name and Relationship to Client)",
        "Date",
        formData.clientRepresentativeSignature,
        formData.clientRepresentativePrintedName,
        formData.clientRepresentativeSignatureDate
    );
     await drawSignatureBlock(
        "(FirstLight Home Care of Representative Signature)",
        "(FirstLight Home Care of Rancho Cucamonga Representative Title)",
        "Date",
        formData.firstLightRepresentativeSignature,
        formData.firstLightRepresentativeTitle,
        formData.firstLightRepresentativeSignatureDate
    );

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}
