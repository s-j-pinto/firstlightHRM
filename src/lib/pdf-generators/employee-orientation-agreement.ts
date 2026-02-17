
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';

export async function generateEmployeeOrientationAgreementPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.3);

        const addPageContent = async (page: PDFPage, content: { text: string; isBold?: boolean; isList?: boolean }[], startY: number, leftMargin: number, contentWidth: number, lineHeight: number, mainFontSize: number) => {
            let y = startY;
            for (const item of content) {
                const fontToUse = item.isBold ? boldFont : font;
                const indent = item.isList ? 15 : 0;
                y = drawWrappedText(page, item.text, fontToUse, mainFontSize, leftMargin + indent, y, contentWidth - indent, lineHeight);
                y -= lineHeight * (item.isList ? 0.5 : 1);
                 if (y < 60) {
                    return y; // Stop if we're near the bottom of the page
                }
            }
            return y;
        };

        const page1 = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page1.getSize();
        const leftMargin = 60;
        const contentWidth = width - (leftMargin * 2);
        const lineHeight = 11;
        const mainFontSize = 9;

        page1.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: height - 50 - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        let y = height - 120;
        const title = "EMPLOYEE ORIENTATION AGREEMENT";
        drawText(page1, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, 14) / 2), y, font: boldFont, size: 14 });
        y -= 30;

        const page1Content = [
            { text: "I certify that I have received a copy of the FirstLight Employee Manual or have access to the online version and will read and familiarize myself with its contents. I understand that the FirstLight Home Care Administrator or Care Coordinator will answer any questions I may have regarding the contents of the document.", isBold: false },
            { text: "I understand that the policies contained in the Manual are intended for guidance only, and may be unilaterally amended by FirstLight without notice.", isBold: false },
            { text: "I further understand that the FirstLight Manual does not create a contract of employment, but rather my employment with FirstLight is on an at-will basis. As such, I am free to resign at anytime, and FirstLight may end my employment at anytime, for any reason or no reason at all, with or without notice.", isBold: false },
            { text: "I further agree to follow the policies and procedures, which are emphasized during my orientation as outlined below:", isBold: false },
            { text: "EMPLOYMENT POLICIES:", isBold: true },
            { text: "• I understand that as a FirstLight employee I will begin employment on a 90-day probationary period. Work performance and punctuality will be monitored and documented during this time.", isList: true },
            { text: "• I understand FirstLight payroll procedures and cycle.", isList: true },
            { text: "• I further understand that I will not be paid unless I follow the clock-in and clock-out procedure outlined in the Clock-In Instructions document and Caregiver Portal Brochure.", isList: true },
            { text: "• I understand that only neat and clean attire are considered appropriate dress for assignments.", isList: true },
            { text: "• I will not actively seek employment with a FirstLight customer.", isList: true },
            { text: "• I further understand that accepting employment with a FirstLight customer in which I was placed on an assignment can result in monies owed to FirstLight by the Client and myself of up to $5,000.", isList: true },
            { text: "• If I am unable to report to work or if I will be late, I will call FirstLight four (4) business hours prior to the start of my assignment. If I do not report to work and fail to call with an explanation, my action will be considered a \"voluntary resignation\".", isList: true },
            { text: "• I understand that switching shifts or days with other FirstLight employees without prior authorization from FirstLight staff approval is not allowed.", isList: true },
            { text: "• FirstLight employees are authorized to schedule shifts with institutional work site managers without prior authorization of FirstLight staff. Please notify the office as soon as possible to ensure the schedule reflects the change.", isList: true },
            { text: "• I understand that FirstLight cannot control customer cancellations of shifts assigned.", isList: true },
        ];

        y = await addPageContent(page1, page1Content, y, leftMargin, contentWidth, lineHeight, mainFontSize);
        
        const page2 = pdfDoc.addPage(PageSizes.Letter);
        y = height - 70; // Reset y for new page

        const page2Content = [
            { text: "• I understand that if I call off for two(2) or more consecutive shifts(days) for medical reasons, I may be asked to provide a doctor's clearance to work prior to future scheduling of shifts.", isList: true },
            { text: "• I understand the Communicable Disease guidelines and will report changes in my health status to FirstLight.", isList: true },
            { text: "• I understand that repeated tardiness for scheduled shifts will result in customer requests not to schedule me on future assignments. This can also result in termination of employment with FirstLight.", isList: true },
            { text: "• I understand that, if available, I have the option of choosing whether to have benefits(health insurance and paid vacation time) or to be paid more money per hour if I do not need or want benefits. It is my responsibility to complete the benefits enrollment process within the time period stated. I understand that I must enroll for FirstLight benefits within my first 90 days of employment. If I choose not to, or fail to enroll by this date, I will not be able to enroll for benefits until the next open enrollment period(subject to change).", isList: true },
            { text: "• I will not smoke in a client’s home, even if that client is a smoker.", isList: true },
            { text: "• I am obligated to notify FirstLight by the next working day if I am being investigated by any governmental agency for any act, offense or omission, including an investigation related to the abuse or neglect, or threat of abuse or neglect to a child or other client, or an investigation related to misappropriation of a client’s property.", isList: true },
            { text: "• I understand that my image reflects directly upon FirstLight.", isList: true },
            { text: "• I will conduct myself professionally, will not use profanity, and will not disclose a client’s personal information to anyone.", isList: true },
            { text: "• I understand that the sale or use of drugs and/or intoxicating beverages while on a FirstLight assignment is strictly prohibited.", isList: true },
            { text: "• I understand that I may be tested and checked for drugs and/or alcohol if I am injured on the job and go to a medical facility for treatment.", isList: true },
            { text: "• If I am injured while in the course of my work, I will report the injury to my supervisor and to FirstLight at once. Any incident involving the client will be reported to FirstLight as soon as possible.", isList: true },
            { text: "• I have been familiarized with the forms I am expected to complete while working in the field.", isList: true },
            { text: "• I am aware that I should contact the office if I think a client could benefit from assistance from other community agencies.", isList: true },
            { text: "• I agree to finish all the training assigned to be before I get client assignment. I understand that I may not be provided a client assignment if the training is not completed.", isList: true },
        ];

        y = await addPageContent(page2, page2Content, y, leftMargin, contentWidth, lineHeight, mainFontSize);
        
        y -= 40;

        // Signature section on page 2
        const drawSigLine = (label: string, value: string | undefined, sigData: string | undefined, yPos: number) => {
            page2.drawLine({start: {x: leftMargin, y: yPos - 5}, end: {x: leftMargin + contentWidth, y: yPos - 5}, thickness: 0.5});
            drawText(page2, label, {x: leftMargin, y: yPos - 15, font, size: 8});
            if (value) drawText(page2, value, {x: leftMargin + 5, y: yPos, font, size: mainFontSize});
            if (sigData) drawSignature(page2, sigData, leftMargin + 5, yPos-2, 200, 20, pdfDoc);
        }
        
        const empName = formData.orientationAgreementEmployeeName;
        drawSigLine("Employee Name (Printed)", empName, undefined, y);
        y -= 40;
        
        const empSigDate = (formData.orientationAgreementSignatureDate && (formData.orientationAgreementSignatureDate.toDate || isDate(formData.orientationAgreementSignatureDate))) ? format(formData.orientationAgreementSignatureDate.toDate ? formData.orientationAgreementSignatureDate.toDate() : formData.orientationAgreementSignatureDate, "MM/dd/yyyy") : '';
        drawSigLine("Employee Signature", undefined, formData.orientationAgreementSignature, y);
        drawText(page2, `Date: ${empSigDate}`, {x: leftMargin + 350, y, font, size: mainFontSize});
        y -= 40;
        
        const witnessSigDate = (formData.orientationAgreementWitnessDate && (formData.orientationAgreementWitnessDate.toDate || isDate(formData.orientationAgreementWitnessDate))) ? format(formData.orientationAgreementWitnessDate.toDate ? formData.orientationAgreementWitnessDate.toDate() : formData.orientationAgreementWitnessDate, "MM/dd/yyyy") : '';
        drawSigLine("FirstLight Home Care Witness", undefined, formData.orientationAgreementWitnessSignature, y);
        drawText(page2, `Date: ${witnessSigDate}`, {x: leftMargin + 350, y, font, size: mainFontSize});

        const pdfBytes = await pdfDoc.save();
        return { success: true, pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Employee Orientation Agreement PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
