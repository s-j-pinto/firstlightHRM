
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateDrugAlcoholPolicyPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.3); // Enlarged logo
        
        const drawFieldBoxWithSignature = async (
            page: PDFPage,
            label: string,
            dateValue: string,
            sigValue: string | undefined,
            yPos: number,
            xPos: number,
            widthField: number
        ) => {
            if (sigValue) {
                await drawSignature(page, sigValue, xPos, yPos, 150, 20, pdfDoc);
            }
            page.drawLine({ start: { x: xPos, y: yPos - 5 }, end: { x: xPos + widthField, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, label, { x: xPos, y: yPos - 15, font, size: smallFontSize });

            if (dateValue) {
                drawText(page, dateValue, { x: xPos + widthField + 50, y: yPos, font, size: mainFontSize });
            }
            page.drawLine({ start: { x: xPos + widthField + 40, y: yPos - 5 }, end: { x: xPos + widthField + 150, y: yPos - 5 }, thickness: 0.5 });
            drawText(page, "Date", { x: xPos + widthField + 40, y: yPos - 15, font, size: smallFontSize });
        };

        // --- Page 1 ---
        const page1 = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page1.getSize();
        const leftMargin = 50;
        const rightMargin = width - 50;
        const contentWidth = rightMargin - leftMargin;
        const lineHeight = 12;
        const mainFontSize = 10;
        const titleFontSize = 11;
        const smallFontSize = 8;
        
        page1.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: height - 50 - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });
        
        let y = height - 140;

        const title = "DRUG AND/OR ALCOHOL TESTING CONSENT FORM";
        drawText(page1, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, titleFontSize) / 2), y, font: boldFont, size: titleFontSize });
        y -= 15;
        const subTitle = "EMPLOYEE AGREEMENT AND CONSENT TO DRUG AND/OR ALCOHOL TESTING";
        drawText(page1, subTitle, { x: (width / 2) - (boldFont.widthOfTextAtSize(subTitle, titleFontSize) / 2), y, font: boldFont, size: titleFontSize });
        y -= 30;

        const p1 = `I hereby agree, upon a request made under the drug/alcohol testing policy of FirstLight HomeCare to submit to a drug or alcohol test and to furnish a sample of my saliva, urine, breath, and/or blood for analysis. I understand and agree that if I, at any time, refuse to submit to a drug or alcohol test under company policy, or if I otherwise fail to cooperate with the testing procedures, I will be subject to immediate termination. I further authorize and give full permission to have FirstLight HomeCare and/or a physician designated by FirstLight HomeCare send the specimen or specimens so collected to a laboratory for a screening test for the presence of any prohibited substances under the policy, and for the laboratory or other testing facility to release any and all documentation relating to such test to FirstLight HomeCare and/or to any governmental entity involved in a legal proceeding or investigation connected with the test. Finally, I authorize the FirstLight HomeCare to disclose any documentation relating to such test to any governmental entity involved in a legal proceeding or investigation connected with the test.`;
        y = drawWrappedText(page1, p1, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight;

        const p2 = `I understand that only duly-authorized FirstLight HomeCare officers, employees, and agents will have access to information furnished or obtained in connection with the test; that they will maintain and protect the confidentiality of such information to the greatest extent possible; and that they will share such information only to the extent necessary to make employment decisions and to respond to inquiries or notices from government entities.`;
        y = drawWrappedText(page1, p2, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);

        // --- Page 2 ---
        const page2 = pdfDoc.addPage(PageSizes.Letter);
        y = height - 70; // Reset y for new page

        const p3 = `I will hold harmless FirstLight HomeCare, its designated physician, and any testing laboratory that FirstLight HomeCare might use, meaning that I will not sue or hold responsible such parties for any alleged harm to me that might result from such testing, including loss of employment or any other kind of adverse job action that might arise as a result of the drug or alcohol test, even if FirstLight HomeCare officers, employees, and agents or laboratory representative makes an error in the administration or analysis of the test or the reporting of the results. I will further hold harmless FirstLight HomeCare, its designated physician, test vendor and any testing laboratory FirstLight HomeCare might use for any alleged harm to me that might result from the release or use of information or documentation relating to the drug or alcohol test, as long as the release or use of the information is within the scope of this policy and the procedures as explained in the paragraph above.`;
        y = drawWrappedText(page2, p3, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight;

        const p4 = `This policy and authorization have been explained to me in a language I understand, and I have been told that if I have any questions about the test or the policy, they will be answered.`;
        y = drawWrappedText(page2, p4, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 2;
        
        const p5 = `I UNDERSTAND FIRSTLIGHT HOMECARE WILL REQUIRE A DRUG SCREEN AND/OR ALCOHOL TEST UNDER THIS POLICY PRIOR TO EMPLOYMENT, WHENEVER I AM INVOLVED IN AN ON-THE-JOB ACCIDENT OR INJURY UNDER CIRCUMSTANCES THAT SUGGEST POSSIBLE INVOLVEMENT OR INFLUENCE OF DRUGS OR ALCOHOL IN THE ACCIDENT OR INJURY EVENT, AND I AGREE TO SUBMIT TO ANY SUCH TEST.`;
        y = drawWrappedText(page2, p5, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 40;

        // Signatures
        const employeeSigDate = (formData.drugAlcoholPolicySignatureDate && (formData.drugAlcoholPolicySignatureDate.toDate || isDate(formData.drugAlcoholPolicySignatureDate))) ? format(formData.drugAlcoholPolicySignatureDate.toDate ? formData.drugAlcoholPolicySignatureDate.toDate() : formData.drugAlcoholPolicySignatureDate, "MM/dd/yyyy") : '';
        await drawFieldBoxWithSignature(page2, "Signature of Employee", employeeSigDate, formData.drugAlcoholPolicySignature, y, leftMargin, 200);
        y -= 40;
        
        page2.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 350, y: y - 5 }, thickness: 0.5 });
        if (formData.drugAlcoholPolicyEmployeePrintedName) drawText(page2, formData.drugAlcoholPolicyEmployeePrintedName, {x: leftMargin + 5, y: y, font, size: mainFontSize});
        drawText(page2, "Employee's Name - Printed", {x: leftMargin, y: y-15, font, size: smallFontSize});
        y -= 40;

        const repSigDate = (formData.drugAlcoholPolicyRepDate && (formData.drugAlcoholPolicyRepDate.toDate || isDate(formData.drugAlcoholPolicyRepDate))) ? format(formData.drugAlcoholPolicyRepDate.toDate ? formData.drugAlcoholPolicyRepDate.toDate() : formData.drugAlcoholPolicyRepDate, "MM/dd/yyyy") : '';
        await drawFieldBoxWithSignature(page2, "FirstLight HomeCare Representative", repSigDate, formData.drugAlcoholPolicyRepSignature, y, leftMargin, 200);
        y -= 60;
        
        // Test Results
        drawText(page2, "TEST RESULTS – ORAL SALIVA", {x: (width / 2) - (boldFont.widthOfTextAtSize("TEST RESULTS – ORAL SALIVA", 10) / 2), y, font: boldFont, size: 10});
        y -= 20;
        drawText(page2, "______________ Negative", {x: leftMargin + 100, y, font, size: mainFontSize});
        drawText(page2, "______________ Positive _______________Drug", {x: leftMargin + 250, y, font, size: mainFontSize});
        y -= 40;

        drawText(page2, "TEST RESULTS – BLOOD", {x: (width / 2) - (boldFont.widthOfTextAtSize("TEST RESULTS – BLOOD", 10) / 2), y, font: boldFont, size: 10});
        y -= 20;
        drawText(page2, "______________ Negative", {x: leftMargin + 100, y, font, size: mainFontSize});
        drawText(page2, "______________ Positive _______________Drug", {x: leftMargin + 250, y, font, size: mainFontSize});

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Drug Alcohol Policy PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
