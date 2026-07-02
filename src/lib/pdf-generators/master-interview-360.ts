
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { drawText, drawCheckbox, drawWrappedText, drawCenteredText } from './utils';

export async function generateMasterInterview360Pdf(combinedData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const leftMargin = 50;
        const contentWidth = width - leftMargin * 2;
        let y = height - 40;

        const mainFontSize = 8.5;
        const titleFontSize = 14;
        const sectionHeaderSize = 10;
        const lineHeight = 11;

        y = drawCenteredText(page, `MASTER INTERVIEW 360 - ${combinedData.fullName || 'Candidate'}`, boldFont, titleFontSize, y);
        y -= 20;

        const drawSectionHeader = (text: string, currentY: number) => {
            page.drawRectangle({
                x: leftMargin,
                y: currentY - 2,
                width: contentWidth,
                height: sectionHeaderSize + 4,
                color: rgb(0.9, 0.9, 0.9),
            });
            drawText(page, text, { x: leftMargin + 5, y: currentY, font: boldFont, size: sectionHeaderSize });
            return currentY - 20;
        };

        const drawLabelValue = (label: string, value: any, x: number, currentY: number, labelWidth = 120) => {
            drawText(page, `${label}:`, { x, y: currentY, font: boldFont, size: mainFontSize });
            const displayValue = value === true ? 'Yes' : (value === false ? 'No' : String(value || 'N/A'));
            drawText(page, displayValue, { x: x + labelWidth, y: currentY, font, size: mainFontSize });
        };

        // --- SECTION: PERSONAL & LOGISTICS ---
        y = drawSectionHeader("PERSONAL & LOGISTICS", y);
        drawLabelValue("NAME", combinedData.fullName, leftMargin, y);
        drawLabelValue("TELEPHONE", combinedData.phone, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue("SOURCE", combinedData.source, leftMargin, y);
        const dateApplied = combinedData.createdAt ? format(combinedData.createdAt.toDate ? combinedData.createdAt.toDate() : new Date(combinedData.createdAt), 'PP') : 'N/A';
        drawLabelValue("DATE APPLIED", dateApplied, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue("ADDRESS", `${combinedData.address || ''}, ${combinedData.city || ''} ${combinedData.zip || ''}`, leftMargin, y);
        y -= lineHeight;
        drawLabelValue("EMAIL", combinedData.email, leftMargin, y);
        const psDate = combinedData.interviewDateTime ? format(combinedData.interviewDateTime.toDate ? combinedData.interviewDateTime.toDate() : new Date(combinedData.interviewDateTime), 'PPp') : 'N/A';
        drawLabelValue("PHONESCREEN DATE", psDate, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue("WORK PERMIT (Spanish)", combinedData.workPermitVisaSpanish, leftMargin, y);
        y -= sectionSpacing;

        const sectionSpacing = 15;

        // --- SECTION: BACKGROUND ---
        y = drawSectionHeader("BACKGROUND", y);
        drawText(page, "FLHC Overview Assessment:", { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        y = drawWrappedText(page, combinedData.flhcOverview, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        y -= 5;
        drawText(page, "What prompted you to call FirstLight?", { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        y = drawWrappedText(page, combinedData.promptedCallFLHC, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        y -= 10;
        drawLabelValue("CAREGIVER EXPERIENCE", `${combinedData.yearsExperience} Years - ${combinedData.previousRoles}`, leftMargin, y, 150);
        y -= lineHeight;
        drawLabelValue("ROLE PREFERENCE", combinedData.roleDurationPreference, leftMargin, y, 150);
        y -= lineHeight;
        drawText(page, "Types of conditions worked with:", { x: leftMargin, y, font: boldFont, size: mainFontSize });
        y -= lineHeight;
        y = drawWrappedText(page, combinedData.experiencedConditions, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        y -= 5;
        drawLabelValue("OTHER LANGUAGES", combinedData.otherLanguages, leftMargin, y);
        drawLabelValue("PAY EXPECTATION", combinedData.payExpectation, leftMargin + 250, y);
        y -= sectionSpacing;

        // --- SECTION: CERTIFICATIONS & AVAILABILITY ---
        y = drawSectionHeader("CERTIFICATIONS & AVAILABILITY", y);
        const certs = [];
        if(combinedData.hca) certs.push("HCA");
        if(combinedData.hha) certs.push("HHA");
        if(combinedData.liveScan) certs.push("Live Scan");
        if(combinedData.negativeTbTest) certs.push("Negative TB");
        if(combinedData.cprFirstAid) certs.push("CPR/First Aid");
        drawLabelValue("CERTIFICATIONS", certs.join(", "), leftMargin, y);
        y -= lineHeight;
        drawLabelValue("OVERNIGHT AVAILABILITY", combinedData.overnightStayAvailability, leftMargin, y);
        drawLabelValue("START DATE", combinedData.howSoonStart, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue("EARLIEST TIME", combinedData.earliestStartTime, leftMargin, y);
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
        y = drawSectionHeader("INTERVIEW INSIGHTS", y);
        const questions = [
            { q: "What made you decide to become a caregiver?", a: combinedData.q_decideBecomeCaregiver },
            { q: "Most rewarding/challenging parts?", a: combinedData.q_rewardingChallenging },
            { q: "Strengths and weaknesses?", a: combinedData.q_strengthsWeaknesses },
            { q: "Specialized training?", a: combinedData.q_specializedTraining },
            { q: "Career goals?", a: combinedData.q_careerGoals },
        ];
        for(const item of questions) {
            drawText(page, item.q, { x: leftMargin, y, font: italicFont, size: mainFontSize });
            y -= lineHeight;
            y = drawWrappedText(page, item.a, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
            y -= 5;
            if(y < 50) { page = pdfDoc.addPage(PageSizes.Letter); y = height - 50; }
        }
        y -= 10;

        // --- SECTION: SITUATIONS ---
        y = drawSectionHeader("SITUATIONS", y);
        const situations = [
            { q: "Dementia experience?", a: combinedData.q_dementiaExperience },
            { q: "Upset client/Wants to go home?", a: combinedData.q_clientUpsetHome },
            { q: "Client tells you to leave?", a: combinedData.q_clientTellingLeave },
            { q: "Combative/Hitting/Scratching?", a: combinedData.q_clientCombative + " / " + combinedData.q_clientHittingScratching },
            { q: "Asks for deceased spouse?", a: combinedData.q_deceasedSpouse },
            { q: "Difficult/Stressful situation handled?", a: combinedData.q_difficultSituation },
            { q: "Client refusal (eating/bathing)?", a: combinedData.q_clientRefusal },
            { q: "Criticism/Feedback response?", a: combinedData.q_criticismFeedback },
            { q: "Medical emergency (no office reached)?", a: combinedData.q_medicalEmergencyNoOffice },
            { q: "End of shift notes?", a: combinedData.q_clientNotes },
        ];
        for(const item of situations) {
            drawText(page, item.q, { x: leftMargin, y, font: italicFont, size: mainFontSize });
            y -= lineHeight;
            y = drawWrappedText(page, item.a, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
            y -= 5;
            if(y < 50) { page = pdfDoc.addPage(PageSizes.Letter); y = height - 50; }
        }
        y -= 10;

        // --- SECTION: SKILLS & TRANSPORTATION ---
        y = drawSectionHeader("SKILLS, EXPERIENCE & TRANSPORTATION", y);
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

        drawLabelValue("RELIABLE VEHICLE", combinedData.hasCar, leftMargin, y);
        drawLabelValue("AUTO INSURANCE", combinedData.q_hasAutoInsurance, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue("VALID LICENSE", combinedData.validLicense, leftMargin, y);
        drawLabelValue("VIOLATIONS (10yr)", combinedData.q_movingViolations, leftMargin + 250, y);
        y -= lineHeight;
        drawLabelValue("MISDEMEANORS", combinedData.q_misdemeanorCharges, leftMargin, y);
        y -= lineHeight;
        drawLabelValue("TRAVEL AREAS (IE)", combinedData.q_ieTravelAreas, leftMargin, y);
        y -= lineHeight;
        drawLabelValue("RESTRICTED AREAS", combinedData.q_preferredNotWorkAreas, leftMargin, y);

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating Master Interview 360 PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
