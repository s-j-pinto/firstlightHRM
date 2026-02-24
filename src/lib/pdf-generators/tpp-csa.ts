

'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { sanitizeText, drawText, drawCheckbox, drawSignature, drawWrappedText, drawCenteredText } from './utils';
import type { ClientSignupFormData } from '../types';

const addHeaderAndFooter = (page: PDFPage, logoImage: any, logoDims: any, pageNum: number, totalPages: number, font: PDFFont) => {
    const { width, height } = page.getSize();
    page.drawImage(logoImage, {
        x: 50,
        y: height - 30 - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
    });
    drawText(page, `NO. ${'00000'}`, { x: width - 50 - font.widthOfTextAtSize(`NO. 00000`, 10), y: height - 40, font, size: 10, color: rgb(0.8, 0, 0) });
    
    const footerLeftText = `Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated.`;
    drawText(page, footerLeftText, { x: 50, y: 30, font, size: 7 });

    const footerRightText = `FIRST-0084-A (10/2018)          Page ${pageNum} of ${totalPages}`;
    drawText(page, footerRightText, { x: width - 50 - font.widthOfTextAtSize(footerRightText, 7), y: 30, font, size: 7 });
};

const drawField = (page: PDFPage, y: number, label: string, value: string | undefined | null, font: PDFFont, boldFont: PDFFont, size: number, x: number, valueX: number) => {
    drawText(page, `${label}:`, { x: x, y, font: boldFont, size });
    if(value) {
        drawText(page, value, { x: valueX, y, font, size });
    }
};

async function drawFormattedWrappedText(page: PDFPage, text: string, font: PDFFont, boldFont: PDFFont, fontSize: number, x: number, y: number, maxWidth: number, lineHeight: number): Promise<number> {
    const sanitized = sanitizeText(text);
    let currentY = y;

    const paragraphs = sanitized.split('\n').filter(p => p.trim() !== '');

    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine.length > 0 ? `${currentLine} ${word}` : word;
            
            const testLineWidth = testLine.split(/(FirstLight Home Care of Rancho Cucamonga|FirstLight Home Care)/g).reduce((acc, part) => {
                const isBold = part === "FirstLight Home Care of Rancho Cucamonga" || part === "FirstLight Home Care";
                return acc + (isBold ? boldFont : font).widthOfTextAtSize(part, fontSize);
            }, 0);

            if (testLineWidth > maxWidth && currentLine.length > 0) {
                let tempX = x;
                currentLine.split(/(FirstLight Home Care of Rancho Cucamonga|FirstLight Home Care)/g).forEach(part => {
                    const isBold = part === "FirstLight Home Care of Rancho Cucamonga" || part === "FirstLight Home Care";
                    page.drawText(part, { x: tempX, y: currentY, font: isBold ? boldFont : font, size: fontSize, color: rgb(0,0,0) });
                    tempX += (isBold ? boldFont : font).widthOfTextAtSize(part, fontSize);
                });
                currentY -= lineHeight;
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine.length > 0) {
            let tempX = x;
            currentLine.split(/(FirstLight Home Care of Rancho Cucamonga|FirstLight Home Care)/g).forEach(part => {
                const isBold = part === "FirstLight Home Care of Rancho Cucamonga" || part === "FirstLight Home Care";
                page.drawText(part, { x: tempX, y: currentY, font: isBold ? boldFont : font, size: fontSize, color: rgb(0,0,0) });
                tempX += (isBold ? boldFont : font).widthOfTextAtSize(part, fontSize);
            });
            currentY -= lineHeight;
        }
    }
    return currentY; 
}


const tppTerms = [
    { title: "BUSINESS OPERATIONS", text: "FirstLight Home Care is independently owned and operated as a franchisee of FirstLight Home Care Franchising, LLC. FirstLight Home Care meets all requirements of the State of California to provide non-medical in-home personal care, companion and homemaker services. Additional information about FirstLight Home Care that is required to be disclosed under the state law can be found in Section 15 of this Agreement." },
    { title: "FIRSTLIGHT CONTACT INFORMATION", text: "If you have any question, problems, needs or concerns, please contact the FirstLight Home Care of Rancho Cucamonga contact Lolita Pinto at 9093214466 or by mail sent to the address above." },
    { title: "COMPLAINTS", text: "To file a complaint, you may contact the manager listed above or the appropriate State reporting agency. In cases of allegations of abuse or neglect by an employee of FirstLight Home Care a complete investigation will be completed as soon as possible, and FirstLight Home Care will complete a written report within 14 days of the initial complaint unless state law requires earlier reporting in which case that requirements shall apply. The written report shall include the date, time, and description of alleged abuse, neglect, or financial exploitation; description of any injury or abuse of the Client; any actions taken by FirstLight Home Care; a description of actions taken to prevent  future abuse or other crime, or when death (other than by disease or actual causes) has occurred." },
    { title: "ABUSE REPORTING", text: "Reports of abuse, neglect or financial exploitation may be made by Client at any time to local law enforcement. FirstLight Home Care will report any suspected or known dependent adult or elder abuse and otherwise comply with all mandatory reporting laws including, but not to, to making reports to law enforcement if an allegation of physical abuse, sexual abuse or other crime, or when death (other than by disease or actual causes) has occurred." },
    { title: "INFORMATION REQUESTS", text: "FirstLight Home Care will adhere to a written policy addressing the confidentiality and permitted uses and disclosure of Client records as well as applicable provisions of state and federal law and its Payor Agreement. Response to an inquiry or information request is normally done during business hours however, inquiries or information requests made during evenings, weekends, or holidays will be addressed on the next business day." },
    { title: "EMERGENCY TREATMENT", text: "FirstLight Home Care caregivers and employees are not licensed, qualified or authorized to provide medical care or attention of any kind. If a medical emergency arises while a FirstLight Home Care employee is present, the employee is instructed to call for emergency assistance. The Client holds harmless FirstLight Home Care and its employees, agents, representatives, and affiliates for any medical attention provided resulting from instructions given by emergency services operators." },
    { title: "EMERGENCY CONTACT", text: "At the Client's instruction, or if it appears to a FirstLight Home Care employee that a life-threatening or medical emergency may have occurred while a FirstLight Home Care employee is present, FirstLight Home Care will immediately notify the appropriate emergency responders (9-1-1) and, as soon as reasonable feasible, the Client's Emergency Contact(s) indicated above." },
    { title: "USE OF PREMISES", text: "Client shall not do or suffer or permit anything to be done in or about the location where the Services are to be provided (the \"Premises\") which would in any way subject FirstLight Home Care of Rancho Cucamonga, its employees, agents, representatives, and affiliates to any liability or cause a cancellation of, or give rise to any defense by an insurer to any claim under, any policies for homeowners' or renters' insurance. Client shall not do or permit anything to be done in or about the Premises which will in any way conflict with any law, ordinance or governmental requirement now in force or which may hereafter be enacted. Client shall immediately furnish FirstLight Home Care of Rancho Cucamonga with any notices received from any insurance company or governmental agency or inspection bureau regarding any unsafe or unlawful conditions within the Premises. Client will indemnify, defend and hold harmless FirstLight Home Care of Rancho Cucamonga, any related entities, its affiliates, and each of their directors, officers, and employees (\"Indemnified Persons\") from and against any and all claims, actions, demands, liabilities, losses, damages, judgments, costs and expenses, including but not to, reasonable attorneys' fees, costs and interest, asserted against, imposed upon or incurred by Indemnified Persons that arise out of, or in connection with, the Client's failure to perform the obligations of this Section 8." },
    { title: "USE OF VEHICLE", text: "FirstLight Home Care of Rancho Cucamonga will not operate a vehicle on the Client's behalf unless the Client executes the Transportation Waiver substantially in the form provided by FirstLight Home Care of Rancho Cucamonga as part of this Agreement." },
    { title: "HIRING:", text: `The investment FirstLight Home Care makes in recruiting, training, developing, and maintaining employees as quality caregiver is a substantial cost of maintaining its business model and excellent service to clients. Client agrees, therefore, that except upon notice and the payment of a development fee as describes further below in this paragraph Client will not hire or otherwise utilize directly in any way, nor hire or engage or contract through any other company or agency for, the services of any employee of FirstLight Home Care for the restricted period of: i) one year from the last day worked by the employee for FirstLight Home Care; or ii) one year after the client stops utilizing FirstLight Home Care services, whichever ends sooner. If Client wishes to hire or otherwise engage the services of an employee before the expiration of the applicable one year restricted period above, Client must first provide written notice of such intent and payment in full of development fee of $15,000.00 to FirstLight Home Care. Hiring or otherwise utilizing directly or engaging or contracting for the services of an employee in contravention of this paragraph is a material breach of this agreement. In the event of such breach Client agrees to be liable for an award of money damages to FirstLight Home Care and for any and all other remedies available.` },
    { title: "OTHER CONSIDERATIONS:", text: "The Client agrees that any claims made under the FirstLight Home Care fidelity bond must be made in writing by the Client within ten (10) days of the occurrence or such longer period of time if required under applicable provisions of state law." },
    { title: "TERM; TERMINATION:", text: "The term of this Agreement will be from the Contract Start Date until this Agreement is terminated under this section. Either party may terminate this Agreement at any time by providing seven (7) days' prior written notice to the other party stating the reason for termination. In instances of safety risk/hazard to a Client or a FirstLight Home Care of Rancho Cucamonga In-Home Worker or provision of the Services is otherwise prohibited by law, termination will be immediate with a stated reason for termination provided to the other party at the time of notification. Notwithstanding the foregoing, FirstLight Home Care will comply with all the obligations under state law and the terms of its agreement with Payor as pertains to termination of this Agreement and nothing in this section 12 shall permit FirstLight Home Care to violate its commitment to Payors under the Payor Agreement." },
    { title: "AMENDMENT; ENTIRE AGREEMENT:", text: "The Client agrees to notify FirstLight Home Care of any requested changes in the duties of a FirstLight Home Care of Rancho Cucamonga employee from those agreed to on the Client's plan of care or authorization from Payor. This Agreement may be amended only upon the mutual written consent of the parties. This Agreement represents the entire agreement of Client and FirstLight Home Care with respect to such subject matter. FirstLight Home Care acknowledges that Client's financial responsibility is governed by the Payor Agreement." },
    { title: "SEVERABILITY:", text: "The invalidity or partial invalidity of any portion of this Agreement will not invalidate the remainder thereof, and said remainder will remain in full force and effect. Moreover, if one or more of the provisions contained in this Agreement will, for any reason, be held to be excessively broad as to scope, activity, subject or otherwise, so as to be unenforceable at law, such provision or provisions will be construed by the appropriate judicial body by limiting or reducing it or them, so as to be enforceable to the maximum extent compatible with then applicable law." },
    { title: "INFORMATION AND DOCUMENTS RECEIVED:", text: "The Client acknowledges receipt of a copy of this Agreement, these Terms and Conditions and the following documents provided by FirstLight Home Care of Rancho Cucamonga and agrees to be bound by and comply with all of the same:" },
];

export async function generateTppCsaPdf(formData: ClientSignupFormData): Promise<Buffer> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.2);

        const allPages: PDFPage[] = [];
        const addNewPage = () => {
            const newPage = pdfDoc.addPage(PageSizes.Letter);
            allPages.push(newPage);
            return newPage;
        };
        
        // Start with the first 3 pages
        addNewPage();
        addNewPage();
        addNewPage();

        // --- Page 1: Client Info & Signatures ---
        let page = allPages[0];
        let { width, height } = page.getSize();
        let y = height - 80;
        const leftMargin = 60;
        const contentWidth = width - leftMargin * 2;
        const lineHeight = 8;
        const mainFontSize = 6;
        const titleFontSize = 8;
        const signatureLabelFontSize = 6;

        // Title
        y = drawCenteredText(page, "THIRD PARTY PAYOR CLIENT SERVICE AGREEMENT", boldFont, 11, y);
        y -= 15;

        // Intro
        const introText = `Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (this "Agreement") is entered into between the client, or his or her authorized representative, (the “Client”) and FirstLight Home Care of Rancho Cucamonga (“FirstLight Home Care”).`;
        y = await drawFormattedWrappedText(page, introText, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;
        
        const tppIntro = `FirstLight Home Care will provide non-medical in-hime services (the “services”) specified in the Payor’s authorization and/or Client plan of care as made available by Payor to FirstLight Home Care pursuant to the “Payor Agreement”  (as defined below). It is anticipated that Payor will provide Client-specific information to FirstLight Home Care as part of the Payor’s authorization and/or Client plan of care as FirstLight Home Care needs to render the Services and be reimbursed for such Services by the Payor. However Client will cooperate with FirstLight Home Care to the extent FirstLight Home Care requires additional information from Client related to Client in order to provide the Services.`;
        y = await drawFormattedWrappedText(page, tppIntro, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        // I. CLIENT INFORMATION
        y = drawCenteredText(page, "I. CLIENT INFORMATION", boldFont, titleFontSize, y);
        y -= 10;

        // Draw Client Info Fields
        drawField(page, y, "Client Name", formData.clientName, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        const officeDate = formData.officeTodaysDate ? (typeof formData.officeTodaysDate === 'string' ? formData.officeTodaysDate : format(new Date(formData.officeTodaysDate), "MM/dd/yyyy")) : '';
        drawField(page, y, "Date", officeDate, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        y -= 20;

        const fullAddress = [formData.clientAddress, formData.clientCity, formData.clientState, formData.clientPostalCode].filter(Boolean).join(', ');
        drawField(page, y, "Address", fullAddress, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        y -= 20;

        drawField(page, y, "Phone", formData.clientPhone, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        const dobFormatted = formData.clientDOB ? (typeof formData.clientDOB === 'string' ? formData.clientDOB : format(new Date(formData.clientDOB), "MM/dd/yyyy")) : '';
        drawField(page, y, "DOB", dobFormatted, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        y -= 20;

        drawText(page, "Emergency Contact:", { x: leftMargin, y, font: boldFont, size: titleFontSize });
        y -= 15;
        drawField(page, y, "Name", formData.emergencyContactName, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        drawField(page, y, "Relationship", formData.emergencyContactRelationship, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 400);
        y -= 20;
        drawField(page, y, "Home Phone", formData.emergencyContactHomePhone, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        drawField(page, y, "Work Phone", formData.emergencyContactWorkPhone, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 400);
        y -= 20;
        
        drawText(page, "2nd Emergency Contact:", { x: leftMargin, y, font: boldFont, size: titleFontSize });
        y -= 15;
        drawField(page, y, "Name", formData.secondEmergencyContactName, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        drawField(page, y, "Relationship", formData.secondEmergencyContactRelationship, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 400);
        y -= 20;
        drawField(page, y, "Phone", formData.secondEmergencyContactPhone, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        y -= 20;

        drawCheckbox(page, formData.homemakerCompanion, leftMargin, y);
        drawText(page, "Homemaker/Companion", { x: leftMargin + 20, y, font, size: mainFontSize });
        drawCheckbox(page, formData.personalCare, leftMargin + 200, y);
        drawText(page, "Personal Care", { x: leftMargin + 220, y, font, size: mainFontSize });
        y -= 20;
        
        drawText(page, "Scheduled Frequency:", {x: leftMargin, y, font: boldFont, size: mainFontSize});
        drawText(page, `Days/Wk: ${formData.daysPerWeek || ''}`, {x: leftMargin + 150, y, font, size: mainFontSize});
        drawText(page, `Hrs/Day: ${formData.hoursPerDay || ''}`, {x: leftMargin + 250, y, font, size: mainFontSize});
        const startDate = formData.contractStartDate ? (typeof formData.contractStartDate === 'string' ? formData.contractStartDate : format(new Date(formData.contractStartDate), 'MM/dd/yyyy')) : '';
        drawText(page, `Services Start Date: ${startDate}`, {x: leftMargin + 350, y, font, size: mainFontSize});
        y -= 20;
        
        // II. PAYMENTS FOR THE SERVICES
        y = drawCenteredText(page, "II. PAYMENTS FOR THE SERVICES", boldFont, titleFontSize, y);
        y -= 10;
        const payorText = `${formData.payor || '________________'} (“Payor”) will reimburse FirstLight Home Care agreement between FirstLight Home Care and Payor (“Payor Agreement”). FirstLight Home Care will submit claims to Payor in accordance with the provisions of the Payor Agreement and applicable requirements under state or federal law. To the extent Client owes FirstLight Home Care for any cost sharing or other financial obligation for the Services, such amounts shall be determined by Payor in accordance with the Payor Agreement and applicable provisions of state and federal law. Client agrees to notify FirstLight Home Care if Client becomes ineligible to receive the Services under this Agreement. Additional service (payable by Client out of pocket and not covered by Payor) (the “Private Pay Services”) can be arranged upon Client request; provided, however, that FirstLight Home Care’s ability to render Private Pay Services depends on the Payor Agreement and applicable provisions of state and federal law. A separate FirstLight Home Care Private Pay Client Service Agreement must be executed prior to initiation of Private Pay Services.`;
        y = await drawFormattedWrappedText(page, payorText, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        // III. ACKNOWLEDGEMENT & AGREEMENT
        y = drawCenteredText(page, "III. ACKNOWLEDGEMENT & AGREEMENT", boldFont, titleFontSize, y);
        y -= 10;
        const ackText = `The Client, or his or her authorized representative, consents to receive the Services and acknowledges he or she or they have read, accept, and consent to this Agreement, including the "Terms and Conditions" and all other attached documents, all of which are incorporated into this Agreement.`;
        y = await drawFormattedWrappedText(page, ackText, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 30;

        // Signatures
        const sigY = y;
        await drawSignature(page, formData.clientSignature, leftMargin, sigY, 250, 40, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: sigY-5 }, end: { x: leftMargin + 250, y: sigY-5 }, thickness: 0.5 });
        drawText(page, "Signed (Client)", { x: leftMargin, y: sigY-15, font: font, size: signatureLabelFontSize });

        const clientSigDate = formData.clientSignatureDate ? (typeof formData.clientSignatureDate === 'string' ? formData.clientSignatureDate : format(new Date(formData.clientSignatureDate), 'MM/dd/yyyy')) : '';
        drawField(page, sigY, "Date", clientSigDate, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        page.drawLine({ start: { x: leftMargin + 350, y: sigY - 5}, end: {x: leftMargin + 500, y: sigY - 5}, thickness: 0.5 });
        y -= 50;

        const repSigY = y;
        await drawSignature(page, formData.clientRepresentativeSignature, leftMargin, repSigY, 250, 40, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: repSigY - 5 }, end: { x: leftMargin + 250, y: repSigY - 5 }, thickness: 0.5 });
        drawText(page, "Signed (Responsible Party)", { x: leftMargin, y: repSigY - 15, font: font, size: signatureLabelFontSize });

        const repSigDate = formData.clientRepresentativeSignatureDate ? (typeof formData.clientRepresentativeSignatureDate === 'string' ? formData.clientRepresentativeSignatureDate : format(new Date(formData.clientRepresentativeSignatureDate), 'MM/dd/yyyy')) : '';
        drawField(page, repSigY, "Date", repSigDate, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        page.drawLine({ start: { x: leftMargin + 350, y: repSigY-5 }, end: { x: leftMargin + 500, y: repSigY-5}, thickness: 0.5 });
        y -= 50;
        
        const firstlightSigY = y;
        await drawSignature(page, formData.firstLightRepresentativeSignature, leftMargin, firstlightSigY, 250, 40, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: firstlightSigY - 5 }, end: { x: leftMargin + 250, y: firstlightSigY - 5 }, thickness: 0.5 });
        drawText(page, "(FirstLight Home Care of Representative Signature)", { x: leftMargin, y: firstlightSigY - 15, font: font, size: signatureLabelFontSize });

        const firstlightSigDate = formData.firstLightRepresentativeSignatureDate ? (typeof formData.firstLightRepresentativeSignatureDate === 'string' ? formData.firstLightRepresentativeSignatureDate : format(new Date(formData.firstLightRepresentativeSignatureDate), 'MM/dd/yyyy')) : '';
        drawField(page, firstlightSigY, "Date", firstlightSigDate, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        page.drawLine({ start: { x: leftMargin + 350, y: firstlightSigY - 5 }, end: { x: leftMargin + 500, y: firstlightSigY - 5 }, thickness: 0.5 });

        // --- Page 2-3: Terms and Conditions ---
        let currentPageIndex = 1;
        y = height - 80;
        
        for (let i = 0; i < tppTerms.length; i++) {
            page = allPages[currentPageIndex];
            
            if (i === 0) {
                 y = drawCenteredText(page, "TERMS AND CONDITIONS", boldFont, titleFontSize, y);
                 y -= 10;
            }

            const term = tppTerms[i];
            const termTitleHeight = boldFont.heightAtSize(mainFontSize) + 5; 
            const termTextHeight = font.heightAtSize(mainFontSize) * Math.ceil(font.widthOfTextAtSize(sanitizeText(term.text), mainFontSize) / contentWidth) + 10;
            let estimatedHeight = termTitleHeight + termTextHeight;
            if(term.title === "HIRING:") estimatedHeight += 40;
            if (term.title === "INFORMATION AND DOCUMENTS RECEIVED:") estimatedHeight += 60;

            if (y < estimatedHeight + 60) {
                currentPageIndex++;
                if (currentPageIndex >= allPages.length) {
                    addNewPage(); // Should not happen with 3 pages but as a safeguard.
                } 
                page = allPages[currentPageIndex];
                y = height - 80;
            }

            y = await drawFormattedWrappedText(page, term.title, boldFont, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
            y = await drawFormattedWrappedText(page, sanitizeText(term.text), font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
            y -= 10;
            
            if (term.title === "HIRING:") {
                 y-=10;
                 drawText(page, `Client Initials: ${formData.clientInitials || '_____'}`, {x: leftMargin, y, font, size: mainFontSize});
                 y -= 20;
            } else if (term.title === "INFORMATION AND DOCUMENTS RECEIVED:") {
                y -= 5;
                drawCheckbox(page, formData.receivedPrivacyPractices, leftMargin + 10, y);
                drawText(page, "Notice of Privacy Practices", {x: leftMargin + 25, y, font, size: mainFontSize});
                y -= 20;
                drawCheckbox(page, formData.receivedTransportationWaiver, leftMargin + 10, y);
                drawText(page, "Transportation Waiver", {x: leftMargin + 25, y, font, size: mainFontSize});
                y -= 20;
                drawCheckbox(page, formData.receivedAdditionalDisclosures, leftMargin + 10, y);
                drawText(page, "Additional State Law Disclosures", {x: leftMargin + 25, y, font, size: mainFontSize});
                y -= 20;
                drawText(page, `Client Initials: ${formData.clientInitials || '_____'}`, {x: leftMargin+10, y, font, size: mainFontSize});
                y -= 20;
            }
        }
        
        // --- Transportation Waiver (Optional 4th page) ---
        if (formData.receivedTransportationWaiver) {
            page = addNewPage();
            y = page.getHeight() - 80;
            y = drawCenteredText(page, "Transportation Waiver", boldFont, 11, y);
            y -= 30;

            const waiverText = [
                "FirstLight Home Care offers transportation as a convenience to our clients, not as a standalone service.",
                "Upon signing of this waiver, I understand I am authorizing an employee of FirstLight Home Care to furnish transportation for me as a passenger in either their automobile or my own.",
                "I will follow all applicable laws, including, but not limited to, the wearing of my seatbelt.",
                "When the FirstLight Home Care employee drives my vehicle, I certify current insurance for both liability and physical damage.",
                "Further, I accept responsibility for any deductibles on my personal automobile insurance coverage incurred as a result of this service.",
                "I specifically accept these risks and waive any claim that I might otherwise have against FirstLight Home Care with respect to bodily injury or property damage sustained by me in connection with said transportation, and hereby expressly release FirstLight Home Care and their employees from any and all liability therewith."
            ];

            for(const p of waiverText) {
                y = await drawFormattedWrappedText(page, p, font, boldFont, mainFontSize + 1, leftMargin, y, contentWidth, lineHeight + 4);
                y -= 15;
            };
            y -= 30;
            
            const waiverSigY = y;
            await drawSignature(page, formData.transportationWaiverClientSignature, leftMargin + 250, waiverSigY, 150, 30, pdfDoc);
            page.drawLine({ start: { x: leftMargin + 240, y: waiverSigY - 5 }, end: { x: leftMargin + 420, y: waiverSigY - 5 }, thickness: 0.5 });
            drawText(page, "Signed (Client or Responsible Party)", { x: leftMargin + 240, y: waiverSigY - 15, font, size: 8 });
            
            drawText(page, formData.transportationWaiverClientPrintedName || '', { x: leftMargin, y: waiverSigY, font, size: 10 });
            page.drawLine({ start: { x: leftMargin, y: waiverSigY - 5 }, end: { x: leftMargin + 200, y: waiverSigY - 5 }, thickness: 0.5 });
            drawText(page, "Printed Name", { x: leftMargin, y: waiverSigY - 15, font, size: 8 });

            y -= 50;
            
            const witnessSigY = y;
            await drawSignature(page, formData.transportationWaiverWitnessSignature, leftMargin + 250, witnessSigY, 150, 30, pdfDoc);
            page.drawLine({ start: { x: leftMargin + 240, y: witnessSigY - 5 }, end: { x: leftMargin + 420, y: witnessSigY - 5 }, thickness: 0.5 });
            drawText(page, "Witness (FirstLight Home Care Representative)", { x: leftMargin + 240, y: witnessSigY - 15, font, size: 8 });

            const waiverDate = (formData.transportationWaiverDate && (formData.transportationWaiverDate.toDate || isDate(formData.transportationWaiverDate))) ? format(formData.transportationWaiverDate.toDate ? formData.transportationWaiverDate.toDate() : formData.transportationWaiverDate, "MM/dd/yyyy") : '';
            drawText(page, waiverDate, { x: leftMargin, y: witnessSigY, font, size: 10 });
            page.drawLine({ start: { x: leftMargin, y: witnessSigY - 5 }, end: { x: leftMargin + 180, y: witnessSigY - 5 }, thickness: 0.5 });
            drawText(page, "Date", { x: leftMargin, y: witnessSigY - 15, font, size: 8 });
        }
        
        // Add headers and footers to all pages
        allPages.forEach((p, i) => addHeaderAndFooter(p, logoImage, logoDims, i + 1, allPages.length, font));
        
        // Finalize and save
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    } catch (error: any) {
        console.error("Error generating TPP CSA PDF:", error);
        throw new Error(`Failed to generate PDF: ${error.message}`);
    }
}
        
