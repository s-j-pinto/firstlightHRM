
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate, addDays, parse, parseISO } from 'date-fns';
import { drawText, drawCheckbox, drawWrappedText } from './utils';

// This function will draw a box with rows, for the client info
const drawInfoBox = (page: PDFPage, x: number, y: number, width: number, height: number, data: {label: string, value: string}[], font: PDFFont, boldFont: PDFFont) => {
    page.drawRectangle({
        x,
        y,
        width,
        height,
        borderColor: rgb(0, 0, 0),
        borderWidth: 1,
    });

    const rowHeight = height / data.length;
    const padding = 5;

    data.forEach((row, index) => {
        const rowY = y + height - (index * rowHeight) - rowHeight / 2 - 4;
        
        drawText(page, row.label, { x: x + padding, y: rowY, font: boldFont, size: 8 });
        drawText(page, row.value, { x: x + width / 2 + padding, y: rowY, font, size: 8 });

        if (index < data.length - 1) {
            page.drawLine({
                start: { x: x, y: y + height - (index + 1) * rowHeight },
                end: { x: x + width, y: y + height - (index + 1) * rowHeight },
                thickness: 0.5,
            });
        }
    });

    page.drawLine({
        start: { x: x + width / 2, y: y },
        end: { x: x + width / 2, y: y + height },
        thickness: 0.5,
    });
};

const getInitials = (name: string): string => {
    if (!name) return '';
    const cleanedName = name.replace(/,/g, ''); 
    const parts = cleanedName.split(' ').filter(p => p.length > 0);
    if (parts.length > 1) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    } else if (parts.length === 1 && parts[0].length > 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return '';
};

export async function generateVaWeeklyReportPdf(data: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const cursiveFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/VA-report-logo.png?alt=media&token=655fd007-7367-4475-981b-b3a9bb33baab";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.64); // Doubled from 0.32

        const leftMargin = 40;
        let y = height - 50;

        // --- Header ---
        page.drawImage(logoImage, {
            x: leftMargin,
            y: y - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        drawText(page, "CARE NOTES", { x: leftMargin + logoDims.width + 10, y: y - 25, font: boldFont, size: 22 }); // Slightly reduced font size
        
        y -= (logoDims.height + 25); 

        // --- Client Info Section ---
        const clientInfoBoxX = leftMargin + 280;
        const clientInfoBoxWidth = width - clientInfoBoxX - leftMargin;
        const clientInfoBoxHeight = 60;
        
        const dob = data.clientData?.DOB ? format(new Date(data.clientData.DOB), 'MM/dd/yyyy') : 'N/A';
        const clientInfoData = [
            { label: "Client Name", value: data.groupData?.clientName || 'N/A' },
            { label: "Last 4 of SSN", value: "" }, 
            { label: "Referral Number", value: "" }, 
            { label: "DOB", value: dob },
        ];
        
        drawInfoBox(page, clientInfoBoxX, y - clientInfoBoxHeight, clientInfoBoxWidth, clientInfoBoxHeight, clientInfoData, font, boldFont);
        
        drawText(page, "Agency Name: FirstLight Home Care of Rancho Cucamonga", { x: leftMargin, y: y, font, size: 9 });
        y -= 20;
        drawText(page, "Program Name: Home Maker/HHA Program", { x: leftMargin, y, font, size: 9 });
        y -= 45;

        drawText(page, `Week: ${data.weekOf || 'N/A'}`, { x: leftMargin, y, font, size: 10 });
        y -= 25;

        // --- Shifts Table ---
        const shiftsByDay: { [key: number]: any } = {};
        const weekStart = parse(data.weekOf.split(' - ')[0], 'MM/dd/yy', new Date());

        data.shifts.forEach((shift: any) => {
            if (!shift.date) return;
            const shiftDate = new Date(shift.date); // Date is now an ISO string
            const dayIndex = shiftDate.getDay(); // 0 = Sunday
            if (!shiftsByDay[dayIndex]) {
                shiftsByDay[dayIndex] = shift;
            }
        });
        
        const tableColWidth = (width - 2 * leftMargin) / 8;
        
        // Headers
        let currentTableY = y;
        drawText(page, "Caregiver Name", { x: leftMargin + 5, y: currentTableY - 12, font: boldFont, size: 8 });
        drawText(page, "Shift Time", { x: leftMargin + 5, y: currentTableY - 32, font: boldFont, size: 8 });
        
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 0; i < 7; i++) {
            const dayX = leftMargin + tableColWidth + (i * tableColWidth);
            const dayDate = addDays(weekStart, i);
            const headerText = `${format(dayDate, 'EEE')}\n${format(dayDate, 'MM/dd/yy')}`;
            drawText(page, headerText, { x: dayX + 5, y: currentTableY - 10, font: boldFont, size: 8, lineHeight: 10 });
        }
        currentTableY -= 40;

        // Content
        drawText(page, data.caregiverName || '', { x: leftMargin + 5, y: currentTableY, font, size: 8 });
        for (let i = 0; i < 7; i++) {
            const dayX = leftMargin + tableColWidth + (i * tableColWidth);
            const shift = shiftsByDay[i];
            if (shift) {
                const timeText = `${shift.arrivalTime || ''} - ${shift.departureTime || ''}`;
                drawText(page, timeText, { x: dayX + 5, y: currentTableY, font, size: 8 });
            }
        }
        
        page.drawRectangle({ x: leftMargin, y: currentTableY - 10, width: width - 2 * leftMargin, height: 60, borderColor: rgb(0,0,0), borderWidth: 1 });
        page.drawLine({ start: { x: leftMargin + tableColWidth, y: y+20 }, end: { x: leftMargin + tableColWidth, y: y - 20 }, thickness: 1 });
        page.drawLine({ start: { x: leftMargin, y: y-20 }, end: { x: width-leftMargin, y: y - 20 }, thickness: 1 });
        y -= 65; 

        // --- Tasks Table ---
        const taskLabels = data.templateData?.tasks?.filter((t: string) => t !== 'providerSignature') || [];
        const taskTableTop = y;

        // Headers
        for (let i = 0; i < 7; i++) {
            const dayX = leftMargin + tableColWidth + (i * tableColWidth);
            const dayDate = addDays(weekStart, i);
            const headerText = `${format(dayDate, 'EEE')}\n${format(dayDate, 'MM/dd/yy')}`;
            drawText(page, headerText, { x: dayX + 5, y: y - 10, font: boldFont, size: 8, lineHeight: 10 });
        }
        drawText(page, "TASKS PERFORMED", { x: leftMargin + 5, y: y - 12, font: boldFont, size: 8 });
        y -= 20;

        // Rows
        const rowHeight = 15;
        taskLabels.forEach((task: string) => {
            const taskLabel = task.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
            drawText(page, taskLabel, { x: leftMargin + 5, y: y - (rowHeight / 2) + 2, font, size: 8 });

            for (let i = 0; i < 7; i++) {
                const shift = shiftsByDay[i];
                if (shift) {
                    const dayX = leftMargin + tableColWidth + (i * tableColWidth) + (tableColWidth / 2) - 5;
                    drawCheckbox(page, shift.tasks?.[task], dayX, y - (rowHeight / 2));
                }
            }
            y -= rowHeight;
        });

        // Provider Signature Row
        const caregiverInitials = getInitials(data.caregiverName);
        drawText(page, "Provider Signature", { x: leftMargin + 5, y: y - (rowHeight / 2) + 2, font: boldFont, size: 8 });
        for (let i = 0; i < 7; i++) {
            const shift = shiftsByDay[i];
            if (shift) {
                const dayX = leftMargin + tableColWidth + (i * tableColWidth);
                drawText(page, shift.providerSignature || caregiverInitials, { x: dayX + 5, y: y - (rowHeight / 2) + 2, font: cursiveFont, size: 10 });
            }
        }
        y -= rowHeight;

        // Draw table borders
        const taskTableBottom = y;
        page.drawRectangle({x: leftMargin, y: taskTableBottom, width: width - 2 * leftMargin, height: taskTableTop - taskTableBottom, borderColor: rgb(0,0,0), borderWidth: 1});
        page.drawLine({ start: { x: leftMargin + tableColWidth, y: taskTableTop }, end: { x: leftMargin + tableColWidth, y: taskTableBottom }, thickness: 1 });
        
        for (let i = 0; i < taskLabels.length + 1; i++) {
            const lineY = taskTableTop - 20 - (i * rowHeight);
            page.drawLine({start: {x: leftMargin, y: lineY}, end: {x: width - leftMargin, y: lineY}, thickness: 0.5});
        }

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("[PDF Generator] CRITICAL ERROR:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        
        let errorMessage = 'An unknown error occurred in the PDF generator.';
        if (error instanceof Error) {
            errorMessage = error.message;
            if (error.stack) {
                console.error("[PDF Generator] Stack Trace:", error.stack);
            }
        } else if (typeof error === 'object' && error !== null) {
            errorMessage = JSON.stringify(error);
        } else {
            errorMessage = String(error);
        }
        
        return { error: `Failed to generate PDF: ${errorMessage}` };
    }
}
