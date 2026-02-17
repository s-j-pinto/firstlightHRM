
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFFont, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { sanitizeText, drawText, drawCheckbox, drawSignature, drawWrappedText } from './utils';

export async function generateSoc341aPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const pages = [pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage()];
        
        const mainFontSize = 9;
        const smallFontSize = 8;
        const titleFontSize = 11;
        const lineHeight = 11;

        const drawHeaderAndFooter = (page: any, pageNum: number, totalPages: number) => {
            const { width, height } = page.getSize();
            const leftMargin = 60;

            if (pageNum === 1) {
                drawText(page, "STATE OF CALIFORNIA - HEALTH AND HUMAN SERVICES AGENCY", { x: leftMargin, y: height - 40, font: boldFont, size: mainFontSize });
                drawText(page, "CALIFORNIA DEPARTMENT OF SOCIAL SERVICES", { x: leftMargin, y: height - 52, font: boldFont, size: mainFontSize });
            }

            const footerY = 30;
            drawText(page, "SOC 341A (3/15)", { x: leftMargin, y: footerY, font, size: smallFontSize });
            const pageNumText = `PAGE ${pageNum} OF ${totalPages}`;
            drawText(page, pageNumText, { x: width - leftMargin - font.widthOfTextAtSize(pageNumText, smallFontSize), y: footerY, font, size: smallFontSize });
        };
        
        pages.forEach((page, index) => drawHeaderAndFooter(page, index + 1, pages.length));
        
        let y = pages[0].getHeight() - 90;
        const leftMargin = 60;
        const contentWidth = pages[0].getWidth() - (leftMargin * 2);

        const title = "STATEMENT ACKNOWLEDGING REQUIREMENT TO REPORT SUSPECTED\nABUSE OF DEPENDENT ADULTS AND ELDERS";
        drawText(pages[0], title, { x: (pages[0].getWidth() / 2) - 170, y, font: boldFont, size: titleFontSize, lineHeight: 14 });
        y -= 40;

        const note = "NOTE: RETAIN IN EMPLOYEE/ VOLUNTEER FILE";
        drawText(pages[0], note, { x: (pages[0].getWidth() / 2) - (font.widthOfTextAtSize(note, smallFontSize) / 2), y, font, size: smallFontSize });
        y -= 25;

        // --- PAGE 1 ---
        y = drawWrappedText(pages[0], `NAME: ${formData.fullName || ''}     POSITION: Caregiver     FACILITY: FirstLight Home Care of Rancho Cucamonga`, font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "California law REQUIRES certain persons to report known or suspected abuse of dependent adults or elders. As an employee or volunteer at a licensed facility, you are one of those persons - a “mandated reporter.”", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[0], "PERSONS WHO ARE REQUIRED TO REPORT ABUSE", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "Mandated reporters include care custodians and any person who has assumed full or intermittent responsibility for care or custody of an elder or dependent adult, whether or not paid for that responsibility (Welfare and Institutions Code (WIC) Section 15630(a)). Care custodian means an administrator or an employee of most public or private facilities or agencies, or persons providing care or services for elders or dependent adults, including members of the support staff and maintenance staff (WIC Section 15610.17).", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[0], "PERSONS WHO ARE THE SUBJECT OF THE REPORT", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "Elder means any person residing in this state who is 65 years of age or older (WIC Section 15610.27). Dependent Adult means any person residing in this state, between the ages of 18 and 64, who has physical or mental limitations that restrict his or her ability to carry out normal activities or to protect his or her rights including, but not limited to, persons who have physical or developmental disabilities or whose physical or mental abilities have diminished because of age and those admitted as inpatients in 24-hour health facilities (WIC Section 15610.23).", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[0], "REPORTING RESPONSIBILITIES AND TIME FRAMES", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "Any mandated reporter, who in his or her professional capacity, or within the scope of his or her employment, has observed or has knowledge of an incident that reasonably appears to be abuse or neglect, or is told by an elder or dependent adult that he or she has experienced behavior constituting abuse or neglect, or reasonably suspects that abuse or neglect occurred, shall complete form SOC 341, “Report of Suspected Dependent Adult/Elder Abuse” for each report of known or suspected instance of abuse (physical abuse, sexual abuse, financial abuse, abduction, neglect (self-neglect), isolation, and abandonment) involving an elder or dependent adult.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[0], "Reporting shall be completed as follows:", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[0], "• If the abuse occurred in a Long-Term Care (LTC) facility (as defined in WIC Section 15610.47) and resulted in serious bodily injury (as defined in WIC Section 15610.67), report by telephone to the local law enforcement agency immediately and no later than two (2) hours after observing, obtaining knowledge of, or suspecting physical abuse. Send the written report to the local law enforcement agency, the local Long-Term Care Ombudsman Program (LTCOP), and the appropriate licensing agency (for long-term health care facilities, the California Department of Public Health; for community care facilities, the California", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        
        // --- PAGE 2 ---
        y = pages[1].getHeight() - 70;
        y = drawWrappedText(pages[1], "Department of Social Services) within two (2) hours of observing, obtaining knowledge of, or suspecting physical abuse.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a LTC facility, was physical abuse, but did not result in serious bodily injury, report by telephone to the local law enforcement agency within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse. Send the written report to the local law enforcement agency, the local LTCOP, and the appropriate licensing agency (for long-term health care facilities, the California Department of Public Health; for community care facilities, the California Department of Social Services) within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a LTC facility, was physical abuse, did not result in serious bodily injury, and was perpetrated by a resident with a physician's diagnosis of dementia, report by telephone to the local law enforcement agency or the local LTCOP, immediately or as soon as practicably possible. Follow by sending the written report to the LTCOP or the local law enforcement agency within 24 hours of observing, obtaining knowledge of, or suspecting physical abuse.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a LTC facility, and was abuse other than physical abuse, report by telephone to the LTCOP or the law enforcement agency immediately or as soon as practicably possible. Follow by sending the written report to the local law enforcement agency or the LTCOP within two working days.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a state mental hospital or a state developmental center, mandated reporters shall report by telephone or through a confidential internet reporting tool (established in WIC Section 15658) immediately or as soon as practicably possible and submit the report within two (2) working days of making the telephone report to the responsible agency as identified below:", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a State Mental Hospital, report to the local law enforcement agency or the California Department of State Hospitals.", font, mainFontSize, leftMargin + 20, y, contentWidth - 20, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• If the abuse occurred in a State Developmental Center, report to the local law enforcement agency or to the California Department of Developmental Services.", font, mainFontSize, leftMargin + 20, y, contentWidth - 20, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "• For all other abuse, mandated reporters shall report by telephone or through a confidential internet reporting tool to the adult protective services agency or the local law enforcement agency immediately or as soon as practicably possible. If reported by telephone, a written or an Internet report shall be sent to adult protective services or law enforcement within two working days.", font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[1], "PENALTY FOR FAILURE TO REPORT ABUSE", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "Failure to report abuse of an elder or dependent adult is a MISDEMEANOR CRIME, punishable by jail time, fine or both (WIC Section 15630(h)). The reporting duties are individual, and no supervisor or administrator shall impede or inhibit the reporting duties, and no person making the report shall be subject to any sanction for making the report (WIC Section 15630(f)).", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[1], "CONFIDENTIALITY OF REPORTER AND OF ABUSE REPORTS", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[1], "The identity of all persons who report under WIC Chapter 11 shall be confidential and disclosed only.", font, mainFontSize, leftMargin, y, contentWidth, lineHeight);

        // --- PAGE 3 ---
        y = pages[2].getHeight() - 70;
        y = drawWrappedText(pages[2], "among APS agencies, local law enforcement agencies, LTCOPs, California State Attorney General Bureau of Medi-Cal Fraud and Elder Abuse, licensing agencies or their counsel, Department of Consumer Affairs Investigators (who investigate elder and dependent adult abuse), the county District Attorney, the Probate Court, and the Public Guardian. Confidentiality may be waived by the reporter or by court order. Any violation of confidentiality is a misdemeanor punishable by jail time, fine, or both (WIC Section 15633(a)).", font, mainFontSize, leftMargin, y, contentWidth, lineHeight); y-=lineHeight*2;
        y = drawWrappedText(pages[2], "DEFINITIONS OF ABUSE", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[2], "Physical abuse means any of the following: (a) Assault, as defined in Section 240 of the Penal Code; (b) Battery, as defined in Section 242 of the Penal Code; (c) Assault with a deadly weapon or force likely to produce great bodily injury, as defined in Section 245 of the Penal Code; (d) Unreasonable physical constraint, or prolonged or continual deprivation of food or water; (e) Sexual assault, that means any of the following: (1) Sexual battery, as defined in Section 243.4 of the Penal Code; (2) Rape, as defined in Section 261 of the Penal Code; (3) Rape in concert, as described in Section 264.1 of the Penal Code; (4) Spousal rape, as defined in Section 262 of the Penal Code; (5) Incest, as defined in Section 285 of the Penal Code; (6) Sodomy, as defined in Section 286 of the Penal Code; (7) Oral copulation, as defined in Section 288a of the Penal Code; (8) Sexual penetration, as defined in Section 289 of the Penal Code; or (9) Lewd or lascivious acts as defined in paragraph (2) of subdivision (b) of Section 288 of the Penal Code; or (f) Use of a physical or chemical restraint or psychotropic medication under any of the following conditions: (1) For punishment; (2) For a period beyond that for which the medication was ordered pursuant to the instructions of a physician and surgeon licensed in the State of California, who is providing medical care to the elder or dependent adult at the time the instructions are given; or (3) For any purpose not authorized by the physician and surgeon (WIC Section 15610.63).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[2], "Serious bodily injury means an injury involving extreme physical pain, substantial risk of death, or protracted loss or impairment of function of a bodily member, organ, or of mental faculty, or requiring medical intervention, including, but not limited to, hospitalization, surgery, or physical rehabilitation (WIC Section 15610.67).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[2], "Neglect (a) means either of the following: (1) The negligent failure of any person having the care or custody of an elder or a dependent adult to exercise that degree of care that a reasonable person in a like position would exercise; or (2) The negligent failure of an elder or dependent adult to exercise that degree of self care that a reasonable person in a like position would exercise. (b) Neglect includes, but is not limited to, all of the following: (1) Failure to assist in personal hygiene, or in the provision of food, clothing, or shelter; (2) Failure to provide medical care for physical and mental health needs. No person shall be deemed neglected or abused for the sole reason that he or she voluntarily relies on treatment by spiritual means through prayer alone in lieu of medical treatment; (3) Failure to protect from health and safety hazards; (4) Failure to prevent malnutrition or dehydration; or (5) Failure of an elder or dependent adult to satisfy the needs specified in paragraphs (1) to (4), inclusive, for himself or herself as a result of poor cognitive functioning, mental limitation, substance abuse, or chronic poor health (WIC Section 15610.57).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[2], "Financial abuse of an elder or dependent adult occurs when a person or entity does any of the following: (1) Takes, secretes, appropriates, obtains, or retains real or personal property of an elder or dependent adult for a wrongful use or with intent to defraud, or both; (2) Assists in taking, secreting, appropriating, obtaining, or retaining real or personal property of an elder or dependent adult for a wrongful use or with intent to defraud, or both; or (3)", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);

        // --- PAGE 4 ---
        y = pages[3].getHeight() - 70;
        y = drawWrappedText(pages[3], "Takes, secretes, appropriates, obtains, or retains real or personal property of an elder or dependent adult by undue influence, as defined in Section 15610.70 (WIC Section 15610.30).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[3], "Abandonment means the desertion or willful forsaking of an elder or a dependent adult by anyone having care or custody of that person under circumstances in which a reasonable person would continue to provide care and custody (WIC Section 15610.05).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[3], "Isolation means any of the following: (1) Acts intentionally committed for the purpose of preventing, and that do serve to prevent, an elder or dependent adult from receiving his or her mail or telephone calls; (2) Telling a caller or prospective visitor that an elder or dependent adult is not present, or does not wish to talk with the caller, or does not wish to meet with the visitor where the statement is false, is contrary to the express wishes of the elder or the dependent adult, whether he or she is competent or not, and is made for the purpose of preventing the elder or dependent adult from having contact with family, friends, or concerned persons; (3) False imprisonment, as defined in Section 236 of the Penal Code; or (4) Physical restraint of an elder or dependent adult, for the purpose of preventing the elder or dependent adult from meeting with visitors (WIC Section 15610.43).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight;
        y = drawWrappedText(pages[3], "Abduction means the removal from this state and the restraint from returning to this state, or the restraint from returning to this state, of any elder or dependent adult who does not have the capacity to consent to the removal from this state and the restraint from returning to this state, or the restraint from returning to this state, as well as the removal from this state or the restraint from returning to this state, of any conservatee without the consent of the conservator or the court (WIC Section 15610.06).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        y = drawWrappedText(pages[3], "AS AN EMPLOYEE OR VOLUNTEER OF THIS FACILITY, YOU MUST COMPLY WITH THE DEPENDENT ADULT AND ELDER ABUSE REQUIREMENTS, AS STATED ABOVE. IF YOU DO NOT COMPLY, YOU MAY BE SUBJECT TO CRIMINAL PENALTY. IF YOU ARE A LONG-TERM CARE OMBUDSMAN, YOU MUST COMPLY WITH FEDERAL AND STATE LAWS, WHICH PROHIBIT YOU FROM DISCLOSING THE IDENTITIES OF LONG-TERM RESIDENTS AND COMPLAINANTS TO ANYONE UNLESS CONSENT TO DISCLOSE IS PROVIDED BY THE RESIDENT OR COMPLAINANT OR DISCLOSURE IS REQUIRED BY COURT ORDER (Title 42 United States Code Section 3058g(d)(2); WIC Section 9725).", boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight); y -= lineHeight*2;
        
        const finalStatement = `I, ${formData.fullName || '[Your Name]'} have read and understand my responsibility to report known or suspected abuse of dependent adults or elders. I will comply with the reporting requirements.`;
        y = drawWrappedText(pages[3], finalStatement, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 30;

        if (formData.soc341aSignature) {
            await drawSignature(pages[3], formData.soc341aSignature, leftMargin + 80, y, 120, 24, pdfDoc);
        }
        pages[3].drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 250, y: y - 5 }, thickness: 0.5 });
        drawText(pages[3], "SIGNATURE", { x: leftMargin, y: y - 15, font, size: smallFontSize });

        const sigDate = (formData.soc341aSignatureDate && (formData.soc341aSignatureDate.toDate || isDate(formData.soc341aSignatureDate))) ? format(formData.soc341aSignatureDate.toDate ? formData.soc341aSignatureDate.toDate() : formData.soc341aSignatureDate, "MM/dd/yyyy") : '';
        if (sigDate) {
             drawText(pages[3], `DATE: ${sigDate}`, {x: leftMargin + 350, y: y+5, font, size: mainFontSize});
        }
        pages[3].drawLine({ start: { x: leftMargin + 340, y: y - 5 }, end: { x: leftMargin + 500, y: y - 5 }, thickness: 0.5 });


        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating SOC 341A PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
