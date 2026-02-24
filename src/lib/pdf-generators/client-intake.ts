

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


const privatePayTerms = [
    { title: "1. BUSINESS OPERATIONS:", text: "FirstLight Home Care of Rancho Cucamonga is independently owned and operated as a franchisee of FirstLight Home Care Franchising, LLC. FirstLight Home Care of Rancho Cucamonga is licensed by the California Department of Social Services as a Home Care Organization (as defined in Cal. Health & Safety Code § 1796.12) and is in compliance with California Department of Social Services requirements, including registration and background check requirements for home care aids who work for Home Care Organizations." },
    { title: "2. FIRSTLIGHT CONTACT INFORMATION:", text: "If you have any questions, problems, needs or concerns, please contact the FirstLight Home Care of Rancho Cucamonga's designated representative, Lolita Pinto at phone number 9093214466 or by mail sent to the address above." },
    { title: "3. COMPLAINTS:", text: "To file a complaint, you may contact the FirstLight Home Care of Rancho Cucamonga's representative listed above. You may also contact the California Department of Social Services at 1-877-424-5778." },
    { title: "4. ABUSE REPORTING:", text: "Reports of abuse, neglect or financial exploitation may be made to local law enforcement or the county Adult Protective Services office or local law enforcement. FirstLight Home Care of Rancho Cucamonga will report any suspected or known dependent adult or elder abuse as required by Section 15630 of the Welfare and Institutions Code and suspected or known child abuse as required by Sections 11164 to 11174.3 of the Penal Code. A copy of each suspected abuse report shall be maintained." },
    { title: "5. DEPOSIT FOR SERVICES:", text: "A deposit in the amount sufficient to pay for at least two weeks of the Services may be required prior to the initiation of Services. Services are billed weekly and are due seven days after receipt of invoice. If hours increase the Client may be requested to make an additional deposit equaling the amount of hours added. Should hours decrease, the deposit will not be refunded until completion of Services. If for any reason Services are provided and payment has not been made in full to FirstLight Home Care of Rancho Cucamonga it is agreed the Client will pay all reasonable costs incurred by FirstLight Home Care of Rancho Cucamonga to collect said monies due, including collection fees, attorney fees and any other expenses incurred in the collection of all charges on the Client's account. If the Client utilizes ACH or Credit Card as the payment source a deposit may not be required." },
    { title: "6. HOLIDAY CHARGES:", text: "The 24 hour period constituting the following holidays may be billed at 1.5 times the regular hourly (or flat) rate. Please see RATE SHEET for additional information." },
    { title: "7. OVERTIME CHARGES:", text: "FirstLight Home Care of Rancho Cucamonga's work week begins on Monday at 12:00 am and ends 11:59 pm on Sunday. If the Client requests an In-Home Worker to work over 8 hours per work day the Client may be billed at 1.5 times the regular hourly rate or at such other amounts necessary for FirstLight Home Care of Rancho Cucamonga to meet its obligations under state and federal wage and hour laws. Additional fees may apply if the Client requests a \"live in\" employee." },
    { title: "8. INFORMATION REQUESTS:", text: "FirstLight Home Care of Rancho Cucamonga will adhere to a written policy addressing the confidentiality and permitted uses and disclosure of client records. Response to an inquiry or information request is normally done during business hours; however, inquiries or information requests made during evenings, weekends, or holidays will be addressed on the next business day." },
    { title: "9. EMERGENCY TREATMENT:", text: "FirstLight Home Care of Rancho Cucamonga In-Home Workers are not qualified or authorized to provide medical care or attention of any kind. If a medical emergency arises while a FirstLight Home Care of Rancho Cucamonga In-Home Worker is present, the In-Home Worker is instructed to call for emergency assistance. The Client holds harmless FirstLight Home Care of Rancho Cucamonga and its employees, agents, representatives, and affiliates for any medical attention provided resulting from instructions given by emergency service operators." },
    { title: "10. EMERGENCY CONTACT:", text: "At the Client's instruction, or if it appears to a FirstLight Home Care of Rancho Cucamonga In-Home Worker that a life-threatening or medical emergency may have occurred while a FirstLight Home Care of Rancho Cucamonga In-Home Worker is present, FirstLight Home Care of Rancho Cucamonga will immediately notify the appropriate emergency responders (9-1-1) and, as soon as reasonably feasible, the Client's Emergency Contact(s) indicated above." },
    { title: "11. INSURANCE:", text: "Client agrees to maintain homeowners or renters insurance on the Client's residence, which shall include coverages for dwelling, personal property and liability. Client agrees that such insurance shall be primary to and non- contributory with any other insurance that may cover claims, loss, or damages arising out of this Agreement or relating to the services provided hereunder. Client expressly releases and waives any and all rights of subrogation, contribution or indemnity the insurer may have against FirstLight Home Care of Rancho Cucamonga or its employees, agents, representatives, and affiliates. Client represents and certifies that the following insurance is in effect as of the date of this Agreement: Homeowners'/Renters' Insurance Company" },
    { title: "12. USE OF PREMISES:", text: "Client shall not do or suffer or permit anything to be done in or about the location where the Services are to be provided (the \"Premises\") which would in any way subject FirstLight Home Care of Rancho Cucamonga, its employees, agents, representatives, and affiliates to any liability or cause a cancellation of, or give rise to any defense by an insurer to any claim under, any policies for homeowners' or renters' insurance. Client shall not do or permit anything to be done in or about the Premises which will in any way conflict with any law, ordinance or governmental requirement now in force or which may hereafter be enacted. Client shall immediately furnish FirstLight Home Care of Rancho Cucamonga with any notices received from any insurance company or governmental agency or inspection bureau regarding any unsafe or unlawful conditions within the Premises. Client will indemnify, defend and hold harmless FirstLight Home Care of Rancho Cucamonga, any related entities, its affiliates, and each of their directors, officers, and employees (\"Indemnified Persons\") from and against any and all claims, actions, demands, liabilities, losses, damages, judgments, costs and expenses, including but not to, reasonable attorneys' fees, costs and interest, asserted against, imposed upon or incurred by Indemnified Persons that arise out of, or in connection with, the Client's failure to perform the obligations of this Section 12." },
    { title: "13. USE OF VEHICLE:", text: "FirstLight Home Care of Rancho Cucamonga will not operate a vehicle on the Client's behalf unless the Client executes the Transportation Waiver substantially in the form provided by FirstLight Home Care of Rancho Cucamonga as part of this Agreement." },
    { title: "14. HIRING:", text: `The investment FirstLight Home Care of Rancho Cucamonga makes in maintaining our quality caregivers and employees is substantial; therefore, it is agreed for a period of one year from the last day worked or for a period of one year after the Client stops utilizing FirstLight Home Care of Rancho Cucamonga Services, the Client agrees not to hire directly, or hire through any other company or agency, FirstLight Home Care of Rancho Cucamonga employees directly or indirectly who have personally provided care for the Client. If the Client wishes to hire a FirstLight Home Care of Rancho Cucamonga employee directly, the Client will notify FirstLight Home Care of Rancho Cucamonga of this intent in writing and a flat fee of $15,000.00 will be required to hire that employee directly. A written request by said employee will be required and must be approved by FirstLight Home Care of Rancho Cucamonga` },
    { title: "15. OTHER CONSIDERATIONS:", text: "The Client agrees that any claims made under the FirstLight Home Care of Rancho Cucamonga fidelity bond must be made in writing by the Client with ten (10) days of the occurrence. In addition, as a licensed California Home Care Organization FirstLight Home Care of Rancho Cucamonga maintains proof of general and professional liability insurance in the amount of $1 million per occurrence and $3 million in the aggregate and has an employee dishonesty bond with a minimum limit of $10,000, as required under Cal. Health & Safety Code § 1796.37; 1796.42." },
    { title: "16. TERM; TERMINATION:", text: "The term of this Agreement will be from the Contract Start Date until this Agreement is terminated under this section. Either party may terminate this Agreement at any time by providing seven (7) days' prior written notice to the other party stating the reason for termination. In instances of safety risk/hazard to a Client or a FirstLight Home Care of Rancho Cucamonga In-Home Worker or provision of the Services is otherwise prohibited by law, termination will be immediate with a stated reason for termination provided to the other party at the time of notification." },
    { title: "17. AMENDMENT; ENTIRE AGREEMENT:", text: "The Client agrees to notify FirstLight Home Care of Rancho Cucamonga of any requested changes in the duties of a FirstLight Home Care of Rancho Cucamonga employee from those agreed to on the Service Plan. This Agreement may be amended only upon the mutual written consent of the parties. This Agreement represents the entire agreement of the parties with respect to the subject matter hereof, and this Agreement supersedes all prior agreements and understandings with respect to such subject matter." },
    { title: "18. SEVERABILITY:", text: "The invalidity or partial invalidity of any portion of this Agreement will not invalidate the remainder thereof, and said remainder will remain in full force and effect. Moreover, if one or more of the provisions contained in this Agreement will, for any reason, be held to be excessively broad as to scope, activity, subject or otherwise, so as to be unenforceable at law, such provision or provisions will be construed by the appropriate judicial body by limiting or reducing it or them, so as to be enforceable to the maximum extent compatible with then applicable law." },
    { title: "19. INFORMATION AND DOCUMENTS RECEIVED:", text: "The Client acknowledges receipt of a copy of this Agreement, these Terms and Conditions and the following documents provided by FirstLight Home Care of Rancho Cucamonga and agrees to be bound by and comply with all of the same:" },
];

const companionCareCheckboxes = [
    { id: 'companionCare_mealPreparation', label: 'Meal preparation and clean up' },
    { id: 'companionCare_cleanKitchen', label: 'Clean kitchen - appliances, sinks, mop floors' },
    { id: 'companionCare_assistWithLaundry', label: 'Assist with laundry and ironing' },
    { id: 'companionCare_dustFurniture', label: 'Dust furniture - living room, bedrooms, dining room' },
    { id: 'companionCare_assistWithEating', label: 'Assist with eating and proper nutrition' },
    { id: 'companionCare_provideAlzheimersRedirection', label: "Provide Alzheimer's redirection - for safety" },
    { id: 'companionCare_assistWithHomeManagement', label: 'Assist with home management - mail, plants, calendar' },
    { id: 'companionCare_preparationForBathing', label: 'Preparation for bathing and hair care' },
    { id: 'companionCare_groceryShopping', label: 'Grocery shopping' },
    { id: 'companionCare_cleanBathrooms', label: 'Clean bathrooms - sink, tub, toilet' },
    { id: 'companionCare_changeBedLinens', label: 'Change bed linens and make bed' },
    { id: 'companionCare_runErrands', label: 'Run errands - pick up prescription' },
    { id: 'companionCare_escortAndTransportation', label: 'Escort and transportation' },
    { id: 'companionCare_provideRemindersAndAssistWithToileting', label: 'Provide reminders and assist with toileting' },
    { id: 'companionCare_provideRespiteCare', label: 'Provide respite care' },
    { id: 'companionCare_stimulateMentalAwareness', label: 'Stimulate mental awareness - read' },
    { id: 'companionCare_assistWithDressingAndGrooming', label: 'Assist with dressing and grooming' },
    { id: 'companionCare_assistWithShavingAndOralCare', label: 'Assist with shaving and oral care' },
] as const;

const personalCareCheckboxes = [
    { id: 'personalCare_provideAlzheimersCare', label: "Provide Alzheimer's care, cognitive impairment" },
    { id: 'personalCare_provideMedicationReminders', label: 'Provide medication reminders' },
    { id: 'personalCare_assistWithDressingGrooming', label: 'Assist with dressing, grooming' },
    { id: 'personalCare_assistWithBathingHairCare', label: 'Assist with bathing, hair care' },
    { id: 'personalCare_assistWithFeedingSpecialDiets', label: 'Assist with feeding, special diets' },
    { id: 'personalCare_assistWithMobilityAmbulationTransfer', label: 'Assist with mobility, ambulation and transfer' },
    { id: 'personalCare_assistWithIncontinenceCare', label: 'Assist with incontinence care' },
] as const;


async function drawServicePlanPageContent(page: PDFPage, formData: ClientSignupFormData, font: PDFFont, boldFont: PDFFont) {
    const { width, height } = page.getSize();
    let y = height - 80;
    const leftMargin = 60;
    const contentWidth = width - leftMargin * 2;
    const mainFontSize = 8;
    const checkboxFontSize = 7;
    const lineHeight = 10;
    const checkboxLineHeight = 12;

    y = drawCenteredText(page, "HOME CARE SERVICE PLAN AGREEMENT", boldFont, 11, y);
    y -= 15;

    drawText(page, `Client Name: ${formData.clientName || ''}`, { x: leftMargin, y, font, size: mainFontSize });
    y -= 15;
    y = drawWrappedText(page, "Frequency and duration of Services to be identified on individualized Client Service Plan", font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
    y -= 20;

    drawText(page, "Companion Care Services", { x: leftMargin, y, font: boldFont, size: mainFontSize });
    y -= 15;

    let checkboxX = leftMargin;
    let checkboxY = y;
    const colWidth = (contentWidth / 2) - 10;

    for (let i = 0; i < companionCareCheckboxes.length; i++) {
        const item = companionCareCheckboxes[i];
        drawCheckbox(page, !!formData[item.id as keyof ClientSignupFormData], checkboxX, checkboxY);
        drawText(page, item.label, { x: checkboxX + 15, y: checkboxY + 1, font, size: checkboxFontSize });

        if ((i + 1) % 2 === 0) {
            checkboxX = leftMargin;
            checkboxY -= checkboxLineHeight;
        } else {
            checkboxX += colWidth;
        }
    }
    y = checkboxY - (companionCareCheckboxes.length % 2 === 1 ? checkboxLineHeight : 0) - 5;
    drawText(page, `Other: ${formData.companionCare_other || ''}`, { x: leftMargin, y, font, size: mainFontSize });
    y -= 20;

    drawText(page, "Personal Care Services", { x: leftMargin, y, font: boldFont, size: mainFontSize });
    y -= 15;

    checkboxX = leftMargin;
    checkboxY = y;
    for (let i = 0; i < personalCareCheckboxes.length; i++) {
        const item = personalCareCheckboxes[i];
        drawCheckbox(page, !!formData[item.id as keyof ClientSignupFormData], checkboxX, checkboxY);
        drawText(page, item.label, { x: checkboxX + 15, y: checkboxY + 1, font, size: checkboxFontSize });
        
        if ((i + 1) % 2 === 0) {
            checkboxX = leftMargin;
            checkboxY -= checkboxLineHeight;
        } else {
            checkboxX += colWidth;
        }
    }
    y = checkboxY - (personalCareCheckboxes.length % 2 === 1 ? checkboxLineHeight : 0) - 5;
    drawText(page, `Assist with other: ${formData.personalCare_assistWithOther || ''}`, { x: leftMargin, y, font, size: mainFontSize });
    y -= 20;

    const disclaimer = `Firstlight Home Care of Rancho Cucamonga provides Personal Care Services as defined under Cal. Health & Safety Code § 1796.12 and does not provide medical services or function as a home health agency.`;
    y = await drawFormattedWrappedText(page, disclaimer, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
    y -= 20;

    drawText(page, `Client Initials: ${formData.servicePlanClientInitials || '_____'}`, { x: leftMargin, y, font, size: mainFontSize });
    
    // Position this box higher, relative to the bottom of the content.
    const boxHeight = 60;
    const boxY = y - 90;
    page.drawRectangle({ x: leftMargin, y: boxY - 55, width: 250, height: boxHeight, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
    let textY = boxY - 5;
    drawText(page, "For Office Use Only", {x: leftMargin + 5, y: textY, font: boldFont, size: mainFontSize});
    textY -= 15;
    const officeDate1 = formData.officeTodaysDate ? format(new Date(formData.officeTodaysDate), "MM/dd/yyyy") : '';
    drawText(page, `TODAY'S DATE: ${officeDate1}`, {x: leftMargin + 5, y: textY, font, size: mainFontSize});
    textY -= 15;
    const officeDate2 = formData.officeReferralDate ? format(new Date(formData.officeReferralDate), "MM/dd/yyyy") : '';
    drawText(page, `REFERRAL DATE: ${officeDate2}`, {x: leftMargin + 5, y: textY, font, size: mainFontSize});
    textY -= 15;
    const officeDate3 = formData.officeInitialContactDate ? format(new Date(formData.officeInitialContactDate), "MM/dd/yyyy") : '';
    drawText(page, `DATE OF INITIAL CLIENT CONTACT: ${officeDate3}`, {x: leftMargin + 5, y: textY, font, size: mainFontSize});
}


export async function generateClientIntakePdf(formData: ClientSignupFormData): Promise<Buffer> {
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

        // --- Page 1: Client Info & Signatures ---
        let page = addNewPage();
        let { width, height } = page.getSize();
        let y = height - 80;
        const leftMargin = 60;
        const contentWidth = width - leftMargin * 2;
        const mainFontSize = 8;
        const lineHeight = 10;
        const titleFontSize = 10;
        const signatureLabelFontSize = 6;
        
        y = drawCenteredText(page, "CLIENT SERVICE AGREEMENT", boldFont, 14, y);
        y -= 15;
        const introText = `Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (the "Agreement") is entered into between the client, or his or her authorized representative, (the "Client") and FirstLight Home Care of Rancho Cucamonga, address 9650 Business Center drive, Suite 132, Rancho Cucamonga CA 91730 phone number 9093214466 ("FirstLight Home Care")`;
        y = await drawFormattedWrappedText(page, introText, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        
        y = drawCenteredText(page, "I. CLIENT INFORMATION", boldFont, titleFontSize, y);
        y -= 20;

        const col1X = leftMargin;
        const col2X = leftMargin + 270;
        
        drawField(page, y, "Client Name", formData.clientName, font, boldFont, mainFontSize, col1X, col1X + 50);
        const fullAddress = [formData.clientAddress, formData.clientCity, formData.clientState, formData.clientPostalCode].filter(Boolean).join(', ');
        drawField(page, y, "Address", fullAddress, font, boldFont, mainFontSize, col2X, col2X + 40);
        y -= 20;

        drawField(page, y, "Phone", formData.clientPhone, font, boldFont, mainFontSize, col1X, col1X + 30);
        drawField(page, y, "Email", formData.clientEmail, font, boldFont, mainFontSize, col2X, col2X + 40);
        y -= 20;

        const dobFormatted = formData.clientDOB ? (typeof formData.clientDOB === 'string' ? formData.clientDOB : format(new Date(formData.clientDOB), "MM/dd/yyyy")) : '';
        drawField(page, y, "SSN", formData.clientSSN, font, boldFont, mainFontSize, col1X, col1X + 25);
        drawField(page, y, "DOB", dobFormatted, font, boldFont, mainFontSize, col2X, col2X + 25);
        y -= 20;

        drawField(page, y, "Emergency Contact Name", formData.emergencyContactName, font, boldFont, mainFontSize, col1X, col1X + 110);
        drawField(page, y, "Relationship", formData.emergencyContactRelationship, font, boldFont, mainFontSize, col2X, col2X + 60);
        y -= 20;

        drawField(page, y, "Contact Home Phone", formData.emergencyContactHomePhone, font, boldFont, mainFontSize, col1X, col1X + 90);
        drawField(page, y, "Contact Work Phone", formData.emergencyContactWorkPhone, font, boldFont, mainFontSize, col2X, col2X + 90);
        y -= 15;
        
        const secondContactY = y;
        drawText(page, "2nd Emergency Contact:", { x: col1X, y: secondContactY + 5, font: boldFont, size: mainFontSize });
        
        drawText(page, `Name: ${formData.secondEmergencyContactName || ''}`, {x: leftMargin, y: secondContactY - 10, font, size: mainFontSize});
        drawText(page, `Relationship: ${formData.secondEmergencyContactRelationship || ''}`, {x: leftMargin + 200, y: secondContactY - 10, font, size: mainFontSize});
        drawText(page, `Phone: ${formData.secondEmergencyContactPhone || ''}`, {x: leftMargin + 380, y: secondContactY - 10, font, size: mainFontSize});
        y -= 30;

        drawCheckbox(page, formData.homemakerCompanion, leftMargin, y);
        drawText(page, "Homemaker/Companion", { x: leftMargin + 15, y: y+1, font, size: mainFontSize });
        drawCheckbox(page, formData.personalCare, col2X, y);
        drawText(page, "Personal Care", { x: col2X + 15, y: y+1, font, size: mainFontSize });
        y -= 20;
        
        y = await drawFormattedWrappedText(page, `FirstLight Home Care of Rancho Cucamonga will provide non-medical in-home services (the "Services") specified in the attached Service Plan Agreement (the "Service Plan")`, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        
        y = drawCenteredText(page, "II. PAYMENTS FOR THE SERVICES", boldFont, titleFontSize, y);
        y-=10;
        const rateCardDateFormatted = formData.rateCardDate ? (typeof formData.rateCardDate === 'string' ? formData.rateCardDate : format(new Date(formData.rateCardDate), 'MM/dd/yyyy')) : '____________';
        const rateText1 = `The hourly rate for providing the Services is $${formData.hourlyRate || '___'} per hour. The rate is based on the Client utilizing the services of FirstLight Home Care of Rancho Cucamonga for a minimum of ${formData.minimumHoursPerShift || '___'} hours per shift. The rates are provided on a current rate card dated ${rateCardDateFormatted}. Rates are subject to change with two (2) weeks' written notice.`;
        y = await drawFormattedWrappedText(page, rateText1, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 10;
        const paymentText = "Invoices are to be presented on a regular scheduled basis. Payment is due upon receipt or not more than seven days after an invoice has been received by the Client. The Client should submit payment to the address listed above. Full refunds of any advance deposit fees collected for unused services will occur within ten (10) business days of last date of service. FirstLight Home Care of Rancho Cucamonga does not participate in and is not credentialed with any government or commercial health insurance plans and therefore does not submit bills or claims for Services as in-network, out-of-network or any other status to any government or commercial health plans. Client acknowledges and agrees that Client does not have insurance through any government health insurance plan; that Client requests to pay for Services out-of-pocket; and that because FirstLight Home Care of Rancho Cucamonga does not participate in or accept any form of government or commercial health insurance, FirstLight Home Care of Rancho Cucamonga will bill Client directly for the Services and Client is responsible for paying such charges.";
        y = await drawFormattedWrappedText(page, paymentText, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 10;
        const cancellationText = "If there is same day cancellation, client will be charged for full scheduled hours, except if there is a medical emergency.";
        const cancellationTextWidth = font.widthOfTextAtSize(cancellationText, mainFontSize);
        page.drawRectangle({ x: (width / 2) - (cancellationTextWidth / 2) - 4 , y: y - lineHeight + 2, width: cancellationTextWidth + 8, height: lineHeight, color: rgb(1, 1, 0.6) });
        y = drawWrappedText(page, cancellationText, font, mainFontSize, (width / 2) - (cancellationTextWidth / 2), y, contentWidth, lineHeight);
        
        y = drawCenteredText(page, "III. ACKNOWLEDGEMENT & AGREEMENT", boldFont, titleFontSize, y);
        y-=10;
        const ackText = `The Client, or his or her authorized representative, consents to receive the Services and acknowledges he or she or they have read, accept, and consent to this Agreement, including the "Terms and Conditions" and all other attached documents, all of which are incorporated into this Agreement.`;
        y = drawWrappedText(page, ackText, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 30;
        
        const drawSignatureBlock = async (yPos: number) => {
            await drawSignature(page, formData.clientSignature, leftMargin + 5, yPos, 180, 25, pdfDoc);
            page.drawLine({ start: { x: leftMargin, y: yPos-5 }, end: { x: leftMargin + 250, y: yPos-5 }, thickness: 0.5 });
            drawText(page, `Signed (Client)`, { x: leftMargin, y: yPos-15, font: font, size: signatureLabelFontSize });
            
            drawText(page, formData.clientPrintedName, { x: leftMargin + 270, y: yPos, font, size: mainFontSize });
            page.drawLine({ start: { x: leftMargin + 270, y: yPos - 5 }, end: { x: leftMargin + 420, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, `Printed Name (Client)`, { x: leftMargin + 270, y: yPos - 15, font, size: signatureLabelFontSize });
        
            const clientSigDate = formData.clientSignatureDate ? format(new Date(formData.clientSignatureDate), "MM/dd/yyyy") : '';
            drawText(page, clientSigDate, { x: leftMargin + 440, y: yPos, font, size: mainFontSize });
            page.drawLine({ start: { x: leftMargin + 440, y: yPos - 5 }, end: { x: width - leftMargin, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, "Date", { x: leftMargin + 440, y: yPos-15, font, size: signatureLabelFontSize});
            yPos -= 40;
            
            await drawSignature(page, formData.clientRepresentativeSignature, leftMargin + 5, yPos, 180, 25, pdfDoc);
            page.drawLine({ start: { x: leftMargin, y: yPos-5 }, end: { x: leftMargin + 250, y: yPos-5 }, thickness: 0.5 });
            drawText(page, `Signed (Responsible Party)`, { x: leftMargin, y: yPos-15, font: font, size: signatureLabelFontSize });

            drawText(page, formData.clientRepresentativePrintedName, { x: leftMargin + 270, y: yPos, font, size: mainFontSize });
            page.drawLine({ start: { x: leftMargin + 270, y: yPos - 5 }, end: { x: leftMargin + 420, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, `Printed Name (Client Representative)`, { x: leftMargin + 270, y: yPos - 15, font, size: signatureLabelFontSize });
            
            const repSigDate = formData.clientRepresentativeSignatureDate ? format(new Date(formData.clientRepresentativeSignatureDate), "MM/dd/yyyy") : '';
            drawText(page, repSigDate, { x: leftMargin + 440, y: yPos, font, size: mainFontSize });
            page.drawLine({ start: { x: leftMargin + 440, y: yPos - 5 }, end: { x: width - leftMargin, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, "Date", { x: leftMargin + 440, y: yPos-15, font, size: signatureLabelFontSize});
            yPos -= 40;

            await drawSignature(page, formData.firstLightRepresentativeSignature, leftMargin + 5, yPos, 180, 25, pdfDoc);
            page.drawLine({ start: { x: leftMargin, y: yPos-5 }, end: { x: leftMargin + 250, y: yPos-5 }, thickness: 0.5 });
            drawText(page, `(FirstLight Home Care of Representative Signature)`, { x: leftMargin, y: yPos-15, font: font, size: signatureLabelFontSize });

            drawText(page, formData.firstLightRepresentativeTitle, { x: leftMargin + 270, y: yPos, font, size: mainFontSize });
            page.drawLine({ start: { x: leftMargin + 270, y: yPos - 5 }, end: { x: leftMargin + 420, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, `(FirstLight Home Care of Rancho Cucamonga Representative Title)`, { x: leftMargin + 270, y: yPos - 15, font, size: signatureLabelFontSize });
            
            const firstlightSigDate = formData.firstLightRepresentativeSignatureDate ? format(new Date(formData.firstLightRepresentativeSignatureDate), "MM/dd/yyyy") : '';
            drawText(page, firstlightSigDate, { x: leftMargin + 440, y: yPos, font, size: mainFontSize });
            page.drawLine({ start: { x: leftMargin + 440, y: yPos - 5 }, end: { x: width - leftMargin, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, "Date", { x: leftMargin + 440, y: yPos-15, font, size: signatureLabelFontSize});
            return yPos;
        };
        y = await drawSignatureBlock(y);

        // --- Terms and Conditions ---
        page = addNewPage();
        y = page.getHeight() - 80;
        y = drawCenteredText(page, "TERMS AND CONDITIONS", boldFont, 11, y);
        y -= 20;

        for (const term of privatePayTerms) {
            const titleHeight = boldFont.heightAtSize(mainFontSize);
            const textHeight = (font.heightAtSize(mainFontSize) * Math.ceil(font.widthOfTextAtSize(sanitizeText(term.text), mainFontSize) / contentWidth)) + 15;
            let estimatedHeight = titleHeight + textHeight + 20;
            if(term.title === "11. INSURANCE:" || term.title === "14. HIRING:") estimatedHeight += 40;
            if (term.title === "19. INFORMATION AND DOCUMENTS RECEIVED:") estimatedHeight += 60;

            if (y < estimatedHeight + 60) {
                page = addNewPage();
                y = page.getHeight() - 80;
            }

            y = await drawFormattedWrappedText(page, term.title, boldFont, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight + 2);
            y = await drawFormattedWrappedText(page, sanitizeText(term.text), font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
            y -= 15;

            if (term.title === "11. INSURANCE:") {
                 y -= 5;
                 drawField(page, y, "Policy Number", formData.policyNumber, font, boldFont, mainFontSize, leftMargin, leftMargin + 70);
                 drawField(page, y, "Policy Period", formData.policyPeriod, font, boldFont, mainFontSize, leftMargin + 250, leftMargin + 320);
                 y -= 20;
            } else if (term.title === "14. HIRING:") {
                 y -= 5;
                 drawText(page, `Client Initials: ${formData.clientInitials || '_____'}`, {x: leftMargin + 10, y, font, size: mainFontSize});
                 y -= 20;
            } else if (term.title === "19. INFORMATION AND DOCUMENTS RECEIVED:") {
                let checkboxY = y - 5;
                drawCheckbox(page, formData.receivedPrivacyPractices, leftMargin + 10, checkboxY);
                drawText(page, "Notice of Privacy Practices", {x: leftMargin + 25, y: checkboxY + 1, font, size: mainFontSize});
                drawCheckbox(page, formData.receivedClientRights, leftMargin + 250, checkboxY);
                drawText(page, "Client Rights and Responsibilities", {x: leftMargin + 265, y: checkboxY + 1, font, size: mainFontSize});
                checkboxY -= 20;

                drawCheckbox(page, formData.receivedTransportationWaiver, leftMargin + 10, checkboxY);
                drawText(page, "Transportation Waiver", {x: leftMargin + 25, y: checkboxY + 1, font, size: mainFontSize});
                checkboxY -= 20;
                
                drawCheckbox(page, formData.receivedPaymentAgreement, leftMargin + 10, checkboxY + 5);
                drawWrappedText(page, "Agreement to Accept Payment Responsibility and Consent for Personal Information-Private Pay", font, mainFontSize, leftMargin + 25, checkboxY + 5, contentWidth - 40, lineHeight);
                y = checkboxY - 20;
            }
        }
        
        // --- Transportation Waiver ---
        if (formData.receivedTransportationWaiver) {
            page = addNewPage();
            y = page.getHeight() - 80;
            y = drawCenteredText(page, "Transportation Waiver", boldFont, 13, y);
            y -= 30;

            const waiverText = [
                "FirstLight HomeCare offers transportation as a convenience to our clients, not as a standalone service.",
                "Upon signing of this waiver, I understand I am authorizing an employee of FirstLight HomeCare to furnish transportation for me as a passenger in either their automobile or my own.",
                "I will follow all applicable laws, including, but not limited to, the wearing of my seatbelt.",
                "When the FirstLight HomeCare employee drives my vehicle, I certify current insurance for both liability and physical damage.",
                "Further, I accept responsibility for any deductibles on my personal automobile insurance coverage incurred as a result of this service.",
                "I specifically accept these risks and waive any claim that I might otherwise have against FirstLight HomeCare with respect to bodily injury or property damage sustained by me in connection with said transportation, and hereby expressly release FirstLight HomeCare and their employees from any and all liability therewith."
            ];

            for(const p of waiverText) {
                y = await drawFormattedWrappedText(page, p, font, boldFont, mainFontSize + 1, leftMargin, y, contentWidth, lineHeight + 4);
                y -= 25;
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
        
        // --- Service Plan ---
        page = addNewPage();
        await drawServicePlanPageContent(page, formData, font, boldFont);
        
        // --- Final Agreement ---
        page = addNewPage();
        y = page.getHeight() - 80;
        y = drawCenteredText(page, "AGREEMENT TO ACCEPT PAYMENT RESPONSIBILITY AND CONSENT FOR USE AND DISCLOSURE OF\nPERSONAL INFORMATION-PRIVATE PAY", boldFont, 8, y, 10);
        y -= 10;
        drawText(page, `Client Name: ${formData.agreementClientName || ''}`, {x: leftMargin, y, font, size: mainFontSize});
        y -= 20;
        const agreementText = [
            "I understand that Firstlight Home Care of Rancho Cucamonga may need to use or disclose my personal information to provide services to me, to obtain payment for its services and for all of the other reasons more fully described in Firstlight Home Care of Rancho Cucamonga Notice of Privacy Practices.",
            "I acknowledge that I have received the Notice of Privacy Practices, and I consent to all of the uses and disclosures of my personal information as described in that document including, if applicable and as is necessary, for Firstlight Home Care of Rancho Cucamonga provide services to me; to coordinate with my other providers; to determine eligibility for payment, bill, and receive payment for services; and to make all other uses and disclosures described in the Notice of Privacy Practices.",
            "My consent will be valid for two (2) years from the date below. I may revoke my consent to share information, in writing, at any time. Revoking my consent does not apply to information that has already been shared or affect my financial responsibility for Services. I understand that some uses and sharing of my information are authorized by law and do not require my consent."
        ];
        for(const p of agreementText) {
            y = await drawFormattedWrappedText(page, p, font, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
            y -= 10;
        }
        y -= 20;
        
        await drawSignature(page, formData.agreementClientSignature, leftMargin, y, 250, 40, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 250, y: y - 5 }, thickness: 0.5 });
        drawText(page, "Client Signature/Responsible Party", { x: leftMargin, y: y - 15, font, size: 8 });

        const agreementDate = (formData.agreementSignatureDate && (formData.agreementSignatureDate.toDate || isDate(formData.agreementSignatureDate))) ? format(formData.agreementSignatureDate.toDate ? formData.agreementSignatureDate.toDate() : formData.agreementSignatureDate, "MM/dd/yyyy") : '';
        drawField(page, y, "Date", agreementDate, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        page.drawLine({ start: { x: leftMargin + 350, y: y - 5}, end: {x: leftMargin + 500, y: y - 5}, thickness: 0.5 });
        y -= 40;
        
        drawField(page, y, "Relationship if not Client", formData.agreementRelationship, font, boldFont, mainFontSize, leftMargin, leftMargin + 120);
        page.drawLine({ start: { x: leftMargin + 120, y: y - 5 }, end: { x: leftMargin + 300, y: y - 5 }, thickness: 0.5 });
        y -= 40;
        
        await drawSignature(page, formData.agreementRepSignature, leftMargin, y, 250, 40, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 250, y: y - 5 }, thickness: 0.5 });
        drawText(page, "FirstLight Home Care of Rancho Cucamonga Representative", { x: leftMargin, y: y - 15, font, size: 8 });

        const agreementRepDate = (formData.agreementRepDate && (formData.agreementRepDate.toDate || isDate(formData.agreementRepDate))) ? format(formData.agreementRepDate.toDate ? formData.agreementRepDate.toDate() : formData.agreementRepDate, "MM/dd/yyyy") : '';
        drawField(page, y, "Date", agreementRepDate, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        page.drawLine({ start: { x: leftMargin + 350, y: y - 5}, end: {x: leftMargin + 500, y: y - 5}, thickness: 0.5 });

        // Add headers and footers to all pages
        allPages.forEach((p, i) => addHeaderAndFooter(p, logoImage, logoDims, i + 1, allPages.length, font));
        
        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    } catch (error: any) {
        console.error("Error generating PDF:", error);
        throw new Error(`Failed to generate PDF: ${error.message}`);
    }
}
