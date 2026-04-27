
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate, addDays, parse, parseISO, isValid, isWithinInterval, getDay, startOfWeek } from 'date-fns';
import { format as formatInTimeZone, toZonedTime } from 'date-fns-tz';
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

function formatShiftTime(start: string, end: string): string {
    if (!start || !end) return '';
    try {
        const startTime = parse(start, 'h:mm:ss a', new Date());
        const endTime = parse(end, 'h:mm:ss a', new Date());
        const formattedStart = format(startTime, 'h:mmaaa').toLowerCase().replace(':00', '');
        const formattedEnd = format(endTime, 'h:mmaaa').toLowerCase().replace(':00', '');
        return `${formattedStart}-\n${formattedEnd}`;
    } catch (e) {
        // Fallback for unexpected formats
        return `${start} -\n${end}`;
    }
}

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
        const logoDims = logoImage.scale(0.8);

        const leftMargin = 40;
        let y = height - 50;

        // --- Header ---
        page.drawImage(logoImage, {
            x: leftMargin,
            y: y - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        drawText(page, "CARE NOTES", { x: leftMargin + logoDims.width + 10, y: y - 35, font: boldFont, size: 10 });
        
        y -= (logoDims.height + 25); 

        // --- Client Info Section ---
        const clientInfoBoxX = leftMargin + 280;
        const clientInfoBoxWidth = width - clientInfoBoxX - leftMargin;
        const clientInfoBoxHeight = 80;
        
        const dob = data.clientData?.DOB ? format(new Date(data.clientData.DOB), 'MM/dd/yyyy') : 'N/A';
        const clientInfoData = [
            { label: "Client Name", value: data.groupData?.clientName || 'N/A' },
            { label: "Last 4 of SSN", value: data.groupData?.vaLast4SSN || '' },
            { label: "Referral Number", value: data.groupData?.vaReferralNumber || '' },
            { label: "DOB", value: dob },
        ];
        
        drawInfoBox(page, clientInfoBoxX, y - clientInfoBoxHeight, clientInfoBoxWidth, clientInfoBoxHeight, clientInfoData, font, boldFont);
        
        drawText(page, "Agency Name: FirstLight Home Care of Rancho Cucamonga", { x: leftMargin, y: y, font, size: 9 });
        y -= 20;
        drawText(page, "Program Name: Home Maker/HHA Program", { x: leftMargin, y: y, font, size: 9 });
        
        y -= 20;
        const weekStartForHeader = parseISO(data.selectedWeek);
        const weekEndForHeader = addDays(weekStartForHeader, 6);
        drawText(page, `Week: ${format(weekStartForHeader, 'MM/dd/yy')} - ${format(weekEndForHeader, 'MM/dd/yy')}`, { x: leftMargin, y: y, font, size: 9 });

        y -= 45;

        // --- Shifts Table ---
        const pacificTimeZone = 'America/Los_Angeles';
        const shiftsByDay: { [key: number]: any[] } = {};
        
        data.shifts.forEach((shift: any) => {
            if (!shift.date) return;
            const shiftUtcDate = parseISO(shift.date);
            if (!isValid(shiftUtcDate)) return;

            const dayIndexString = formatInTimeZone(shiftUtcDate, 'i', { timeZone: pacificTimeZone });
            const dayIndex = Number(dayIndexString) % 7; 
            
            if (!shiftsByDay[dayIndex]) {
                shiftsByDay[dayIndex] = [];
            }
            shiftsByDay[dayIndex].push(shift);
        });
        
        const contentWidth = width - 2 * leftMargin;
        const firstColWidth = contentWidth * 0.30;
        
        const topTableTopY = y;
        const topTableRowHeight = 25;
        
        const dayHeaders = Array.from({ length: 7 }).map((_, i) => {
            const dayDate = addDays(weekStartForHeader, i);
            return `${formatInTimeZone(dayDate, 'EEE', { timeZone: pacificTimeZone })}\n${formatInTimeZone(dayDate, 'MM/dd/yy', { timeZone: pacificTimeZone })}`;
        });

        // Row 1: Week/Dates
        let currentY = y - topTableRowHeight / 2 - 5;
        drawText(page, "Week", { x: leftMargin + 5, y: currentY, font: boldFont, size: 8 });
        dayHeaders.forEach((header, i) => {
            const dayX = leftMargin + firstColWidth + (i * ((contentWidth - firstColWidth) / 7));
            drawText(page, header, { x: dayX + 5, y: y - 8, font: boldFont, size: 8, lineHeight: 9 });
        });
        y -= topTableRowHeight;

        // Row 2: Caregiver Name
        currentY = y - topTableRowHeight / 2 - 5;
        drawText(page, "Caregiver Name", { x: leftMargin + 5, y: currentY, font: boldFont, size: 8 });
        
        for (let i = 0; i < 7; i++) {
            const shifts = shiftsByDay[i];
            if (shifts && shifts.length > 0) {
                const dayX = leftMargin + firstColWidth + (i * ((contentWidth - firstColWidth) / 7));
                const caregiverNames = shifts.map(shift => {
                    if (!shift.caregiverName) return '';
                    const nameParts = shift.caregiverName.includes(',') 
                        ? shift.caregiverName.split(',').map((p:string) => p.trim()) 
                        : shift.caregiverName.split(' ');
                    
                    let firstName, lastName;
                    if (shift.caregiverName.includes(',')) {
                        lastName = nameParts[0] || '';
                        firstName = nameParts[1] || '';
                    } else {
                        lastName = nameParts.pop() || '';
                        firstName = nameParts.join(' ');
                    }
                    return `${firstName}\n${lastName}`;
                }).join('\n\n');
                
                drawText(page, caregiverNames, { x: dayX + 5, y: currentY + 12, font, size: 8, lineHeight: 9 });
            }
        }
        y -= topTableRowHeight;

        // Row 3: Shift Time
        currentY = y - topTableRowHeight / 2 - 2;
        drawText(page, "Shift Time", { x: leftMargin + 5, y: currentY, font: boldFont, size: 8 });
        for (let i = 0; i < 7; i++) {
            const shifts = shiftsByDay[i];
            if (shifts && shifts.length > 0) {
                const dayX = leftMargin + firstColWidth + (i * ((contentWidth - firstColWidth) / 7));
                const timeText = shifts.map(s => formatShiftTime(s.arrivalTime, s.departureTime)).join('\n\n');
                drawText(page, timeText, { x: dayX + 5, y: currentY + 12, font, size: 8, lineHeight: 9 });
            }
        }
        y -= topTableRowHeight;
        
        const topTableBottomY = y;
        page.drawRectangle({ x: leftMargin, y: topTableBottomY, width: contentWidth, height: topTableTopY - topTableBottomY, borderColor: rgb(0,0,0), borderWidth: 1 });
        page.drawLine({start: {x: leftMargin + firstColWidth, y: topTableTopY}, end: {x: leftMargin + firstColWidth, y: topTableBottomY}, thickness: 1});
        [1,2].forEach(i => page.drawLine({start: {x: leftMargin, y: topTableTopY - (i * topTableRowHeight)}, end: {x: width - leftMargin, y: topTableTopY - (i * topTableRowHeight)}, thickness: 0.5}));
        
        y -= 25;

        // --- Tasks Table ---
        const taskLabels = data.templateData?.tasks?.filter((t: string) => t !== 'providerSignature') || [];
        const taskTableTop = y;

        drawText(page, "TASKS PERFORMED", { x: leftMargin + 5, y: y - 12, font: boldFont, size: 8 });
        
        y -= 20;

        const rowHeight = 18 * 1.2;
        taskLabels.forEach((task: string) => {
            const taskLabel = task.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
            const textHeight = boldFont.heightAtSize(8);
            const textY = y - (rowHeight / 2) + (textHeight / 2);
            drawText(page, taskLabel, { x: leftMargin + 5, y: textY, font: boldFont, size: 8 });

            for (let i = 0; i < 7; i++) {
                const shiftsForDay = shiftsByDay[i];
                const dayX = leftMargin + firstColWidth + (i * ((contentWidth - firstColWidth) / 7)) + (((contentWidth - firstColWidth) / 7) / 2) - 5;
                if (shiftsForDay && shiftsForDay.length > 0) {
                    const isTaskDone = shiftsForDay.some(s => s.tasks?.[task]);
                    drawCheckbox(page, !!isTaskDone, dayX, y - (rowHeight / 2));
                }
            }
            y -= rowHeight;
        });

        const providerSigTextHeight = boldFont.heightAtSize(8);
        drawText(page, "Provider Signature", { x: leftMargin + 5, y: y - (rowHeight / 2) - (providerSigTextHeight / 2) + 4, font: boldFont, size: 8 });
        for (let i = 0; i < 7; i++) {
            const shiftsForDay = shiftsByDay[i];
            if (shiftsForDay && shiftsForDay.length > 0) {
                const dayX = leftMargin + firstColWidth + (i * ((contentWidth - firstColWidth) / 7));
                const signatures = shiftsForDay.map(s => s.providerSignature || getInitials(s.caregiverName)).join(', ');
                drawText(page, signatures, { x: dayX + 5, y: y - (rowHeight / 2) - (font.heightAtSize(10) / 2) + 4, font: cursiveFont, size: 10 });
            }
        }
        y -= rowHeight;

        // Draw table borders
        const taskTableBottom = y;
        page.drawRectangle({x: leftMargin, y: taskTableBottom, width: contentWidth, height: taskTableTop - taskTableBottom, borderColor: rgb(0,0,0), borderWidth: 1});
        page.drawLine({ start: { x: leftMargin + firstColWidth, y: taskTableTop }, end: { x: leftMargin + firstColWidth, y: taskTableBottom }, thickness: 1 });
        
        for (let i = 0; i < taskLabels.length + 2; i++) {
            const rowLineY = taskTableTop - (i * rowHeight);
            if (i > 0) page.drawLine({start: {x: leftMargin, y: rowLineY}, end: {x: width - leftMargin, y: rowLineY}, thickness: 0.5});
        }
         for (let i = 0; i < 7; i++) {
            const colLineX = leftMargin + firstColWidth + (i * ((contentWidth - firstColWidth) / 7));
            page.drawLine({start: {x: colLineX, y: taskTableTop}, end: {x: colLineX, y: taskTableBottom}, thickness: 0.5});
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
