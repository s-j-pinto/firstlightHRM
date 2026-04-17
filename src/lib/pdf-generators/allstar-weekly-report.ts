
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { format, parse, isValid } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateAllstarWeeklyReportPdf(data: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/AllstarLogo.png?alt=media&token=e1189849-56a5-4f35-9509-f538e12e1a39";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.35);

        const visits = data.visits || [];
        const visitsPerPage = 10;
        const totalPages = visits.length > 0 ? Math.ceil(visits.length / visitsPerPage) : 1;

        for (let i = 0; i < totalPages; i++) {
            const page = pdfDoc.addPage(PageSizes.Letter);
            const { width, height } = page.getSize();
            let y = height - 40;
            const leftMargin = 40;
            const contentWidth = width - (leftMargin * 2);

            // Header
            page.drawImage(logoImage, { x: leftMargin, y: y - logoDims.height + 10, width: logoDims.width, height: logoDims.height });
            drawText(page, "Allstar Health Providers, Inc.", { x: leftMargin + logoDims.width + 10, y: y, font: boldFont, size: 12 });
            drawText(page, "10722 Arrow Route Suite 218\nRancho Cucamonga CA 91730\nTel. No. (909)945-9899; Fax No. (909)945-9799", { x: leftMargin + logoDims.width + 10, y: y - 15, font, size: 9, lineHeight: 11 });
            
            const headerRightText = "ROUTE SHEET, PATIENT ACKNOWLEDGEMENT, AND\nSTAFF CERTIFICATION OF SERVICES RENDERED";
            drawText(page, headerRightText, { x: 380, y: y - 10, font: boldFont, size: 10, lineHeight: 12 });
            y -= logoDims.height + 10;

            const noteText = "NOTE: Due to confidentiality issues, use one route sheet for each patient. (No other patient name can be listed).";
            y = drawWrappedText(page, noteText, font, 7, leftMargin, y, contentWidth, 9);
            y -= 5;
            
            drawText(page, "PATIENT ACKNOWLEDGEMENT OF SERVICE RENDERED", { x: leftMargin, y, font: boldFont, size: 8 });
            y -= 10;

            const ackText = "By my signature below, I hereby acknowledge that the services herein stated were received by me from the staff herein named, on the date and time indicated below. My signature below is true and authentic.";
            y = drawWrappedText(page, ackText, font, 7, leftMargin, y, contentWidth, 9);
            y -= 15;

            // Table
            const tableTop = y;
            const colWidths = [70, 50, 50, 110, 150, 100];
            const colStarts = [leftMargin, 110, 160, 210, 320, 470];

            // Headers
            page.drawRectangle({ x: leftMargin, y: y - 20, width: contentWidth, height: 20, borderColor: rgb(0, 0, 0), borderWidth: 0.5 });
            drawText(page, "Service Date", { x: colStarts[0] + 5, y: y - 13, font: boldFont, size: 8 });
            drawText(page, "Time In", { x: colStarts[1] + 10, y: y - 13, font: boldFont, size: 8 });
            drawText(page, "Time Out", { x: colStarts[2] + 8, y: y - 13, font: boldFont, size: 8 });
            drawText(page, "Patient Name", { x: colStarts[3] + 25, y: y - 13, font: boldFont, size: 8 });
            drawText(page, "Patient/PCG Signature", { x: colStarts[4] + 20, y: y - 13, font: boldFont, size: 8 });
            drawText(page, "Type of Visit", { x: colStarts[5] + 25, y: y - 13, font: boldFont, size: 8 });
            drawText(page, "(Follow-up, SOC, ROC, Recert, Discharge)", { x: colStarts[5] + 2, y: y-23, font, size: 6 });
            y -= 20;

            const rowHeight = 35;
            const startIndex = i * visitsPerPage;
            const endIndex = Math.min(startIndex + visitsPerPage, visits.length);
            
            for (let j = startIndex; j < endIndex; j++) {
                const rawVisit = visits[j] || {};
                const visit = {
                    serviceDate: rawVisit.serviceDate || '',
                    timeIn: rawVisit.timeIn || '',
                    timeOut: rawVisit.timeOut || '',
                    patientName: rawVisit.patientName || '',
                    patientSignature: rawVisit.patientSignature || '',
                    typeOfVisit: rawVisit.typeOfVisit || '',
                };

                const visitIndexInPage = j - startIndex;
                const rowY = y - (visitIndexInPage * rowHeight);

                drawText(page, `${j + 1}`, { x: leftMargin - 15, y: rowY - rowHeight/2, font, size: 8 });
                drawText(page, visit.serviceDate, { x: colStarts[0] + 5, y: rowY - 20, font, size: 9 });
                drawText(page, visit.timeIn, { x: colStarts[1] + 5, y: rowY - 20, font, size: 9 });
                drawText(page, visit.timeOut, { x: colStarts[2] + 5, y: rowY - 20, font, size: 9 });
                drawText(page, visit.patientName, { x: colStarts[3] + 5, y: rowY - 20, font, size: 9 });
                if (visit.patientSignature) await drawSignature(page, visit.patientSignature, colStarts[4] + 5, rowY-25, 140, 20, pdfDoc);
                drawText(page, visit.typeOfVisit, { x: colStarts[5] + 5, y: rowY - 20, font, size: 9 });
            }

            const tableBottom = y - (visitsPerPage * rowHeight);
            page.drawRectangle({ x: leftMargin, y: tableBottom, width: contentWidth, height: tableTop - tableBottom, borderColor: rgb(0,0,0), borderWidth: 0.5 });
            colStarts.slice(1).forEach(x => {
                page.drawLine({ start: { x, y: tableTop }, end: { x, y: tableBottom }, thickness: 0.5 });
            });
            Array.from({ length: visitsPerPage }).forEach((_, index) => {
                const rowY = y - (index * rowHeight);
                page.drawLine({ start: { x: leftMargin, y: rowY }, end: { x: width - leftMargin, y: rowY }, thickness: 0.5 });
            });

            // Footer Section for last page
            if (i === totalPages - 1) {
                y = tableBottom - 10;
                const certText = "Staff certification of service provided: I certify that, I have provided home health services to this patient on the date and time indicated above. The patient was not hospitalized or otherwise unavailable when the services was provided. The patient signature indicates that the service was provided is authentic. I understand that I must submit visit notes, route sheets and other required documentation within 5 (FIVE) DAYS from the VISIT.";
                y = drawWrappedText(page, certText, font, 7, leftMargin, y, contentWidth, 8);
                y -= 25;
                
                const employeeName = data.employeeName || '';
                const title = data.title || '';
                const employeeSignature = data.employeeSignature;

                drawText(page, `Employee Name: ${employeeName}`, { x: leftMargin, y, font, size: 9 });
                drawText(page, `Title: ${title}`, { x: leftMargin + 250, y, font, size: 9 });
                if(employeeSignature) await drawSignature(page, employeeSignature, leftMargin + 400, y-5, 150, 18, pdfDoc);
                drawText(page, `Signature:`, { x: leftMargin + 350, y, font, size: 9 });
                y -= 25;

                drawText(page, "FOR OFFICIAL USE ONLY", { x: (width / 2) - 40, y, font: boldFont, size: 9 });
                y -= 20;

                const dateSubmitted = data.dateSubmitted || '';
                const checkedBy = data.checkedBy || '';
                const checkedDate = data.checkedDate || '';
                const remarks = data.remarks || '';
                
                drawText(page, `Date Submitted: ${dateSubmitted}`, { x: leftMargin, y, font, size: 9 });
                drawText(page, `Checked By: ${checkedBy}`, { x: leftMargin + 200, y, font, size: 9 });
                drawText(page, `Checked Date: ${checkedDate}`, { x: leftMargin + 350, y, font, size: 9 });
                y -= 15;
                drawWrappedText(page, `Remarks: ${remarks}`, font, 9, leftMargin, y, contentWidth, 10);
                y -= 20;

                const footerText = `Allstar Health Providers, Inc. - Route Sheet Page ${i + 1} of ${totalPages}`;
                drawText(page, footerText, { x: width - leftMargin - font.widthOfTextAtSize(footerText, 8), y: 30, font, size: 8 });
            } else {
                 const footerText = `Allstar Health Providers, Inc. - Route Sheet Page ${i + 1} of ${totalPages}`;
                drawText(page, footerText, { x: width - leftMargin - font.widthOfTextAtSize(footerText, 8), y: 30, font, size: 8 });
            }
        }
        
        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Allstar weekly report PDF:", error);
        return { error: `An unexpected server error occurred during PDF generation. Error: ${error.message}` };
    }
}
