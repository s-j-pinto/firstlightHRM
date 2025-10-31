

"use server";
import { Buffer } from 'buffer';
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

async function drawHeader(page: any, pdfDoc: PDFDocument, logoImage: any, font: PDFFont) {
    const { width } = page.getSize();
    const logoWidth = 150;
    const logoHeight = 30;
    const margin = 50;

    // Draw logo on the left
    page.drawImage(logoImage, {
        x: margin,
        y: page.getHeight() - 55,
        width: logoWidth,
        height: logoHeight,
    });

    // Draw red text on the right
    const redText = "NO. 00000";
    const redTextSize = 10;
    const redTextWidth = font.widthOfTextAtSize(redText, redTextSize);
    page.drawText(redText, {
        x: width - margin - redTextWidth - 5, // Added 5px gap
        y: page.getHeight() - 50,
        font: font,
        size: redTextSize,
        color: rgb(0.8, 0, 0), // Red color
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
    if (!text) return y;
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);
        if (testWidth > maxWidth && line.length > 0) {
            page.drawText(line, { x, y: currentY, font, size: fontSize });
            line = word + ' ';
            currentY -= lineHeight;
        } else {
            line = testLine;
        }
    }
    if (line.trim().length > 0) {
        page.drawText(line.trim(), { x, y: currentY, font, size: fontSize });
    }
    
    // Return the y-coordinate for the start of the next line of text.
    // If text was drawn, this will be one line lower. If no text, it's unchanged.
    return line.trim() ? currentY - lineHeight : y; 
}

function drawTextWithBoldHighlight(page: any, text: string, boldText: string, font: PDFFont, boldFont: PDFFont, fontSize: number, x: number, y: number): void {
    const parts = text.split(boldText);
    let currentX = x;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        page.drawText(part, { x: currentX, y, font, size: fontSize });
        currentX += font.widthOfTextAtSize(part, fontSize);
        
        if (i < parts.length - 1) {
            page.drawText(boldText, { x: currentX, y, font: boldFont, size: fontSize });
            currentX += boldFont.widthOfTextAtSize(boldText, fontSize);
        }
    }
}

function drawWrappedTextWithBoldHighlight(page: any, text: string, boldText: string, font: PDFFont, boldFont: PDFFont, fontSize: number, x: number, y: number, maxWidth: number, lineHeight: number): number {
    if (!text) return y;
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = font.widthOfTextAtSize(testLine.replace(new RegExp(boldText, 'g'), ' '.repeat(boldText.length)), fontSize) + boldFont.widthOfTextAtSize(boldText, fontSize) * (testLine.match(new RegExp(boldText, 'g')) || []).length;
        
        if (testWidth > maxWidth && line.length > 0) {
            drawTextWithBoldHighlight(page, line, boldText, font, boldFont, fontSize, x, currentY);
            line = word + ' ';
            currentY -= lineHeight;
        } else {
            line = testLine;
        }
    }
    if (line.trim().length > 0) {
        drawTextWithBoldHighlight(page, line.trim(), boldText, font, boldFont, fontSize, x, currentY);
    }
    
    return line.trim() ? currentY - lineHeight : y;
}

export async function generateClientIntakePdf(formData: any) {
    if (!formData) {
        throw new Error("Form data is missing.");
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    const logoBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
    const logoImage = await pdfDoc.embedPng(logoBytes);

    let page = pdfDoc.addPage(PageSizes.Letter);
    let { width, height } = page.getSize();
    
    const leftMargin = 50;
    const rightMargin = width - 50;
    const bottomMargin = 50;
    const contentWidth = rightMargin - leftMargin;
    let y = height - 75;

    const lineSpacing = 9.5;
    const sectionSpacing = 14;
    const mainFontSize = 8;
    const headerFontSize = 9.5;
    const fieldLabelFontSize = 8;
    const smallFontSize = 7;

    await drawHeader(page, pdfDoc, logoImage, boldFont);
    await drawFooter(page, font);
    
    const drawSectionHeader = (text: string, options: { centered?: boolean } = {}) => {
        const textWidth = boldFont.widthOfTextAtSize(text, headerFontSize);
        const xPos = options.centered ? (width / 2) - (textWidth / 2) : leftMargin;
        page.drawText(text, { x: xPos, y, font: boldFont, size: headerFontSize, color: rgb(0.1, 0.1, 0.1) });
        page.drawLine({
            start: { x: xPos, y: y - 2 },
            end: { x: xPos + textWidth, y: y - 2 },
            thickness: 0.5,
            color: rgb(0.1, 0.1, 0.1)
        });
        y -= lineSpacing * 1.5;
    };
    
    const drawField = async (label: string, value: any, x: number, currentY: number, options: { isCheckbox?: boolean, isDate?: boolean, valueXOffset?: number } = {}) => {
        page.drawText(`${label}:`, { x: x, y: currentY, font: boldFont, size: fieldLabelFontSize });
        const labelWidth = boldFont.widthOfTextAtSize(`${label}: `, fieldLabelFontSize);
        const valueX = x + (options.valueXOffset || labelWidth + 5);
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
            await drawText(page, displayValue, valueX, currentY, font, mainFontSize);
        }
    };
    
    const drawSignatureBlock = async (sigLabel: string, nameLabel: string, dateLabel: string, sigData: string | undefined, nameData: string | undefined, dateData: any) => {
        const blockY = y;
        page.drawLine({ start: { x: leftMargin, y: blockY - 15 }, end: { x: leftMargin + 200, y: blockY - 15 }, color: rgb(0, 0, 0), thickness: 0.5 });
        if(sigData) await drawSignature(page, sigData, leftMargin + 10, blockY - 10, 180, 40, pdfDoc);
        page.drawText(sigLabel, { x: leftMargin, y: blockY - 25, font: font, size: smallFontSize });

        page.drawLine({ start: { x: leftMargin + 250, y: blockY - 15 }, end: { x: leftMargin + 400, y: blockY - 15 }, color: rgb(0, 0, 0), thickness: 0.5 });
        await drawText(page, nameData, leftMargin + 255, blockY - 10, font, mainFontSize);
        page.drawText(nameLabel, { x: leftMargin + 250, y: blockY - 25, font: font, size: smallFontSize });
        
        const dateX = leftMargin + 410;
        page.drawLine({ start: { x: dateX, y: blockY - 15 }, end: { x: dateX + 100, y: blockY - 15 }, color: rgb(0, 0, 0), thickness: 0.5 });
        await drawText(page, dateData ? formatDate(dateData) : '', dateX + 5, blockY - 10, font, mainFontSize);
        page.drawText(dateLabel, { x: dateX, y: blockY - 25, font: font, size: smallFontSize });

        y -= 50;
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


    // --- PAGE 1 ---
    drawSectionHeader("CLIENT SERVICE AGREEMENT", { centered: true });
    const introText = "Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (the \"Agreement\") is entered into between the client, or his or her authorized representative, (the \"Client\") and FirstLight Home Care of Rancho Cucamonga CA, address 9650 Business Center drive, Suite 132, Rancho Cucamonga CA 91730 phone number 9093214466 (\"FirstLight Home Care\")";
    y = drawWrappedTextWithBoldHighlight(page, introText, "FirstLight Home Care of Rancho Cucamonga", font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= sectionSpacing / 2;

    drawSectionHeader("I. CLIENT INFORMATION", { centered: true });
    await drawField("Client Name", formData.clientName, leftMargin, y, {valueXOffset: 60});
    await drawField("Address", `${formData.clientAddress || ''}, ${formData.clientCity || ''}, ${formData.clientState || ''} ${formData.clientPostalCode || ''}`, leftMargin + 250, y, {valueXOffset: 45});
    y -= lineSpacing;
    await drawField("Phone", formData.clientPhone, leftMargin, y, {valueXOffset: 60});
    await drawField("Email", formData.clientEmail, leftMargin + 250, y, {valueXOffset: 45});
    y -= lineSpacing;
    await drawField("SSN", formData.clientSSN, leftMargin, y, {valueXOffset: 60});
    await drawField("DOB", formData.clientDOB ? format(new Date(formData.clientDOB), 'MM/dd/yyyy') : '', leftMargin + 250, y, {valueXOffset: 45});
    y -= sectionSpacing;

    await drawField("Emergency Contact Name", formData.emergencyContactName, leftMargin, y, {valueXOffset: 120});
    await drawField("Relationship", formData.emergencyContactRelationship, leftMargin + 250, y, {valueXOffset: 60});
    y -= lineSpacing;
    await drawField("Contact Home Phone", formData.emergencyContactHomePhone, leftMargin, y, {valueXOffset: 120});
    await drawField("Contact Work Phone", formData.emergencyContactWorkPhone, leftMargin + 250, y, {valueXOffset: 95});
    y -= sectionSpacing;

    await drawField("2nd Emergency Contact", formData.secondEmergencyContactName, leftMargin, y, {valueXOffset: 110});
    await drawField("Relationship", formData.secondEmergencyContactRelationship, leftMargin + 250, y, {valueXOffset: 60});
    await drawField("Phone", formData.secondEmergencyContactPhone, leftMargin + 400, y, {valueXOffset: 35});
    y -= sectionSpacing;

    await drawField("Homemaker/Companion", formData.homemakerCompanion, leftMargin, y, { isCheckbox: true, valueXOffset: 105 });
    await drawField("Personal Care", formData.personalCare, leftMargin + 250, y, { isCheckbox: true, valueXOffset: 70 });
    y -= sectionSpacing;
    
    const servicePlanText = "FirstLight Home Care of Rancho Cucamonga will provide non-medical in-home services (the \"Services\") specified in the attached Service Plan Agreement (the \"Service Plan\")";
    y = drawWrappedTextWithBoldHighlight(page, servicePlanText, "FirstLight Home Care of Rancho Cucamonga", font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= sectionSpacing;

    drawSectionHeader("II. PAYMENTS FOR THE SERVICES", { centered: true });
    const paymentText = `The hourly rate for providing the Services is $${formData.hourlyRate || '__'} per hour. The rate is based on the Client utilizing the services of FirstLight Home Care of Rancho Cucamonga for a minimum of ${formData.minimumHoursPerShift || '__'} hours per shift. The rates are provided on a current rate card dated ${formatDate(formData.rateCardDate)} and will be used to calculate the Client's rate for Services. Rates are subject to change with two (2) weeks' written notice (See attached rate sheet.).`;
    y = drawWrappedTextWithBoldHighlight(page, paymentText, "FirstLight Home Care of Rancho Cucamonga", font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= lineSpacing;
    
    const paymentText2 = "Invoices are to be presented on a regular scheduled basis. Payment is due upon receipt or not more than seven days after an invoice has been received by the Client. The Client should submit payment to the address listed above. Full refunds of any advance deposit fees collected for unused services will occur within ten (10) business days of last date of service. FirstLight Home Care of Rancho Cucamonga does not participate in and is not credentialed with any government or commercial health insurance plans and therefore does not submit bills or claims for Services as in-network, out-of-network or any other status to any government or commercial health plans. Client acknowledges and agrees that Client does not have insurance through any government health insurance plan; that Client requests to pay for Services out-of-pocket; and that because FirstLight Home Care of Rancho Cucamonga does not participate in or accept any form of government or commercial health insurance, FirstLight Home Care of Rancho Cucamonga will bill Client directly for the Services and Client is responsible for paying such charges.";
    y = drawWrappedTextWithBoldHighlight(page, paymentText2, "FirstLight Home Care of Rancho Cucamonga", font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= lineSpacing / 2;
    page.drawRectangle({x: leftMargin, y: y-20, width: contentWidth, height: 25, color: rgb(1, 0.9, 0.6)});
    const cancellationText = "If there is same day cancellation, client will be charged for full scheduled hours, except if there is a medical emergency.";
    y = drawWrappedText(page, cancellationText, boldFont, mainFontSize, leftMargin + 5, y - 5, contentWidth - 10, lineSpacing);
    y -= sectionSpacing * 1.5;
    
    drawSectionHeader("III. ACKNOWLEDGEMENT & AGREEMENT", { centered: true });
    const ackText = "The Client, or his or her authorized representative, consents to receive the Services and acknowledges he or she or they have read, accept, and consent to this Agreement, including the \"Terms and Conditions\" and all other attached documents, all of which are incorporated into this Agreement.";
    y = drawWrappedText(page, ackText, font, mainFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= lineSpacing * 1.5;

    await drawSignatureBlock("(Client Signature)","(Client Printed Name)","Date",formData.clientSignature,formData.clientPrintedName,formData.clientSignatureDate);
    await drawSignatureBlock("(Client Representative Signature)","(Client Representative Printed Name and Relationship to Client)","",formData.clientRepresentativeSignature,formData.clientRepresentativePrintedName,formData.clientRepresentativeSignatureDate);
    await drawSignatureBlock("(FirstLight Home Care of Representative Signature)","(FirstLight Home Care of Rancho Cucamonga Representative Title)","Date",formData.firstLightRepresentativeSignature,formData.firstLightRepresentativeTitle,formData.firstLightRepresentativeSignatureDate);

    // --- PAGE 2 & 3: TERMS AND CONDITIONS ---
    page = pdfDoc.addPage(PageSizes.Letter);
    await drawHeader(page, pdfDoc, logoImage, boldFont);
    await drawFooter(page, font);
    y = height - 75;
    const termFontSize = 8;
    const termLineSpacing = 10;

    drawSectionHeader("TERMS AND CONDITIONS", { centered: true });

    const terms = [
        { title: "BUSINESS OPERATIONS:", text: "FirstLight Home Care of Rancho Cucamonga is independently owned and operated as a franchisee of FirstLight Home Care Franchising, LLC. FirstLight Home Care of Rancho Cucamonga is licensed by the California Department of Social Services as a Home Care Organization (as defined in Cal. Health & Safety Code § 1796.12) and is in compliance with California Department of Social Services requirements, including registration and background check requirements for home care aids who work for Home Care Organizations." },
        { title: "FIRSTLIGHT CONTACT INFORMATION:", text: "If you have any questions, problems, needs or concerns, please contact the FirstLight Home Care of Rancho Cucamonga's designated representative, Lolita Pinto at phone number 9093214466 or by mail sent to the address above." },
        { title: "COMPLAINTS:", text: "To file a complaint, you may contact the FirstLight Home Care of Rancho Cucamonga's representative listed above. You may also contact the California Department of Social Services at 1-877-424-5778." },
        { title: "ABUSE REPORTING:", text: "Reports of abuse, neglect or financial exploitation may be made to local law enforcement or the county Adult Protective Services office or local law enforcement. FirstLight Home Care of Rancho Cucamonga will report any suspected or known dependent adult or elder abuse as required by Section 15630 of the Welfare and Institutions Code and suspected or known child abuse as required by Sections 11164 to 11174.3 of the Penal Code. A copy of each suspected abuse report shall be maintained." },
        { title: "DEPOSIT FOR SERVICES:", text: "A deposit in the amount sufficient to pay for at least two weeks of the Services may be required prior to the initiation of Services. Services are billed weekly and are due seven days after receipt of invoice. If hours increase the Client may be requested to make an additional deposit equaling the amount of hours added. Should hours decrease, the deposit will not be refunded until completion of Services. If for any reason Services are provided and payment has not been made in full to FirstLight Home Care of Rancho Cucamonga it is agreed the Client will pay all reasonable costs incurred by FirstLight Home Care of Rancho Cucamonga to collect said monies due, including collection fees, attorney fees and any other expenses incurred in the collection of all charges on the Client's account. If the Client utilizes ACH or Credit Card as the payment source a deposit may not be required." },
        { title: "HOLIDAY CHARGES:", text: "The 24 hour period constituting the following holidays may be billed at 1.5 times the regular hourly (or flat) rate. Please see RATE SHEET for additional information." },
        { title: "OVERTIME CHARGES:", text: "FirstLight Home Care of Rancho Cucamonga's work week begins on Monday at 12:00 am and ends 11:59 pm on Sunday. If the Client requests an In-Home Worker to work over 8 hours per work day the Client may be billed at 1.5 times the regular hourly rate or at such other amounts necessary for FirstLight Home Care of Rancho Cucamonga to meet its obligations under state and federal wage and hour laws. Additional fees may apply if the Client requests a \"live in\" employee." },
        { title: "INFORMATION REQUESTS:", text: "FirstLight Home Care of Rancho Cucamonga will adhere to a written policy addressing the confidentiality and permitted uses and disclosure of client records. Response to an inquiry or information request is normally done during business hours; however, inquiries or information requests made during evenings, weekends, or holidays will be addressed on the next business day." },
        { title: "EMERGENCY TREATMENT:", text: "FirstLight Home Care of Rancho Cucamonga In-Home Workers are not qualified or authorized to provide medical care or attention of any kind. If a medical emergency arises while a FirstLight Home Care of Rancho Cucamonga In-Home Worker is present, the In-Home Worker is instructed to call for emergency assistance. The Client holds harmless FirstLight Home Care of Rancho Cucamonga and its employees, agents, representatives, and affiliates for any medical attention provided resulting from instructions given by emergency service operators." },
        { title: "EMERGENCY CONTACT:", text: "At the Client's instruction, or if it appears to a FirstLight Home Care of Rancho Cucamonga In-Home Worker that a life-threatening or medical emergency may have occurred while a FirstLight Home Care of Rancho Cucamonga In-Home Worker is present, FirstLight Home Care of Rancho Cucamonga will immediately notify the appropriate emergency responders (9-1-1) and, as soon as reasonably feasible, the Client's Emergency Contact(s) indicated above." },
        { title: "INSURANCE:", text: `Client agrees to maintain homeowners or renters insurance on the Client's residence, which shall include coverages for dwelling, personal property and liability. Client agrees that such insurance shall be primary to and non- contributory with any other insurance that may cover claims, loss, or damages arising out of this Agreement or relating to the services provided hereunder. Client expressly releases and waives any and all rights of subrogation, contribution or indemnity the insurer may have against FirstLight Home Care of Rancho Cucamonga or its employees, agents, representatives, and affiliates. Client represents and certifies that the following insurance is in effect as of the date of this Agreement: Homeowners'/Renters' Insurance Company. The Client agrees not to entrust a FirstLight Home Care of Rancho Cucamonga In-Home Worker with unattended premises or any part thereof, or with the care, custody, or control of cash, negotiable, or other valuables without the prior written permission of FirstLight Home Care of Rancho Cucamonga and then only when the FirstLight Home Care of Rancho Cucamonga In-Home Worker's specific duties necessitate such activities.` },
        { title: "USE OF PREMISES:", text: "Client shall not do or suffer or permit anything to be done in or about the location where the Services are to be provided (the \"Premises\") which would in any way subject FirstLight Home Care of Rancho Cucamonga, its employees, agents, representatives, and affiliates to any liability or cause a cancellation of, or give rise to any defense by an insurer to any claim under, any policies for homeowners' or renters' insurance. Client shall not do or permit anything to be done in or about the Premises which will in any way conflict with any law, ordinance or governmental requirement now in force or which may hereafter be enacted. Client shall immediately furnish FirstLight Home Care of Rancho Cucamonga with any notices received from any insurance company or governmental agency or inspection bureau regarding any unsafe or unlawful conditions within the Premises. Client will indemnify, defend and hold harmless FirstLight Home Care of Rancho Cucamonga, any related entities, its affiliates, and each of their directors, officers, and employees (\"Indemnified Persons\") from and against any and all claims, actions, demands, liabilities, losses, damages, judgments, costs and expenses, including but not to, reasonable attorneys' fees, costs and interest, asserted against, imposed upon or incurred by Indemnified Persons that arise out of, or in connection with, the Client's failure to perform the obligations of this Section 12." },
        { title: "USE OF VEHICLE:", text: "FirstLight Home Care of Rancho Cucamonga will not operate a vehicle on the Client's behalf unless the Client executes the Transportation Waiver substantially in the form provided by FirstLight Home Care of Rancho Cucamonga as part of this Agreement." },
        { title: "HIRING:", text: `The investment FirstLight Home Care of Rancho Cucamonga makes in maintaining our quality caregivers and employees is substantial; therefore, it is agreed for a period of one year from the last day worked or for a period of one year after the Client stops utilizing FirstLight Home Care of Rancho Cucamonga Services, the Client agrees not to hire directly, or hire through any other company or agency, FirstLight Home Care of Rancho Cucamonga employees directly or indirectly who have personally provided care for the Client. If the Client wishes to hire a FirstLight Home Care of Rancho Cucamonga employee directly, the Client will notify FirstLight Home Care of Rancho Cucamonga of this intent in writing and a flat fee of $15,000.00 will be required to hire that employee directly. A written request by said employee will be required and must be approved by FirstLight Home Care of Rancho Cucamonga` },
        { title: "OTHER CONSIDERATIONS:", text: "The Client agrees that any claims made under the FirstLight Home Care of Rancho Cucamonga fidelity bond must be made in writing by the Client with ten (10) days of the occurrence. In addition, as a licensed California Home Care Organization FirstLight Home Care of Rancho Cucamonga maintains proof of general and professional liability insurance in the amount of $1 million per occurrence and $3 million in the aggregate and has an employee dishonesty bond with a minimum limit of $10,000, as required under Cal. Health & Safety Code § 1796.37; 1796.42." },
        { title: "TERM; TERMINATION:", text: "The term of this Agreement will be from the Contract Start Date until this Agreement is terminated under this section. Either party may terminate this Agreement at any time by providing seven (7) days' prior written notice to the other party stating the reason for termination. In instances of safety risk/hazard to a Client or a FirstLight Home Care of Rancho Cucamonga In-Home Worker or provision of the Services is otherwise prohibited by law, termination will be immediate with a stated reason for termination provided to the other party at the time of notification." },
        { title: "AMENDMENT; ENTIRE AGREEMENT:", text: "The Client agrees to notify FirstLight Home Care of Rancho Cucamonga of any requested changes in the duties of a FirstLight Home Care of Rancho Cucamonga employee from those agreed to on the Service Plan. This Agreement may be amended only upon the mutual written consent of the parties. This Agreement represents the entire agreement of the parties with respect to the subject matter hereof, and this Agreement supersedes all prior agreements and understandings with respect to such subject matter." },
        { title: "SEVERABILITY:", text: "The invalidity or partial invalidity of any portion of this Agreement will not invalidate the remainder thereof, and said remainder will remain in full force and effect. Moreover, if one or more of the provisions contained in this Agreement will, for any reason, be held to be excessively broad as to scope, activity, subject or otherwise, so as to be unenforceable at law, such provision or provisions will be construed by the appropriate judicial body by limiting or reducing it or them, so as to be enforceable to the maximum extent compatible with then applicable law." },
        { title: "INFORMATION AND DOCUMENTS RECEIVED:", text: "The Client acknowledges receipt of a copy of this Agreement, these Terms and Conditions and the following documents provided by FirstLight Home Care of Rancho Cucamonga and agrees to be bound by and comply with all of the same:" },
    ];
    
    for (const [index, term] of terms.entries()) {
        const fullText = term.text;
        
        const lines = fullText.split(' ').reduce((acc, word) => {
            let lastLine = acc[acc.length - 1];
            const width = font.widthOfTextAtSize(lastLine + ' ' + word, termFontSize);
            if (width > (contentWidth - 20)) {
                acc.push(word);
            } else {
                acc[acc.length - 1] = lastLine + (lastLine ? ' ' : '') + word;
            }
            return acc;
        }, ['']);

        const titleHeight = termLineSpacing;
        const textHeight = lines.length * termLineSpacing;
        let blockHeight = titleHeight + textHeight;

        // Adjust block height for special cases with form fields
        if (term.title === "INSURANCE:") blockHeight += termLineSpacing * 2.5;
        if (term.title === "HIRING:") blockHeight += termLineSpacing * 2.5;
        if (term.title === "INFORMATION AND DOCUMENTS RECEIVED:") blockHeight += termLineSpacing * 4;


        if (y - blockHeight < bottomMargin) {
            page = pdfDoc.addPage(PageSizes.Letter);
            await drawHeader(page, pdfDoc, logoImage, boldFont);
            await drawFooter(page, font);
            y = height - 75;
        }

        page.drawText(`${index + 1}.`, { x: leftMargin, y, font: boldFont, size: termFontSize });
        page.drawText(term.title, { x: leftMargin + 20, y, font: boldFont, size: termFontSize });
        y -= termLineSpacing;
        y = drawWrappedTextWithBoldHighlight(page, term.text, "FirstLight Home Care of Rancho Cucamonga", font, boldFont, termFontSize, leftMargin + 20, y, contentWidth - 20, termLineSpacing);
        y -= termLineSpacing * 0.5;
        
        if (term.title === "INSURANCE:") {
             y -= termLineSpacing;
             await drawField("Policy Number", formData.policyNumber, leftMargin + 20, y);
             await drawField("Policy Period", formData.policyPeriod, leftMargin + 270, y);
             y -= termLineSpacing * 1.5;
        }

        if (term.title === "HIRING:") {
             y -= termLineSpacing;
             await drawField("Client Initials", formData.clientInitials, leftMargin + 20, y);
             y -= termLineSpacing * 1.5;
        }
        
        if (term.title === "INFORMATION AND DOCUMENTS RECEIVED:") {
            y -= termLineSpacing;
            await drawField("Notice of Privacy Practices", formData.receivedPrivacyPractices, leftMargin + 20, y, { isCheckbox: true });
            await drawField("Client Rights and Responsibilities", formData.receivedClientRights, leftMargin + 270, y, { isCheckbox: true });
            y -= termLineSpacing;
            await drawField("Advance Directives", formData.receivedAdvanceDirectives, leftMargin + 20, y, { isCheckbox: true });
            await drawField("Rate Sheet", formData.receivedRateSheet, leftMargin + 270, y, { isCheckbox: true });
            y -= termLineSpacing;
            await drawField("Transportation Waiver", formData.receivedTransportationWaiver, leftMargin + 20, y, { isCheckbox: true });
            y -= termLineSpacing;
            const longLabel = "Agreement to Accept Payment Responsibility and Consent for Personal Information-Private Pay";
            await drawCheckbox(page, formData.receivedPaymentAgreement, leftMargin + 20, y, font);
            await drawText(page, longLabel, leftMargin + 35, y, font, termFontSize);
            y -= termLineSpacing * 1.5;
        }
    }

    // --- PAGE 4: SERVICE PLAN ---
    page = pdfDoc.addPage(PageSizes.Letter);
    await drawHeader(page, pdfDoc, logoImage, boldFont);
    await drawFooter(page, font);
    y = height - 75;

    drawSectionHeader("HOME CARE SERVICE PLAN AGREEMENT", { centered: true });

    await drawField("Client Name", formData.clientName, leftMargin, y, { valueXOffset: 65 });
    y -= lineSpacing * 1.5;

    y = drawWrappedText(page, "Frequency and duration of Services to be identified on individualized Client Service Plan", font, smallFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= sectionSpacing;

    const drawChecklistSection = async (title: string, items: {id: string, label: string}[], columnCount: number) => {
        page.drawText(title, { x: leftMargin, y, font: boldFont, size: headerFontSize });
        y -= lineSpacing * 1.5;
        const colWidth = contentWidth / columnCount;
        let itemY = y;
        let colIndex = 0;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const xPos = leftMargin + (colIndex * colWidth);
            await drawCheckbox(page, (formData as any)[item.id], xPos, itemY, font);
            await drawText(page, item.label, xPos + 15, itemY, font, mainFontSize);
            colIndex++;
            if (colIndex >= columnCount) {
                colIndex = 0;
                itemY -= lineSpacing;
            }
        }
        y = itemY - lineSpacing; // Move y down past the last row of checkboxes
    };

    const companionCareCheckboxes = [
        { id: 'companionCare_mealPreparation', label: 'Meal preparation and clean up' }, { id: 'companionCare_cleanKitchen', label: 'Clean kitchen - appliances, sinks, mop floors' },
        { id: 'companionCare_assistWithLaundry', label: 'Assist with laundry and ironing' }, { id: 'companionCare_dustFurniture', label: 'Dust furniture - living room, bedrooms, dining room' },
        { id: 'companionCare_assistWithEating', label: 'Assist with eating and proper nutrition' }, { id: 'companionCare_provideAlzheimersRedirection', label: "Provide Alzheimer's redirection - for safety" },
        { id: 'companionCare_assistWithHomeManagement', label: 'Assist with home management - mail, plants, calendar' }, { id: 'companionCare_preparationForBathing', label: 'Preparation for bathing and hair care' },
        { id: 'companionCare_groceryShopping', label: 'Grocery shopping' }, { id: 'companionCare_cleanBathrooms', label: 'Clean bathrooms - sink, tub, toilet' },
        { id: 'companionCare_changeBedLinens', label: 'Change bed linens and make bed' }, { id: 'companionCare_runErrands', label: 'Run errands - pick up prescription' },
        { id: 'companionCare_escortAndTransportation', label: 'Escort and transportation' }, { id: 'companionCare_provideRemindersAndAssistWithToileting', label: 'Provide reminders and assist with toileting' },
        { id: 'companionCare_provideRespiteCare', label: 'Provide respite care' }, { id: 'companionCare_stimulateMentalAwareness', label: 'Stimulate mental awareness - read' },
        { id: 'companionCare_assistWithDressingAndGrooming', label: 'Assist with dressing and grooming' }, { id: 'companionCare_assistWithShavingAndOralCare', label: 'Assist with shaving and oral care' },
    ];

    await drawChecklistSection("Companion Care Services", companionCareCheckboxes, 2);
    y -= lineSpacing;
    await drawField("Other", formData.companionCare_other, leftMargin, y, { valueXOffset: 30 });
    y -= sectionSpacing;

    const personalCareCheckboxes = [
        { id: 'personalCare_provideAlzheimersCare', label: "Provide Alzheimer's care, cognitive impairment" }, { id: 'personalCare_provideMedicationReminders', label: 'Provide medication reminders' },
        { id: 'personalCare_assistWithDressingGrooming', label: 'Assist with dressing, grooming' }, { id: 'personalCare_assistWithBathingHairCare', label: 'Assist with bathing, hair care' },
        { id: 'personalCare_assistWithFeedingSpecialDiets', label: 'Assist with feeding, special diets' }, { id: 'personalCare_assistWithMobilityAmbulationTransfer', label: 'Assist with mobility, ambulation and transfer' },
        { id: 'personalCare_assistWithIncontinenceCare', label: 'Assist with incontinence care' },
    ];
    await drawChecklistSection("Personal Care Services", personalCareCheckboxes, 2);
    y -= lineSpacing;
    await drawField("Assist with other", formData.personalCare_assistWithOther, leftMargin, y, { valueXOffset: 85 });
    y -= sectionSpacing;

    const disclaimerText = "Firstlight Home Care of Rancho Cucamonga provides Personal Care Services as defined under Cal. Health & Safety Code § 1796.12 and does not provide medical services or function as a home health agency.";
    y = drawWrappedTextWithBoldHighlight(page, disclaimerText, "Firstlight Home Care of Rancho Cucamonga", font, boldFont, smallFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= sectionSpacing;

    await drawField("Client Initials", formData.servicePlanClientInitials, leftMargin, y, { valueXOffset: 70 });
    
    // Office Use Only Box at the bottom
    let boxY = bottomMargin + 80;
    page.drawRectangle({x: leftMargin, y: boxY - 65, width: contentWidth / 2, height: 80, borderColor: rgb(0,0,0), borderWidth: 1});
    page.drawText("For Office Use Only", { x: leftMargin + (contentWidth / 4) - boldFont.widthOfTextAtSize("For Office Use Only", headerFontSize) / 2, y: boxY, font: boldFont, size: headerFontSize });
    
    let officeY = boxY - (lineSpacing * 2);
    await drawField("TODAY'S DATE", formData.officeTodaysDate, leftMargin + 10, officeY, { isDate: true, valueXOffset: 80 });
    officeY -= lineSpacing * 1.5;
    await drawField("REFERRAL DATE", formData.officeReferralDate, leftMargin + 10, officeY, { isDate: true, valueXOffset: 80 });
    officeY -= lineSpacing * 1.5;
    await drawField("DATE OF INITIAL CLIENT CONTACT", formData.officeInitialContactDate, leftMargin + 10, officeY, { isDate: true, valueXOffset: 150 });

    // --- PAGE 5: PAYMENT RESPONSIBILITY ---
    page = pdfDoc.addPage(PageSizes.Letter);
    await drawHeader(page, pdfDoc, logoImage, boldFont);
    await drawFooter(page, font);
    y = height - 75;

    const paymentTitle = "AGREEMENT TO ACCEPT PAYMENT RESPONSIBILITY AND CONSENT FOR USE AND DISCLOSURE OF PERSONAL INFORMATION-PRIVATE PAY";
    y = drawWrappedText(page, paymentTitle, boldFont, headerFontSize, leftMargin, y, contentWidth, lineSpacing * 1.2);
    y -= sectionSpacing;

    await drawField("Client Name", formData.agreementClientName, leftMargin, y, { valueXOffset: 70 });
    y -= sectionSpacing;
    
    const paymentPara1 = "I understand that Firstlight Home Care of Rancho Cucamonga may need to use or disclose my personal information to provide services to me, to obtain payment for its services and for all of the other reasons more fully described in Firstlight Home Care of Rancho Cucamonga Notice of Privacy Practices.";
    const paymentPara2 = "I acknowledge that I have received the Notice of Privacy Practices, and I consent to all of the uses and disclosures of my personal information as described in that document including, if applicable and as is necessary, for Firstlight Home Care of Rancho Cucamonga provide services to me; to coordinate with my other providers; to determine eligibility for payment, bill, and receive payment for services; and to make all other uses and disclosures described in the Notice of Privacy Practices.";
    const paymentPara3 = "My consent will be valid for two (2) years from the date below. I may revoke my consent to share information, in writing, at any time. Revoking my consent does not apply to information that has already been shared or affect my financial responsibility for Services. I understand that some uses and sharing of my information are authorized by law and do not require my consent.";
    
    y = drawWrappedTextWithBoldHighlight(page, paymentPara1, "Firstlight Home Care of Rancho Cucamonga", font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= lineSpacing;
    y = drawWrappedTextWithBoldHighlight(page, paymentPara2, "Firstlight Home Care of Rancho Cucamonga", font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= lineSpacing;
    y = drawWrappedText(page, paymentPara3, font, mainFontSize, leftMargin, y, contentWidth, lineSpacing);
    y -= sectionSpacing * 2;

    await drawSignatureBlock("Client Signature/Responsible Party", "", "Date", formData.agreementClientSignature, "", formData.agreementSignatureDate);
    y -= sectionSpacing;
    await drawField("Relationship if not Client", formData.agreementRelationship, leftMargin, y, { valueXOffset: 120 });
    y -= sectionSpacing * 2;
    await drawSignatureBlock("FirstLight Home Care of Rancho Cucamonga Representative", "", "Date", formData.agreementRepSignature, "", formData.agreementRepDate);
    

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}
