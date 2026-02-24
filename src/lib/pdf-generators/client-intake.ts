
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { sanitizeText, drawText, drawCheckbox, drawSignature, drawWrappedText } from './utils';
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
    
    drawText(page, `Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated.`, { x: 50, y: 30, font, size: 7 });
    const footerRightText = `FIRST-0084-A (10/2018)          Page ${pageNum} of ${totalPages}`;
    drawText(page, footerRightText, { x: width - 50 - font.widthOfTextAtSize(footerRightText, 7), y: 30, font, size: 7 });
};

const drawField = (page: PDFPage, y: number, label: string, value: string | undefined | null, font: PDFFont, boldFont: PDFFont, size: number, x: number, valueX: number) => {
    drawText(page, `${label}:`, { x: x, y, font: boldFont, size });
    if(value) {
        drawText(page, value, { x: valueX, y, font, size });
    }
};

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
];

const personalCareCheckboxes = [
    { id: 'personalCare_provideAlzheimersCare', label: "Provide Alzheimer's care, cognitive impairment" },
    { id: 'personalCare_provideMedicationReminders', label: 'Provide medication reminders' },
    { id: 'personalCare_assistWithDressingGrooming', label: 'Assist with dressing, grooming' },
    { id: 'personalCare_assistWithBathingHairCare', label: 'Assist with bathing, hair care' },
    { id: 'personalCare_assistWithFeedingSpecialDiets', label: 'Assist with feeding, special diets' },
    { id: 'personalCare_assistWithMobilityAmbulationTransfer', label: 'Assist with mobility, ambulation and transfer' },
    { id: 'personalCare_assistWithIncontinenceCare', label: 'Assist with incontinence care' },
];

export async function generateClientIntakePdf(formData: ClientSignupFormData, formType: 'private' | 'tpp' = 'private'): Promise<Buffer> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.2);

        const totalPages = formType === 'private' ? 5 : 4;
        const pages = Array.from({ length: totalPages }, () => pdfDoc.addPage());

        pages.forEach((p, i) => addHeaderAndFooter(p, logoImage, logoDims, i + 1, totalPages, font));

        let page = pages[0];
        const { width, height } = page.getSize();
        let y = height - 100;
        const leftMargin = 60;
        const contentWidth = width - leftMargin * 2;
        const lineHeight = 11;
        const mainFontSize = 9;

        // Title
        const title = formType === 'tpp' ? "THIRD PARTY PAYOR CLIENT SERVICE AGREEMENT" : "CLIENT SERVICE AGREEMENT";
        drawText(page, title, { x: width / 2, y, font: boldFont, size: 14, align: 'center' });
        y -= 25;

        // Intro
        const introText = formType === 'private'
            ? `Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (the "Agreement") is entered into between the client, or his or her authorized representative, (the "Client") and FirstLight Home Care of Rancho Cucamonga CA, address 9650 Business Center drive, Suite 132, Rancho Cucamonga CA 91730 phone number 9093214466 ("FirstLight Home Care")`
            : `Each franchise of FirstLight Home Care Franchising, LLC is independently owned and operated. This Client Service Agreement (this "Agreement") is entered into between the client, or his or her authorized representative, (the “Client”) and FirstLight Home Care of Rancho Cucamonga (“FirstLight Home Care”).`;
        y = drawWrappedText(page, introText, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 25;
        
        if (formType === 'tpp') {
            const tppIntro = `FirstLight Home Care will provide non-medical in-hime services (the “services”) specified in the Payor’s authorization and/or Client plan of care as made available by Payor to FirstLight Home Care pursuant to the “Payor Agreement” (as defined below). It is anticipated that Payor will provide Client-specific information to FirstLight Home Care as part of the Payor’s authorization and/or Client plan of care as FirstLight Home Care needs to render the Services and be reimbursed for such Services by the Payor. However Client will cooperate with FirstLight Home Care to the extent FirstLight Home Care requires additional information from Client related to Client in order to provide the Services.`;
            y = drawWrappedText(page, tppIntro, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
            y -= 25;
        }

        // I. CLIENT INFORMATION
        drawText(page, "I. CLIENT INFORMATION", { x: width / 2, y, font: boldFont, size: 11, align: 'center' });
        y -= 20;

        // Draw Client Info Fields
        drawField(page, y, "Client Name", formData.clientName, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        const dobFormatted = formData.clientDOB ? (typeof formData.clientDOB === 'string' ? formData.clientDOB : format(formData.clientDOB, "MM/dd/yyyy")) : '';
        drawField(page, y, "DOB", dobFormatted, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        y -= 20;
        const fullAddress = [formData.clientAddress, formData.clientCity, formData.clientState, formData.clientPostalCode].filter(Boolean).join(', ');
        drawField(page, y, "Address", fullAddress, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        y -= 20;
        drawField(page, y, "Phone", formData.clientPhone, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        drawField(page, y, "Email", formData.clientEmail, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 350);
        y -= 20;
        drawField(page, y, "Social Security #", formData.clientSSN, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        y -= 30;

        drawText(page, "Emergency Contact:", { x: leftMargin, y, font: boldFont, size: 11 });
        y -= 15;
        drawField(page, y, "Name", formData.emergencyContactName, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        drawField(page, y, "Relationship", formData.emergencyContactRelationship, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 400);
        y -= 20;
        drawField(page, y, "Home Phone", formData.emergencyContactHomePhone, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        drawField(page, y, "Work Phone", formData.emergencyContactWorkPhone, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 400);
        y -= 20;
        
        drawText(page, "2nd Emergency Contact:", { x: leftMargin, y, font: boldFont, size: 11 });
        y -= 15;
        drawField(page, y, "Name", formData.secondEmergencyContactName, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        drawField(page, y, "Relationship", formData.secondEmergencyContactRelationship, font, boldFont, mainFontSize, leftMargin + 300, leftMargin + 400);
        y -= 20;
        drawField(page, y, "Phone", formData.secondEmergencyContactPhone, font, boldFont, mainFontSize, leftMargin, leftMargin + 150);
        y -= 30;

        // ... continue drawing the rest of the form fields similarly ...
        
        // This is a highly simplified version. A full version would need to handle page breaks for each section.
        // For example:
        // if (y < 100) { page = pages[1]; y = height - 100; }
        
        // Example of drawing signature
        let sigY = y - 50;
        if (formData.clientSignature) {
            await drawSignature(page, formData.clientSignature, leftMargin, sigY - 40, 150, 40, pdfDoc);
        }
        drawText(page, `Client: ${formData.clientPrintedName || ''}`, { x: leftMargin, y: sigY, font, size: mainFontSize });
        const sigDate = formData.clientSignatureDate ? (typeof formData.clientSignatureDate === 'string' ? formData.clientSignatureDate : format(formData.clientSignatureDate, 'MM/dd/yyyy')) : '';
        drawText(page, `Date: ${sigDate}`, { x: leftMargin + 300, y: sigY, font, size: mainFontSize });


        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    } catch (error: any) {
        console.error("Error generating PDF:", error);
        throw new Error(`Failed to generate PDF: ${error.message}`);
    }
}

    