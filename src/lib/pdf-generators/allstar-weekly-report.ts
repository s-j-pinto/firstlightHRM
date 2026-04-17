
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateAllstarWeeklyReportPdf(data: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/CareLogs%2FLogo%2FAll_star_logo.png?alt=media&token=44b7cda1-36eb-4b97-91ca-1fca1a053993";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.85 * 0.85); // Reduced size by 15%

        let y = height - 40;
        const leftMargin = 40;
        const contentWidth = width - leftMargin * 2;
        
        // --- Header ---
        const headerTopY = y + 10;
        const headerHeight = logoDims.height + 20;
        page.drawRectangle({
            x: leftMargin - 5,
            y: headerTopY - headerHeight,
            width: contentWidth + 10,
            height: headerHeight,
            borderColor: rgb(0,0,0),
            borderWidth: 1
        });

        // Column 1: Logo
        page.drawImage(logoImage, {
            x: leftMargin,
            y: y - logoDims.height + 10,
            width: logoDims.width,
            height: logoDims.height,
        });

        // Column 2: Address
        const addressText = "Allstar Health Providers, Inc.\n10722 Arrow Route Suite 218\nRancho Cucamonga CA 91730\nTel. No. (909) 945-9899;\nFax No.\n(909) 945-9799";
        drawText(page, addressText, {
            x: leftMargin + logoDims.width + 15,
            y: y,
            font: font,
            size: 9,
            lineHeight: 11
        });

        // Column 3: Title
        const headerRightText = "ROUTE SHEET, PATIENT ACKNOWLEDGEMENT, AND\nSTAFF CERTIFICATION OF SERVICES RENDERED";
        drawText(page, headerRightText, {
            x: 370, // Adjusted position
            y: y - 10,
            font: boldFont,
            size: 7, // Reduced font size
            lineHeight: 12
        });
        y -= logoDims.height + 15;
        
        y -= 20; // One blank row

        // --- Sub-Header ---
        const noteText = "NOTE: Due to confidentiality issues, use one route sheet for each patient. (No other patient name can be listed).";
        y = drawWrappedText(page, noteText, font, 9, leftMargin, y, contentWidth, 11);
        y -= 20; // One blank row
        
        drawText(page, "PATIENT ACKNOWLEDGEMENT OF SERVICE RENDERED", { x: leftMargin, y, font: boldFont, size: 9 });
        y -= 12;
        const ackText = "By my signature below, I hereby acknowledge that the services herein stated were received by me from the staff herein named, on the date and time indicated below. My signature below is true and authentic.";
        y = drawWrappedText(page, ackText, font, 9, leftMargin, y, contentWidth, 11);
        y -= 22;

        // --- Table ---
        const tableTop = y;
        const colWidths = [90, 50, 50, 140, 100, 75];
        const colStarts = [
            leftMargin,
            leftMargin + colWidths[0], 
            leftMargin + colWidths[0] + colWidths[1], 
            leftMargin + colWidths[0] + colWidths[1] + colWidths[2], 
            leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], 
            leftMargin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4],
        ];

        // Headers
        const tableHeaderY = y - 13;
        drawText(page, "Service Date", { x: colStarts[0] + 10, y: tableHeaderY, font: boldFont, size: 9 });
        drawText(page, "Time In", { x: colStarts[1] + 10, y: tableHeaderY, font: boldFont, size: 9 });
        drawText(page, "Time Out", { x: colStarts[2] + 5, y: tableHeaderY, font: boldFont, size: 9 });
        drawText(page, "Patient Name", { x: colStarts[3] + 30, y: tableHeaderY, font: boldFont, size: 9 });
        
        y -= 20;

        const rowHeight = 35;
        for (let j = 0; j < 10; j++) {
            const visit = data.visits?.[j] || {};
            const rowY = y - (j * rowHeight);
            
            drawText(page, `${j + 1}.`, { x: leftMargin - 15, y: rowY - (rowHeight / 2) + 4, font, size: 9 });

            drawText(page, visit.serviceDate || '', { x: colStarts[0] + 5, y: rowY - 20, font, size: 9 });
            drawText(page, visit.timeIn || '', { x: colStarts[1] + 5, y: rowY - 20, font, size: 9 });
            drawText(page, visit.timeOut || '', { x: colStarts[2] + 5, y: rowY - 20, font, size: 9 });
            drawText(page, visit.patientName || '', { x: colStarts[3] + 5, y: rowY - 20, font, size: 9 });
        }

        const tableBottom = y - (10 * rowHeight);
        page.drawRectangle({ x: leftMargin, y: tableBottom, width: contentWidth, height: tableTop - tableBottom, borderColor: rgb(0,0,0), borderWidth: 0.5 });
        colStarts.slice(1).forEach(x => {
            page.drawLine({ start: { x, y: tableTop }, end: { x, y: tableBottom }, thickness: 0.5 });
        });
        Array.from({ length: 11 }).forEach((_, index) => {
            const lineY = y - (index * rowHeight);
            page.drawLine({ start: { x: leftMargin, y: lineY }, end: { x: width - leftMargin, y: lineY }, thickness: 0.5 });
        });

        // --- Footer Section ---
        y = tableBottom - 20;
        
        const certTitle = "Staff certification of service provided:";
        drawText(page, certTitle, { x: leftMargin, y, font: boldFont, size: 10 });
        const titleWidth = boldFont.widthOfTextAtSize(certTitle, 10);
        page.drawLine({ start: { x: leftMargin, y: y - 2 }, end: { x: leftMargin + titleWidth, y: y - 2 }, thickness: 0.8 });
        y -= 22;

        const certBody1 = "I certify that, I have provided home health services to this patient on the date and time indicated above. The patient was not hospitalized or otherwise unavailable when the services was provided. The patient signature indicates that the service was provided is authentic. I understand that I must submit visit notes, route sheets and other required documentation within ";
        y = drawWrappedText(page, certBody1, font, 9, leftMargin, y, contentWidth, 11);
        y -= 1; 
        
        const certBody2 = "5 (FIVE) DAYS from the VISIT.";
        const body1Width = font.widthOfTextAtSize("...documentation within ", 9);
        const body2Width = boldFont.widthOfTextAtSize(certBody2, 9);
        const body2X = leftMargin + body1Width;
        drawText(page, certBody2, { x: body2X, y, font: boldFont, size: 9 });
        page.drawLine({ start: { x: body2X, y: y - 2 }, end: { x: body2X + body2Width, y: y - 2 }, thickness: 0.8 });

        y -= 25;

        // Employee Name and Title with underlines
        const empNameLabel = 'Employee Name: ';
        const empNameValue = data.employeeName || '';
        const empNameXStart = leftMargin + font.widthOfTextAtSize(empNameLabel, 9);
        drawText(page, empNameLabel, { x: leftMargin, y, font, size: 9 });
        drawText(page, empNameValue, { x: empNameXStart, y, font, size: 9 });
        page.drawLine({ start: { x: empNameXStart, y: y - 2 }, end: { x: leftMargin + 240, y: y - 2 }, thickness: 0.5 });

        const titleLabel = 'Title: ';
        const titleValue = data.title || '';
        const titleXStart = leftMargin + 250 + font.widthOfTextAtSize(titleLabel, 9);
        drawText(page, titleLabel, { x: leftMargin + 250, y, font, size: 9 });
        drawText(page, titleValue, { x: titleXStart, y, font, size: 9 });
        page.drawLine({ start: { x: titleXStart, y: y - 2 }, end: { x: titleXStart + 80, y: y - 2 }, thickness: 0.5 });
        
        if (data.employeeSignature) {
            await drawSignature(page, data.employeeSignature, leftMargin + 400, y - 5, 120, 20, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin + 400, y: y - 5}, end: {x: leftMargin + 520, y: y-5}, thickness: 0.5 });
        drawText(page, "Signature:", { x: leftMargin + 350, y, font, size: 9 });
        y -= 25;

        drawText(page, "FOR OFFICIAL USE ONLY", { x: (width / 2) - 40, y, font: boldFont, size: 9 });
        y -= 20;

        drawText(page, `Date Submitted: ${data.dateSubmitted || ''}`, { x: leftMargin, y, font, size: 9 });
        drawText(page, `Checked By: ${data.checkedBy || ''}`, { x: leftMargin + 200, y, font, size: 9 });
        drawText(page, `Checked Date: ${data.checkedDate || ''}`, { x: leftMargin + 350, y, font, size: 9 });
        y -= 15;
        drawText(page, `Remarks: ${data.remarks || ''}`, {x: leftMargin, y, font, size: 9});

        // Page Footer
        const footerText = `Allstar Health Providers, Inc. - Route Sheet Page 1 of 1`;
        drawText(page, footerText, { x: width - leftMargin - font.widthOfTextAtSize(footerText, 8), y: 30, font, size: 8 });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Allstar weekly report PDF:", error);
        
        const undefinedFields: string[] = [];

        // Check top-level properties expected by the PDF generator
        const topLevelKeys = ['weekOf', 'employeeName', 'employeeSignature', 'title', 'dateSubmitted', 'checkedBy', 'checkedDate', 'remarks'];
        topLevelKeys.forEach(key => {
            if (data[key] === undefined) {
                undefinedFields.push(key);
            }
        });

        // Check nested properties within each visit
        if (!data.visits || !Array.isArray(data.visits)) {
            undefinedFields.push('visits (must be an array)');
        } else {
            const visitKeys = ['serviceDate', 'timeIn', 'timeOut', 'patientName'];
            data.visits.forEach((visit: any, index: number) => {
                if (visit === null || typeof visit !== 'object') {
                    undefinedFields.push(`visit at index ${index} (is null or not an object)`);
                    return; // continue to next visit
                }
                visitKeys.forEach(key => {
                    if (visit[key] === undefined) {
                        undefinedFields.push(`visits[${index}].${key}`);
                    }
                });
            });
        }
        
        const errorMessage = `PDF Generation Error: The following fields were missing or undefined: ${undefinedFields.join(", ")}.`;
        console.error("[PDF Action] Validation Error:", errorMessage);
        console.error("[PDF Action] Failing Payload:", JSON.stringify(data, null, 2));

        return { error: errorMessage };
    }
}
