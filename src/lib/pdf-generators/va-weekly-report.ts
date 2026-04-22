
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format } from 'date-fns';
import { drawText, drawCheckbox } from './utils';

export async function generateVaWeeklyReportPdf(data: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        
        const leftMargin = 40;
        let y = height - 50;

        // Header
        drawText(page, "VETERANS AFFAIRS (VA) AUTHORIZED CARE", {x: leftMargin, y, font: boldFont, size: 12});
        drawText(page, `WEEK OF: ${data.weekOf || 'N/A'}`, {x: width - 150, y, font: boldFont, size: 10});
        y -= 25;

        drawText(page, `CLIENT: ${data.groupData?.clientName || 'N/A'}`, {x: leftMargin, y, font, size: 10});
        drawText(page, `CAREGIVER: ${data.caregiverName || 'N/A'}`, {x: leftMargin + 300, y, font, size: 10});
        y -= 20;

        // Table Header
        const tableTop = y;
        const colWidths = [80, 50, 50, 400];
        const colStarts: number[] = [leftMargin];
        colWidths.forEach((w, i) => colStarts.push(colStarts[i] + w));

        page.drawRectangle({x: leftMargin, y: y-18, width: colWidths.reduce((a,b)=>a+b), height: 18, color: rgb(0.9, 0.9, 0.9)});
        drawText(page, "DATE", {x: colStarts[0] + 25, y: y - 13, font: boldFont, size: 8});
        drawText(page, "TIME IN", {x: colStarts[1] + 10, y: y - 13, font: boldFont, size: 8});
        drawText(page, "TIME OUT", {x: colStarts[2] + 5, y: y - 13, font: boldFont, size: 8});
        drawText(page, "TASKS", {x: colStarts[3] + 180, y: y - 13, font: boldFont, size: 8});
        y -= 18;

        const allTasks = data.templateData?.tasks || [];
        const taskLabels = allTasks.filter((t: string) => t !== 'providerSignature');
        
        // Rows
        for (const shift of data.shifts) {
            const shiftDate = shift.date.toDate ? shift.date.toDate() : new Date(shift.date.seconds * 1000);
            
            const taskHeight = 12 * Math.ceil(taskLabels.length / 2);
            const rowHeight = Math.max(20, taskHeight + 8);
            
            if (y - rowHeight < 50) {
                 const newPage = pdfDoc.addPage(PageSizes.Letter);
                 // Redraw header if needed
                 y = newPage.getHeight() - 50;
            }
            
            const rowY = y;
            drawText(page, format(shiftDate, 'MM/dd/yyyy'), {x: colStarts[0] + 5, y: rowY - 15, font, size: 9});
            drawText(page, shift.arrivalTime || '', {x: colStarts[1] + 5, y: rowY - 15, font, size: 9});
            drawText(page, shift.departureTime || '', {x: colStarts[2] + 5, y: rowY - 15, font, size: 9});

            let taskY = rowY - 10;
            taskLabels.forEach((task: string, index: number) => {
                const colIndex = Math.floor(index / Math.ceil(taskLabels.length / 2));
                const taskX = colStarts[3] + 5 + (colIndex * 200);

                if (colIndex > 0 && index % Math.ceil(taskLabels.length / 2) === 0) {
                    taskY = rowY - 10;
                }
                
                drawCheckbox(page, !!shift.tasks[task], taskX, taskY);
                const taskLabel = task.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
                drawText(page, taskLabel, {x: taskX + 15, y: taskY + 1, font, size: 8});
                taskY -= 12;
            });
            
            y -= rowHeight;
            page.drawLine({ start: {x: leftMargin, y}, end: {x: colStarts[4], y}, thickness: 0.5 });
        }
        
        const tableBottom = y;
        page.drawRectangle({x: leftMargin, y: tableBottom, width: colWidths.reduce((a,b)=>a+b), height: tableTop - tableBottom, borderColor: rgb(0,0,0), borderWidth: 0.5});
        colStarts.slice(1).forEach(x => {
            page.drawLine({ start: { x, y: tableTop }, end: { x, y: tableBottom }, thickness: 0.5 });
        });

        // Provider Signature
        y -= 30;
        drawText(page, `Provider Signature: ${data.providerSignature || '_______________________'}`, {x: leftMargin, y, font, size: 10});

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating VA Weekly Report PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
