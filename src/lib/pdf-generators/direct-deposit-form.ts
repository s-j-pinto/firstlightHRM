
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText, drawCenteredText, drawCheckbox } from './utils';

export async function generateDirectDepositFormPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const intuitLogoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/Intuit_Logo.png?alt=media&token=placeholder"; // Replace with real logo if available
        
        let y = height - 60;
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;

        // Title Section
        drawText(page, "Intuit QuickBooks Payroll", { x: leftMargin, y, font, size: 22, color: rgb(0.5, 0.5, 0.7) });
        // Crate a fake logo text for now
        drawText(page, "intuit", { x: rightMargin - 80, y, font: boldFont, size: 28, color: rgb(0.2, 0.4, 0.8) });
        y -= 25;
        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1, dashArray: [2, 2] });
        y -= 20;

        drawText(page, "Employee Direct Deposit Authorization", { x: leftMargin, y, font, size: 14 });
        y -= 25;

        // Instructions
        drawText(page, "Instructions", { x: leftMargin, y, font: boldFont, size: 10 });
        page.drawLine({ start: { x: leftMargin + 60, y: y + 2 }, end: { x: rightMargin, y: y + 2 }, thickness: 1 });
        y -= 15;
        drawText(page, "Employee: Fill out and return to your employer.", { x: leftMargin, y, font, size: 9 });
        y -= 12;
        drawText(page, "Employer: Save for your files only.", { x: leftMargin, y, font, size: 9 });
        y -= 20;

        const instructionText = "This document must be signed by employees requesting automatic deposit of paychecks and retained on file by the employer. Do not send this form to Intuit. Employees must attach a voided check for each of their accounts to help verify their account numbers and bank routing numbers.";
        y = drawWrappedText(page, instructionText, font, 9, leftMargin, y, contentWidth, 11);
        y -= 10;

        // Account 1
        drawText(page, "Account 1", { x: leftMargin, y, font: boldFont, size: 10 });
        drawText(page, "BANK NAME:", { x: leftMargin + 60, y, font: boldFont, size: 10 });
        drawText(page, formData.bankName1 || '', { x: leftMargin + 140, y, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 135, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        y -= 20;

        drawText(page, "Account 1 type:", { x: leftMargin, y, font, size: 10 });
        drawCheckbox(page, formData.accountType1 === "Checking", leftMargin + 100, y + 4);
        drawText(page, "Checking", { x: leftMargin + 115, y, font, size: 10 });
        drawCheckbox(page, formData.accountType1 === "Savings", leftMargin + 180, y + 4);
        drawText(page, "Savings", { x: leftMargin + 195, y, font, size: 10 });
        y -= 20;

        drawText(page, "Bank routing number (ABA number):", { x: leftMargin, y, font, size: 10 });
        drawText(page, formData.routingNumber1 || '', { x: leftMargin + 180, y, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 175, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        y -= 20;

        drawText(page, "Account number:", { x: leftMargin, y, font, size: 10 });
        drawText(page, formData.accountNumber1 || '', { x: leftMargin + 90, y, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 85, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        y -= 20;

        drawText(page, "Percentage or dollar amount to be deposited to this account:", { x: leftMargin, y, font, size: 10 });
        drawText(page, formData.depositAmount1 || '', { x: leftMargin + 310, y, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 305, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        y -= 25;

        // Account 2
        drawText(page, "Account 2", { x: leftMargin, y, font: boldFont, size: 10 });
        drawText(page, "(remainder to be deposited to this account)", { x: leftMargin + 60, y, font, size: 9 });
        page.drawLine({ start: { x: leftMargin + 270, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        y -= 20;

        drawText(page, "Account 2 type:", { x: leftMargin, y, font, size: 10 });
        drawCheckbox(page, formData.accountType2 === "Checking", leftMargin + 100, y + 4);
        drawText(page, "Checking", { x: leftMargin + 115, y, font, size: 10 });
        drawCheckbox(page, formData.accountType2 === "Savings", leftMargin + 180, y + 4);
        drawText(page, "Savings", { x: leftMargin + 195, y, font, size: 10 });
        y -= 20;

        drawText(page, "Bank routing number (ABA number):", { x: leftMargin, y, font, size: 10 });
        drawText(page, formData.routingNumber2 || '', { x: leftMargin + 180, y, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 175, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        y -= 20;

        drawText(page, "Account number:", { x: leftMargin, y, font, size: 10 });
        drawText(page, formData.accountNumber2 || '', { x: leftMargin + 90, y, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 85, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        y -= 15;

        // Attach check box
        page.drawRectangle({
            x: leftMargin,
            y: y - 180,
            width: contentWidth,
            height: 180,
            borderColor: rgb(0.5, 0.5, 0.5),
            borderWidth: 1,
        });
        const boxLabel = "attach a voided check for each account here";
        drawText(page, boxLabel, { x: width / 2 - font.widthOfTextAtSize(boxLabel, 10) / 2, y: y - 90, font: italicFont, size: 10, color: rgb(0.5, 0.5, 0.5) });
        y -= 200;

        // Authorization Section
        drawText(page, "Authorization", { x: leftMargin, y, font: boldFont, size: 10 });
        drawText(page, "(enter your company name in the blank space below)", { x: leftMargin + 75, y, font, size: 9 });
        page.drawLine({ start: { x: leftMargin + 325, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        y -= 20;

        const authBody = "This authorizes FirstLight Home Care of Rancho Cucamonga (the \"Company\") to send credit entries (and appropriate debit and adjustment entries), electronically or by any other commercially accepted method, to my (our) account(s) indicated below and to other accounts I (we) identify in the future (the \"Account\"). This authorizes the financial institution holding the Account to post all such entries. I agree that the ACH transactions authorized herein shall comply with all applicable U.S. Law. This authorization will be in effect until the Company receives a written termination notice from myself and has a reasonable opportunity to act on it.";
        y = drawWrappedText(page, authBody, font, 9, leftMargin, y, contentWidth, 11);
        y -= 20;

        // Signature and Footer Fields
        const sigY = y;
        drawText(page, "Authorized signature:", { x: leftMargin, y: sigY, font, size: 10 });
        if (formData.directDepositAuthorizedSignature) {
            await drawSignature(page, formData.directDepositAuthorizedSignature, leftMargin + 110, sigY - 5, 180, 25, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin + 105, y: sigY - 2 }, end: { x: leftMargin + 320, y: sigY - 2 }, thickness: 0.5 });

        drawText(page, "Employee ID #:", { x: leftMargin + 330, y: sigY, font, size: 10 });
        drawText(page, formData.directDepositEmployeeId || '', { x: leftMargin + 410, y: sigY, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 405, y: sigY - 2 }, end: { x: rightMargin, y: sigY - 2 }, thickness: 0.5 });
        y -= 30;

        drawText(page, "Print name:", { x: leftMargin, y, font, size: 10 });
        drawText(page, formData.directDepositPrintName || '', { x: leftMargin + 60, y, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 55, y: y - 2 }, end: { x: leftMargin + 320, y: y - 2 }, thickness: 0.5 });

        drawText(page, "Date:", { x: leftMargin + 330, y, font, size: 10 });
        const depDate = (formData.directDepositDate && (formData.directDepositDate.toDate || isDate(formData.directDepositDate))) ? format(formData.directDepositDate.toDate ? formData.directDepositDate.toDate() : formData.directDepositDate, "MM/dd/yyyy") : '';
        drawText(page, depDate, { x: leftMargin + 365, y, font, size: 10 });
        page.drawLine({ start: { x: leftMargin + 360, y: y - 2 }, end: { x: rightMargin, y: y - 2 }, thickness: 0.5 });
        
        y -= 40;
        drawText(page, "Employee Direct Deposit Authorization Form", { x: leftMargin, y, font, size: 7, color: rgb(0.6, 0.6, 0.6) });
        drawText(page, "Ver. Authorization_for_Direct_Deposit-081912", { x: rightMargin - 160, y, font, size: 7, color: rgb(0.6, 0.6, 0.6) });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Direct Deposit Form PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
