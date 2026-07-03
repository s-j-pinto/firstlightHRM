
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage, Color } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawCheckbox, drawWrappedText, drawCenteredText } from './utils';

export async function generateMasterInterview360Pdf(combinedData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.18);

        let page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const leftMargin = 50;
        const contentWidth = width - leftMargin * 2;
        
        const mainFontSize = 8.5;
        const titleFontSize = 14;
        const sectionHeaderSize = 10;
        const lineHeight = 11;
        const sectionSpacing = 15;

        let y = height - 40;

        // Draw Logo at top left
        page.drawImage(logoImage, {
            x: leftMargin,
            y: height - 30 - logoDims.height,
            width: logoDims.width,
            height: logoDims.height,
        });

        y = drawCenteredText(page, `MASTER INTERVIEW 360 - ${combinedData.fullName || 'Candidate'}`, boldFont, titleFontSize, y);
        y -= 30;

        const drawSectionHeader = (targetPage: PDFPage, text: string, currentY: number, bgColor?: Color) => {
            targetPage.drawRectangle({
                x: leftMargin,
                y: currentY - 2,
                width: contentWidth,
                height: sectionHeaderSize + 4,
                color: bgColor || rgb(0.9, 0.9, 0.9),
            });
            drawText(targetPage, text, { x: leftMargin + 5, y: currentY, font: boldFont, size: sectionHeaderSize });
            return currentY - 20;
        };

        const drawLabelValue = (targetPage: PDFPage, label: string, value: any, x: number, currentY: number, labelWidth = 120) => {
            drawText(targetPage, `${label}:`, { x, y: currentY, font: boldFont, size: mainFontSize });
            const displayValue = value === true ? 'Yes' : (value === false ? 'No' : String(value || 'N/A'));
            drawText(targetPage, displayValue, { x: x + labelWidth, y: currentY, font, size: mainFontSize });
        };

        // --- SECTION: PERSONAL & LOGISTICS (Light Green Background) ---
        const lightGreen = rgb(0.86, 0.98, 0.91); // Tailwind green-100 equivalent
        y = drawSectionHeader(page, "PERSONAL & LOGISTICS", y, lightGreen);
        drawLabelValue(page, "NAME", combinedData.fullName, leftMargin, y);
        drawLabelValue(page, "TELEPHONE", combinedData.phone, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue(page, "SOURCE", combinedData.source, leftMargin, y);
        const dateApplied = combinedData.createdAt ? format(combinedData.createdAt.toDate ? combinedData.createdAt.toDate() : new Date(combinedData.createdAt), 'PP') : 'N/A';
        drawLabelValue(page, "DATE APPLIED", dateApplied, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue(page, "ADDRESS", `${combinedData.address || ''}, ${combinedData.city || ''} ${combinedData.zip || ''}`, leftMargin, y);
        y -= lineHeight;
        drawLabelValue(page, "EMAIL", combinedData.email, leftMargin, y);
        const psDate = combinedData.interviewDateTime ? format(combinedData.interviewDateTime.toDate ? combinedData.interviewDateTime.toDate() : new Date(combinedData.interviewDateTime), 'PPp') : 'N/A';
        drawLabelValue(page, "PHONESCREEN DATE", psDate, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue(page, "WORK PERMIT (Spanish)", combinedData.workPermitVisaSpanish, leftMargin, y);
        y -= sectionSpacing;

        // --- SECTION: BACKGROUND ---
        y = drawSectionHeader(page, "BACKGROUND", y);
        drawText(page, "FLHC Overview Assessment:", { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        y = drawWrappedText(page, combinedData.flhcOverview, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        y -= 5;
        drawText(page, "What prompted you to call FirstLight?", { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        y = drawWrappedText(page, combinedData.promptedCallFLHC, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        y -= 10;
        drawLabelValue(page, "CAREGIVER EXPERIENCE", `${combinedData.yearsExperience} Years - ${combinedData.previousRoles}`, leftMargin, y, 150);
        y -= lineHeight;
        drawLabelValue(page, "ROLE PREFERENCE", combinedData.roleDurationPreference, leftMargin, y, 150);
        y -= lineHeight;
        drawText(page, "Types of conditions worked with:", { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        y = drawWrappedText(page, combinedData.experiencedConditions, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        y -= 5;
        drawLabelValue(page, "OTHER LANGUAGES", combinedData.otherLanguages, leftMargin, y);
        drawLabelValue(page, "PAY EXPECTATION", combinedData.payExpectation, leftMargin + 250, y);
        y -= sectionSpacing;

        // --- SECTION: CERTIFICATIONS & AVAILABILITY ---
        y = drawSectionHeader(page, "CERTIFICATIONS & AVAILABILITY", y);
        const certs = [];
        if(combinedData.hca) certs.push("HCA");
        if(combinedData.hha) certs.push("HHA");
        if(combinedData.liveScan) certs.push("Live Scan");
        if(combinedData.negativeTbTest) certs.push("Negative TB");
        if(combinedData.cprFirstAid) certs.push("CPR/First Aid");
        drawLabelValue(page, "CERTIFICATIONS", certs.join(", "), leftMargin, y);
        y -= lineHeight;
        drawLabelValue(page, "OVERNIGHT AVAILABILITY", combinedData.overnightStayAvailability, leftMargin, y);
        drawLabelValue(page, "START DATE", combinedData.howSoonStart, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue(page, "EARLIEST TIME", combinedData.earliestStartTime, leftMargin, y);
        y -= lineHeight;
        
        drawText(page, "WEEKLY AVAILABILITY:", { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        let availX = leftMargin + 10;
        days.forEach(day => {
            const val = combinedData.availability?.[day]?.join(", ") || 'None';
            drawText(page, `${day.charAt(0).toUpperCase() + day.slice(1, 3)}: ${val}`, { x: availX, y, font, size: mainFontSize - 1 });
            availX += 75;
        });
        y -= sectionSpacing;

        // --- SECTION: INTERVIEW INSIGHTS ---
        y = drawSectionHeader(page, "INTERVIEW INSIGHTS", y);
        const questions = [
            { q: "What made you decide to become a caregiver?", a: combinedData.q_decideBecomeCaregiver },
            { q: "Most rewarding/challenging parts?", a: combinedData.q_rewardingChallenging },
            { q: "Strengths and weaknesses?", a: combinedData.q_strengthsWeaknesses },
            { q: "Specialized training?", a: combinedData.q_specializedTraining },
            { q: "Career goals?", a: combinedData.q_careerGoals },
        ];
        for(const item of questions) {
            if(y < 50) { 
                page = pdfDoc.addPage(PageSizes.Letter);
                y = height - 50; 
            }
            drawText(page, item.q, { x: leftMargin, y, font: italicFont, size: mainFontSize });
            y -= lineHeight;
            y = drawWrappedText(page, item.a, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
            y -= 5;
        }
        y -= 10;

        // --- SECTION: SITUATIONS ---
        if(y < 80) { 
            page = pdfDoc.addPage(PageSizes.Letter);
            y = height - 50; 
        }
        y = drawSectionHeader(page, "SITUATIONS", y);
        const situations = [
            { q: "How much experience do you have with dementia?", a: combinedData.q_dementiaExperience },
            { q: "What would you do if client wants to go home and is very upset?", a: combinedData.q_clientUpsetHome },
            { q: "What if client was telling you to leave?", a: combinedData.q_clientTellingLeave },
            { q: "What if client is combative?", a: combinedData.q_clientCombative },
            { q: "What if client is hitting or trying to scratch you?", a: combinedData.q_clientHittingScratching },
            { q: "What if client asks where spouse is (who died years ago.)?", a: combinedData.q_deceasedSpouse },
            { q: "Describe a difficult or stressful situation you have experienced while caregiving. How did you handle it?", a: combinedData.q_difficultSituation },
            { q: "What would you do if a client refused to cooperate with daily tasks, such as eating or bathing?", a: combinedData.q_clientRefusal },
            { q: "How do you respond to criticism or feedback from a client or their family?", a: combinedData.q_criticismFeedback },
            { q: "How would you handle a medical emergency if the office could not be reached?", a: combinedData.q_medicalEmergencyNoOffice },
            { q: "Do you write client notes at end of shift? What do you include in the client notes?", a: combinedData.q_clientNotes },
        ];
        for(const item of situations) {
            if(y < 50) { 
                page = pdfDoc.addPage(PageSizes.Letter);
                y = height - 50; 
            }
            drawText(page, item.q, { x: leftMargin, y, font: italicFont, size: mainFontSize });
            y -= lineHeight;
            y = drawWrappedText(page, item.a, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
            y -= 5;
        }
        y -= 10;

        // --- SECTION: SKILLS & TRANSPORTATION ---
        if(y < 120) { 
            page = pdfDoc.addPage(PageSizes.Letter);
            y = height - 50; 
        }
        y = drawSectionHeader(page, "SKILLS, EXPERIENCE & TRANSPORTATION", y);
        const skills = [
            { l: "Hospice", v: combinedData.hasHospiceExperience },
            { l: "Bed Bound", v: combinedData.canWorkWithBedBound },
            { l: "Change Briefs", v: combinedData.canChangeBrief },
            { l: "Transfer", v: combinedData.canTransfer },
            { l: "Prep Meals", v: combinedData.canPrepareMeals },
            { l: "Bed Bath", v: combinedData.canDoBedBath },
            { l: "Hoyer Lift", v: combinedData.canUseHoyerLift },
            { l: "Gait Belt", v: combinedData.canUseGaitBelt },
            { l: "Purwick", v: combinedData.canUsePurwick },
            { l: "Catheter", v: combinedData.canEmptyCatheter },
            { l: "Colostomy", v: combinedData.canEmptyColostomyBag },
            { l: "Medication", v: combinedData.canGiveMedication },
            { l: "Blood Pressure", v: combinedData.canTakeBloodPressure },
        ];
        
        let skillX = leftMargin + 5;
        let skillY = y;
        skills.forEach((s, i) => {
            drawCheckbox(page, !!s.v, skillX, skillY);
            drawText(page, s.l, { x: skillX + 12, y: skillY + 1, font, size: mainFontSize - 1 });
            skillX += (contentWidth / 4);
            if((i + 1) % 4 === 0) { skillX = leftMargin + 5; skillY -= 15; }
        });
        y = skillY - 15;

        drawLabelValue(page, "RELIABLE VEHICLE", combinedData.hasCar, leftMargin, y);
        drawLabelValue(page, "AUTO INSURANCE", combinedData.q_hasAutoInsurance, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue(page, "VALID LICENSE", combinedData.validLicense, leftMargin, y);
        drawLabelValue(page, "VIOLATIONS (10yr)", combinedData.q_movingViolations, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue(page, "MISDEMEANORS", combinedData.q_misdemeanorCharges, leftMargin, y);
        y -= lineHeight;
        drawLabelValue(page, "TRAVEL AREAS (IE)", combinedData.q_ieTravelAreas, leftMargin, y);
        y -= lineHeight;
        drawLabelValue(page, "RESTRICTED AREAS", combinedData.q_preferredNotWorkAreas, leftMargin, y);

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Master Interview 360 PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
