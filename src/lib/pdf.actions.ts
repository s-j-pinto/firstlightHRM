
"use server";

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { format } from 'date-fns';

// Helper function to draw text and handle undefined values
async function drawText(page: any, text: string | undefined, x: number, y: number, font: any, size: number) {    
    if (text) {
        page.drawText(text, { x, y, font, size });
    }
}

// Helper to draw a checkbox
async function drawCheckbox(page: any, checked: boolean | undefined, x: number, y: number) {
    const checkMark = '✔';
    if (checked) {
        page.drawText(checkMark, { x, y, size: 12 });
    } else {
        // Optional: draw an empty box
        page.drawRectangle({
            x: x - 1,
            y: y - 2,
            width: 10,
            height: 10,
            borderWidth: 0.5,
            borderColor: rgb(0, 0, 0),
        });
    }
}

async function drawSignature(page: any, dataUrl: string | undefined, x: number, y: number, width: number, height: number, pdfDoc: PDFDocument) {
    if (dataUrl) {
        const pngImage = await pdfDoc.embedPng(dataUrl);
        page.drawImage(pngImage, { x, y, width, height });
    }
}

export async function generateClientIntakePdf(formData: any) {
    if (!formData) {
        throw new Error("Form data is missing.");
    }

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();
    let y = height - 50;
    const leftMargin = 50;
    const rightMargin = width - 50;
    const lineSpacing = 18;
    const sectionSpacing = 30;

    // Helper to add a new page and reset y coordinate if needed
    const checkY = (requiredSpace: number) => {
        if (y < requiredSpace) {
            page = pdfDoc.addPage();
            y = height - 50;
        }
    };
    
    const drawHeader = (text: string) => {
        checkY(y - sectionSpacing);
        page.drawText(text, { x: leftMargin, y, font: boldFont, size: 14 });
        y -= lineSpacing * 1.5;
    };
    
    const drawField = (label: string, value: any, isCheckbox = false) => {
        if (!value && !isCheckbox) return;
        checkY(y-lineSpacing);
        page.drawText(`${label}:`, { x: leftMargin, y, font: boldFont, size: 10 });
        if (isCheckbox) {
            drawCheckbox(page, value, leftMargin + 150, y);
        } else {
            drawText(page, value, leftMargin + 150, y, font, 10);
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


    // --- PAGE 1 ---
    drawHeader("CLIENT SERVICE AGREEMENT");

    drawHeader("I. CLIENT INFORMATION");
    drawField("Client Name", formData.clientName);
    drawField("Address", `${formData.clientAddress || ''}, ${formData.clientCity || ''}, ${formData.clientState || ''} ${formData.clientPostalCode || ''}`);
    drawField("Phone", formData.clientPhone);
    drawField("Email", formData.clientEmail);
    drawField("SSN", formData.clientSSN);
    drawField("DOB", formData.clientDOB);
    y -= sectionSpacing;

    drawHeader("II. EMERGENCY CONTACT INFORMATION");
    drawField("Emergency Contact Name", formData.emergencyContactName);
    drawField("Relationship", formData.emergencyContactRelationship);
    drawField("Home Phone", formData.emergencyContactHomePhone);
    drawField("Work Phone", formData.emergencyContactWorkPhone);
    drawField("2nd Emergency Contact", formData.secondEmergencyContactName);
    drawField("2nd Relationship", formData.secondEmergencyContactRelationship);
    drawField("2nd Phone", formData.secondEmergencyContactPhone);
    y -= sectionSpacing;
    
    drawHeader("III. TYPE OF SERVICE");
    drawField("Homemaker/Companion", formData.homemakerCompanion, true);
    drawField("Personal Care", formData.personalCare, true);
    y -= sectionSpacing;
    
    drawHeader("IV. SCHEDULE");
    drawField("Frequency", formData.scheduledFrequency);
    drawField("Days/Week", formData.daysPerWeek);
    drawField("Hours/Day", formData.hoursPerDay);
    drawField("Contract Start Date", formatDate(formData.contractStartDate));
    y -= sectionSpacing;

    drawHeader("V. PAYMENTS FOR THE SERVICES");
    drawField("Hourly Rate", `$${formData.hourlyRate || 0}`);
    drawField("Minimum Hours/Shift", `${formData.minimumHoursPerShift || 0}`);
    drawField("Rate Card Date", formatDate(formData.rateCardDate));
    drawField("Insurance Policy Number", formData.policyNumber);
    drawField("Insurance Policy Period", formData.policyPeriod);
    y -= sectionSpacing;

    checkY(250);

    drawHeader("ACKNOWLEDGEMENT & AGREEMENT");
    if(formData.clientSignature) {
        await drawSignature(page, formData.clientSignature, leftMargin, y - 60, 150, 50, pdfDoc);
    }
    drawField("Client Printed Name", formData.clientPrintedName);
    drawField("Client Signature Date", formatDate(formData.clientSignatureDate));
    y -= 70;

    if(formData.clientRepresentativeSignature) {
        await drawSignature(page, formData.clientRepresentativeSignature, leftMargin, y - 60, 150, 50, pdfDoc);
    }
    drawField("Representative Name", formData.clientRepresentativePrintedName);
    drawField("Representative Signature Date", formatDate(formData.clientRepresentativeSignatureDate));
    y -= 70;
    
    if(formData.firstLightRepresentativeSignature) {
        await drawSignature(page, formData.firstLightRepresentativeSignature, leftMargin, y - 60, 150, 50, pdfDoc);
    }
    drawField("FirstLight Rep Title", formData.firstLightRepresentativeTitle);
    drawField("FirstLight Rep Signature Date", formatDate(formData.firstLightRepresentativeSignatureDate));
    y -= 70;

    // --- PAGE 2 ---
    page = pdfDoc.addPage();
    y = height - 50;
    drawHeader("TERMS AND CONDITIONS (Continued)");
    drawField("Hiring Clause Client Initials", formData.clientInitials);
    
    drawHeader("INFORMATION AND DOCUMENTS RECEIVED");
    drawField("Notice of Privacy Practices", formData.receivedPrivacyPractices, true);
    drawField("Client Rights and Responsibilities", formData.receivedClientRights, true);
    drawField("Advance Directives", formData.receivedAdvanceDirectives, true);
    drawField("Rate Sheet", formData.receivedRateSheet, true);
    drawField("Transportation Waiver", formData.receivedTransportationWaiver, true);
    drawField("Payment Agreement", formData.receivedPaymentAgreement, true);
    y-= sectionSpacing;


    // --- PAGE 3 ---
    page = pdfDoc.addPage();
    y = height - 50;
    drawHeader("HOME CARE SERVICE PLAN AGREEMENT");

    drawHeader("For Office Use Only");
    drawField("Today's Date", formatDate(formData.officeTodaysDate));
    drawField("Referral Date", formatDate(formData.officeReferralDate));
    drawField("Initial Contact Date", formatDate(formData.officeInitialContactDate));
    y -= sectionSpacing;

    drawField("Client Name", formData.clientName);
    y -= sectionSpacing;

    drawHeader("Companion Care Services");
    const companionCareFields = [
        { key: 'companionCare_mealPreparation', label: 'Meal preparation' },
        { key: 'companionCare_cleanKitchen', label: 'Clean kitchen' },
        { key: 'companionCare_assistWithLaundry', label: 'Assist with laundry' },
        { key: 'companionCare_dustFurniture', label: 'Dust furniture' },
    ];
    companionCareFields.forEach(field => drawField(field.label, (formData as any)[field.key], true));
    drawField("Other Companion Care", formData.companionCare_other);
    y -= sectionSpacing;

    drawHeader("Personal Care Services");
    const personalCareFields = [
        { key: 'personalCare_provideAlzheimersCare', label: "Alzheimer's care" },
        { key: 'personalCare_provideMedicationReminders', label: 'Medication reminders' },
        { key: 'personalCare_assistWithDressingGrooming', label: 'Assist with dressing' },
    ];
    personalCareFields.forEach(field => drawField(field.label, (formData as any)[field.key], true));
    drawField("Other Personal Care", formData.personalCare_assistWithOther);
    y -= sectionSpacing;

    drawField("Service Plan Client Initials", formData.servicePlanClientInitials);

    // --- PAGE 4 & 5 ---
    page = pdfDoc.addPage();
    y = height - 50;
    drawHeader("AGREEMENT TO ACCEPT PAYMENT RESPONSIBILITY");
    drawField("Client Name", formData.agreementClientName);
    y-= sectionSpacing;

    if(formData.agreementClientSignature) {
        await drawSignature(page, formData.agreementClientSignature, leftMargin, y - 60, 150, 50, pdfDoc);
    }
    drawField("Signature Date", formatDate(formData.agreementSignatureDate));
    y -= 70;

    drawField("Relationship if not Client", formData.agreementRelationship);
    if(formData.agreementRepSignature) {
        await drawSignature(page, formData.agreementRepSignature, leftMargin, y - 60, 150, 50, pdfDoc);
    }
    drawField("Rep. Signature Date", formatDate(formData.agreementRepDate));

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
}
