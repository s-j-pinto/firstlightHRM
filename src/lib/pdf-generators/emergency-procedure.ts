
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
                title: "Priorities during an emergency:",
                points: [
                    "Remain calm",
                    "Call 911 if there is a true medical emergency",
                    "Call the FLHC office immediately: (909)-321-4466. If you call twice, we will know it’s an emergency.",
                    "Ensure client safety",
                    "Follow directions from 911 dispatch or FLHC office",
                    "Never move a client who has fallen unless you need to perform CPR.",
                    "Stay with the client until help arrives and you have been relieved by another caregiver or emergency personnel.",
                    "If the client is transported to the hospital, stay with the client if possible until family or FLHC arrives.",
                    "Document the incident thoroughly."
                ]
            },
            {
                title: "FIRE:",
                points: [
                    "Get the client out of the home immediately.",
                    "Call 911, then FLHC.",
                    "Do NOT try to put out the fire.",
                    "Do NOT go back into the house for any reason."
                ]
            },
            {
                title: "FALL:",
                points: [
                    "Do NOT try to lift the client.",
                    "Call 911 if the client has hit their head, is unconscious, is bleeding, or is complaining of pain.",
                    "Keep the client warm and comfortable.",
                    "Call FLHC."
                ]
            },
            {
                title: "STROKE:",
                points: [
                    "Call 911 immediately.",
                    "Sudden weakness or numbness of the face, arm, or leg, especially on one side of the body.",
                    "Sudden confusion, trouble speaking or understanding.",
                    "Sudden trouble seeing in one or both eyes.",
                    "Sudden trouble walking, dizziness, or loss of balance.",
                    "Sudden, severe headache with no known cause."
                ]
            },
            {
                title: "HEART ATTACK:",
                points: [
                    "Call 911 immediately.",
                    "Uncomfortable pressure, squeezing, fullness or pain in the center of the chest.",
                    "Pain that spreads to the shoulders, neck, or arms.",
                    "Lightheadedness, fainting, sweating, nausea, or shortness of breath."
                ]
            },
            {
                title: "CHOKING:",
                points: [
                    "If client can speak, cough or breathe, do NOT interfere.",
                    "If client cannot speak, cough, or breathe, call 911 and perform the Heimlich Maneuver if you are trained."
                ]
            },
            {
                title: "NATURAL DISASTER (Earthquake, Flood, etc.):",
                points: [
                    "Ensure your own safety and the client’s safety first.",
                    "If an earthquake, 'Drop, Cover, and Hold On.'",
                    "After the event, check the client for injuries.",
                    "Contact FLHC as soon as it is safe to do so."
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
