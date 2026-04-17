
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawSignature, drawWrappedText } from './utils';
import { serverDb } from '@/firebase/server-init';

export async function generateCaregiverResponsibilitiesPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.25);

        // Fetch Admin Signature from settings
        const settingsSnap = await serverDb.collection('settings').doc('availability').get();
        const settingsData = settingsSnap.exists ? settingsSnap.data() : {};
        const adminSignature = settingsData?.adminSignature;

        const addHeaderAndFooter = (page: PDFPage, pageNum: number, totalPages: number) => {
            const { width, height } = page.getSize();
            page.drawImage(logoImage, {
                x: 40,
                y: height - 40 - logoDims.height,
                width: logoDims.width,
                height: logoDims.height,
            });

            const footerY = 30;
            drawText(page, `Page ${pageNum} of ${totalPages}`, { x: 50, y: footerY, font, size: 8 });
            drawText(page, "Revised 10/7/25", { x: width - 50 - font.widthOfTextAtSize("Revised 10/7/25", 8), y: footerY, font, size: 8 });
        };

        const drawList = (page: PDFPage, items: string[], startY: number, leftMargin: number, contentWidth: number, lineHeight: number, fontSize: number): number => {
            let y = startY;
            for (const item of items) {
                if (y < 80) { // Check for footer space
                    return -1; // Indicate a new page is needed
                }
                const isSubItem = item.startsWith('o ');
                const indent = isSubItem ? 30 : 15;
                const text = isSubItem ? `- ${item.substring(2)}` : item;
                y = drawWrappedText(page, text, font, fontSize, leftMargin + indent, y, contentWidth - indent, lineHeight);
                y -= 5;
            }
            return y;
        };

        const allPages = [pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage()];
        allPages.forEach((p, i) => addHeaderAndFooter(p, i + 1, allPages.length));
        
        let currentPageIndex = 0;
        let page = allPages[currentPageIndex];
        let { width, height } = page.getSize();
        const leftMargin = 50;
        const contentWidth = width - leftMargin * 2;
        const lineHeight = 12;
        const mainFontSize = 10;
        
        let y = height - 100;

        drawText(page, "CAREGIVER RESPONSIBILITIES", { x: (width / 2) - (boldFont.widthOfTextAtSize("CAREGIVER RESPONSIBILITIES", 16) / 2), y, font: boldFont, size: 16 });
        y -= 30;

        const contentPage1 = [
            "- Clock In and Out. \no Best to clock in as you exit your car or before you ring the doorbell, once you walk in the door and get distracted. \no Best to clock out after you close the client’s door, before you go to your car.",
            "- Call Offs - On ALL Call-offs the Caregivers must CALL the office a minimum of 4 hours before their shift and give the reason for the call off. Between 7 pm and 8 am, if no one answers the first time, call again. Follow up with a text.",
            "- HIPPA \no Keep the client's business confidential. Be careful not to discuss current or previous assignments while you are on the job. \no Do not conduct your personal business, including personal phone calls, while on duty with a client. \no It is never appropriate to bring a guest (family member, friend, etc) and it is strictly prohibited. to a client’s home,",
            "- Gifts: It is against FLHC Rancho Cucamonga policy to accept any type of gratuity, i.e, money or gifts.",
            "- Badges \no Place in a lanyard that you have purchased or pin to shirt. \no Display badge when in a facility or with the client.",
            "- Lifting: \no Do not lift or carry a client! \no 2 Persons must assist when using the Hoyer Lift: a Caregiver and a family member.",
            "- Dress Code. mask) \no Caregivers must wear scrubs and a mask (unless you or the client prefers not to wear a \no Neat and clean professional \no No long or artificial fingernails due to infection and potential injury to clients. \no An employee is not allowed to wear excessive jewelry or any body piercing jewelry other than a small pair of earrings. If you have tattoos, they should not be visible. \no Wear closed-toe shoes, preferably sneakers. \no Employees should avoid excessive perfume, cologne, aftershave, or scented lotions. \no If the employee is a smoker, clothing and hair should not smell like cigarette smoke.",
            "- Drugs and Alcohol: FLHC has a zero-tolerance policy for drugs and alcohol.",
            "- Meals: Caregiver must bring their own meal and drinks. It can be placed in the refrigerator if the client does not mind.",
        ];
        
        y = drawList(page, contentPage1, y, leftMargin, contentWidth, lineHeight, mainFontSize);
        
        // Page 2
        currentPageIndex++;
        page = allPages[currentPageIndex];
        y = height - 70;

        const contentPage2 = [
            "- Emergencies and Concerns: Communicate with the office any concerns with the client as they happen. Call if urgent matter. If the call goes to voicemail and your matter is urgent, immediately call back. If we are on a call and we see you have called twice, we will put our call on hold and immediately take your call or call you back.",
            "- Injuries to the client or caregiver must be reported to the office immediately. An Incident Report must be completed.",
            "- Infection Control: Precautions require that all blood and other body fluids be treated as if they are infectious. \no Hand hygiene is, proper washing of hands before and after patient contact. \no Always wash your hands before handling food \no Wash your hands after using the toilet \no Remember to wash your hands after blowing your nose. \no Use of appropriate protective equipment (i.e., gloves) before patient contact. \no Respiratory hygiene (i.e., covering your cough and sneeze) \no Injection and sharp object safety and proper disposal. \no Do not remove or interfere with any dressings applied by nursing staff \no All procedures involving blood or other potentially infectious materials shall be performed in such a manner as to minimize splashing, spraying, spattering, and the generation of droplets of these substances.",
            "- Client Notes: Complete client notes in the notebook, for review by family and other caregivers. \no Place header at the top of the page: Client Name, Caregiver Name, Date, Shift hours \no Document notes in the notebook in the client folder (or the FLHC app). Preferably, as you do the duty, rather than all the notes at the end of the shift. At the end of the shift, take a picture of the note and text to the office number 909-321-4466 or complete the note section on the FLHC app (read the note into the microphone) \no Communicate with the office any concerns with the client as they happen. \no How much did the client eat and drink \no How is the client feeling, in pain? Lack of appetite? Depressed? Etc. \no What are you doing with clients to keep them engaged or entertained? \no What is the client’s attitude? Happy, sad, upset, etc. \no Comments or concerns \no Visitors: name, function, how long did they stay? \no Where have you taken him/her, and what did he do there? i.e., store, visit family, etc. \no What was discussed at the doctor's appointment? In detail, please \no What personal care was given? Urine output, diarrhea, shower, sponge bath, etc. \no Client vitals: BP, oxygen level, etc \no Do not get involved with family issues; you are there for the client only",
            "- Training must be finished by the deadline, or shifts will not be assigned.",
            "- TB tests & HCA registration must be kept current, or shifts will not be assigned.",
            "- Client Abandonment: You cannot abandon the client for any reason. You must wait for relief or call the office, unless the client or family says otherwise."
        ];
        
        y = drawList(page, contentPage2, y, leftMargin, contentWidth, lineHeight, mainFontSize);
        
        // Page 3
        currentPageIndex++;
        page = allPages[currentPageIndex];
        y = height - 70;
        
        drawText(page, "Resigning:", {x: leftMargin, y, font: boldFont, size: mainFontSize});
        y -= 15;
        const resigningText = "If you are resigning, please submit in writing a minimum of 2 weeks notice so that we can provide staffing for the client.";
        const parts = resigningText.split("submit in writing a minimum of 2 weeks notice");
        
        let tempX = leftMargin + 15;
        tempX = drawWrappedText(page, parts[0], font, mainFontSize, tempX, y, contentWidth, lineHeight);
        
        const highlightedPart = "submit in writing a minimum of 2 weeks notice";
        const highlightWidth = font.widthOfTextAtSize(highlightedPart, mainFontSize);
        page.drawRectangle({x: tempX, y: y - 2, width: highlightWidth + 2, height: lineHeight, color: rgb(1, 1, 0.6)});
        page.drawLine({start: {x: tempX, y: y - 2}, end: {x: tempX + highlightWidth, y: y-2}, thickness: 0.5});
        tempX = drawWrappedText(page, highlightedPart, font, mainFontSize, tempX, y, contentWidth, lineHeight);

        drawWrappedText(page, parts[1], font, mainFontSize, tempX, y, contentWidth, lineHeight);

        y -= 40;

        drawText(page, "Acknowledgement:", {x: leftMargin, y, font: boldFont, size: mainFontSize});
        y -= 40;

        const sigY = y;
        
        // Employee Signature
        if (formData.caregiverResponsibilitiesSignature) {
            await drawSignature(page, formData.caregiverResponsibilitiesSignature, leftMargin, sigY - 5, 200, 25, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: sigY-10 }, end: { x: leftMargin + 250, y: sigY-10 }, thickness: 0.5 });
        drawText(page, "Employee Signature", { x: leftMargin, y: sigY-20, font, size: 8 });

        // Employee Date
        const empDate = (formData.caregiverResponsibilitiesSignatureDate && (formData.caregiverResponsibilitiesSignatureDate.toDate || isDate(formData.caregiverResponsibilitiesSignatureDate))) ? format(formData.caregiverResponsibilitiesSignatureDate.toDate ? formData.caregiverResponsibilitiesSignatureDate.toDate() : formData.caregiverResponsibilitiesSignatureDate, "MM/dd/yyyy") : '';
        if (empDate) {
            drawText(page, empDate, {x: leftMargin + 300, y: sigY, font, size: 10});
        }
        page.drawLine({ start: { x: leftMargin + 300, y: sigY-10 }, end: { x: leftMargin + 450, y: sigY-10 }, thickness: 0.5 });
        drawText(page, "Date", { x: leftMargin + 300, y: sigY-20, font, size: 8 });

        y -= 40;
        
        const witnessY = y;
        // Witness Signature
        if (adminSignature) {
            await drawSignature(page, adminSignature, leftMargin, witnessY - 5, 200, 25, pdfDoc);
        }
        page.drawLine({ start: { x: leftMargin, y: witnessY-10 }, end: { x: leftMargin + 250, y: witnessY-10 }, thickness: 0.5 });
        drawText(page, "FLHC Witness", { x: leftMargin, y: witnessY-20, font, size: 8 });
        
        // Witness Date
        const witnessDate = format(new Date(), "MM/dd/yyyy");
        drawText(page, witnessDate, {x: leftMargin + 300, y: witnessY, font, size: 10});
        page.drawLine({ start: { x: leftMargin + 300, y: witnessY-10 }, end: { x: leftMargin + 450, y: witnessY-10 }, thickness: 0.5 });
        drawText(page, "Date", { x: leftMargin + 300, y: witnessY-20, font, size: 8 });


        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Caregiver Responsibilities PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
