
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';
import { serverDb } from '@/firebase/server-init';

export async function generateEmergencyProcedurePdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const leftMargin = 50;
        const contentWidth = width - leftMargin * 2;
        let y = height - 50;

        // Title
        drawText(page, "Caregiver Emergency Procedures", { x: leftMargin, y, font: boldFont, size: 16 });
        y -= 30;

        const sections = [
            {
                title: "In the event of a non-medical emergency in the home of the client the caregiver will do the following:",
                points: [
                    "Call the FirstLight HomeCare office to speak with either the Care Coordinator or Administrator to notify them of the situation.",
                    "Will not attempt to move the client or attempt to administer aid without the direct input from the Care Coordinator or Administrator.",
                    "The Care Coordinator or Administrator will call designated contacts, if appropriate.",
                    "Once the situation has been resolved, document the incident and care provided."
                ]
            },
            {
                title: "In the event of any life-threatening emergency in the home of a client the caregiver will do the following:",
                points: [
                    "Call 911 and stay with the client. If client begins having new or worsened symptoms, Caregiver will relay this information to the 911 dispatcher who can update the emergency responders who are on their way to the scene.",
                    "Insist that the client waits for an ambulance. Arriving at a hospital in an ambulance ensures direct access to health care providers, while driving someone to the Emergency Room can lead to lines and paperwork before client receives help.",
                    "If the client suddenly collapses, stops breathing, or becomes unresponsive, begin giving CPR if CPR certified. Otherwise, the 911 dispatcher will be able to walk the caregiver through the basic steps needed to keep blood flowing until first responders arrive.",
                    "Once the emergency responders arrive, caregiver will call the FirstLight HomeCare office to notify the Care Coordinator and/or the Administrator of the situation.",
                    "The Care Coordinator or Administrator will call designated contacts.",
                    "Once the situation has been resolved, caregiver will document the incident and care provided."
                ]
            }
        ];
        
        for (const section of sections) {
             if (y < 150) { // Check for space before starting a new section
                const newPage = pdfDoc.addPage(PageSizes.Letter);
                page = newPage;
                y = height - 50;
            }
            drawText(page, section.title, { x: leftMargin, y, font: boldFont, size: 12 });
            y -= 20;

            for (const point of section.points) {
                 if (y < 60) {
                    const newPage = pdfDoc.addPage(PageSizes.Letter);
                    page = newPage;
                    y = height - 50;
                }
                y = drawWrappedText(page, `• ${point}`, font, 10, leftMargin + 10, y, contentWidth - 10, 14);
            }
            y -= 10;
        }

        if (y < 120) { // New page for signature if not enough space
            const newPage = pdfDoc.addPage(PageSizes.Letter);
            page = newPage;
            y = height - 70;
        }

        y -= 30;

        const acknowledgment = "I have read and understand the FirstLight Home Care Emergency Procedures and agree to follow them to the best of my ability.";
        y = drawWrappedText(page, acknowledgment, font, 11, leftMargin, y, contentWidth, 14);
        y -= 40;

        const signatureY = y;
        const dateValue = (formData.emergencyProcedureSignatureDate && (formData.emergencyProcedureSignatureDate.toDate || isDate(formData.emergencyProcedureSignatureDate)))
            ? format(formData.emergencyProcedureSignatureDate.toDate ? formData.emergencyProcedureSignatureDate.toDate() : formData.emergencyProcedureSignatureDate, "MM/dd/yyyy")
            : '';

        if (formData.emergencyProcedureSignature) {
            await drawSignature(page, formData.emergencyProcedureSignature, leftMargin, signatureY, 250, 40, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: signatureY - 5 }, end: { x: leftMargin + 250, y: signatureY - 5 }, thickness: 0.5 });
        drawText(page, "Employee Signature", { x: leftMargin, y: signatureY - 15, font, size: 8 });

        if (dateValue) {
            drawText(page, dateValue, { x: leftMargin + 300, y: signatureY + 15, font, size: 11 });
        }
        page.drawLine({ start: { x: leftMargin + 300, y: signatureY - 5 }, end: { x: leftMargin + 450, y: signatureY - 5 }, thickness: 0.5 });
        drawText(page, "Date", { x: leftMargin + 300, y: signatureY - 15, font, size: 8 });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Emergency Procedure PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
