
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes, PDFPage } from 'pdf-lib';
import { format, isDate } from 'date-fns';
import { sanitizeText, drawText, drawCheckbox, drawSignature, drawWrappedText } from './utils';

export async function generateLic508Pdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const pages = [pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage(), pdfDoc.addPage()];
        
        const headerFooterFontSize = 7;

        const drawHeaderAndFooter = (page: any, pageNum: number) => {
            const { width, height } = page.getSize();
            const headerY = height - 30;
            const footerY = 30;
            const fontSize = headerFooterFontSize;

            drawText(page, "State of California - Health and Human Services Agency", { x: 50, y: headerY, font, size: fontSize });
            drawText(page, "California Department of Social Services", { x: width - font.widthOfTextAtSize("California Department of Social Services", fontSize) - 50, y: headerY, font, size: fontSize });

            drawText(page, "LIC 508 (7/21)", { x: 50, y: footerY, font, size: fontSize });
            const pageNumText = `Page ${pageNum} of 5`;
            drawText(page, pageNumText, { x: width - font.widthOfTextAtSize(pageNumText, fontSize) - 50, y: footerY, font, size: fontSize });
        };
        
        pages.forEach((page, index) => drawHeaderAndFooter(page, index + 1));
        
        // --- PAGE 1 ---
        let page = pages[0];
        let { width, height } = page.getSize();
        let y = height - 70;
        const leftMargin = 60;
        const rightMargin = width - 60;
        const contentWidth = rightMargin - leftMargin;

        const mainFontSize = 7.5;
        const titleFontSize = 11.5;
        const smallFontSize = 7;
        const lineHeight = 10;

        let title = "CRIMINAL RECORD STATEMENT";
        drawText(page, title, { x: (width / 2) - (boldFont.widthOfTextAtSize(title, titleFontSize) / 2), y, font: boldFont, size: titleFontSize });
        y -= 20;
        
        const p1_line1 = "State law requires that persons associated with licensed care facilities, Home Care Aide Registry or TrustLine Registry applicants be fingerprinted and disclose any conviction. A conviction is any plea of guilty or nolo contendere (no contest) or a verdict of guilty. The fingerprints will be used to obtain a copy of any criminal history you may have.";
        y = drawWrappedText(page, p1_line1, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 20;
        
        drawCheckbox(page, formData.convictedInCalifornia === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.convictedInCalifornia === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        drawText(page, 'Have you ever been convicted of a crime in California?', {x: leftMargin + 100, y: y + 1, font: boldFont, size: mainFontSize});
        y -= 15;
        
        const p1_line2 = "You do not need to disclose any marijuana-related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7.";
        y = drawWrappedText(page, p1_line2, font, smallFontSize, leftMargin, y, contentWidth, 11);
        y -= 20;

        drawCheckbox(page, formData.convictedOutOfState === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.convictedOutOfState === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        y = drawWrappedText(page, 'Have you ever been convicted of a crime from another state, federal court, military, or jurisdiction outside of U.S.?', boldFont, mainFontSize, leftMargin + 100, y, contentWidth - 100, lineHeight);
        y -= 15;
        
        const p1_line3 = "You do not need to disclose convictions that were a result of one's status as a victim of human trafficking and that were dismissed pursuant to Penal Code Section 1203.49, nor any marijuana related offenses covered by the marijuana reform legislation codified at Health and Safety Code sections 11361.5 and 11361.7. However you are required to disclose convictions that were dismissed pursuant to Penal Code Section 1203.4(a)";
        y = drawWrappedText(page, p1_line3, font, smallFontSize, leftMargin, y, contentWidth, 11);
        y -= 20;

        drawText(page, "Criminal convictions from another State or Federal court are considered the same as criminal convictions in California.", {x: leftMargin, y, font, size: smallFontSize, color: rgb(0.5, 0.5, 0.5)});
        y -= 20;
        
        const p1_childrens_text = "For Children's Residential Facilities, not including Foster Family Agency Staff, Youth Homelessness Prevention Centers, Private Alternative Boarding Schools, Private Alternative Outdoor Program, or Crisis Nurseries:";
        y = drawWrappedText(page, p1_childrens_text, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        drawCheckbox(page, formData.livedOutOfStateLast5Years === 'yes', leftMargin, y);
        drawText(page, 'Yes', {x: leftMargin + 15, y: y+1, font, size: mainFontSize});
        drawCheckbox(page, formData.livedOutOfStateLast5Years === 'no', leftMargin + 50, y);
        drawText(page, 'No', {x: leftMargin + 65, y: y+1, font, size: mainFontSize});
        y = drawWrappedText(page, 'Have you lived in a state other than California within the last five years?', boldFont, mainFontSize, leftMargin + 100, y, contentWidth-100, lineHeight);
        y -= 15;

        y = drawWrappedText(page, `If yes, list each state below and then complete an LIC 198B for each state: ${formData.outOfStateHistory || ''}`, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        
        y -= (lineHeight * 15);
        
        const p1_list_title = "You must check yes to the corresponding question(s) above to report every conviction (including reckless and drunk driving convictions), you have on your record even if:";
        y = drawWrappedText(page, p1_list_title, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        const p1_list_items = [
            "It happened a long time ago;",
            "It was only a misdemeanor;",
            "You didn’t have to go to court (your attorney went for you);",
            "You had no jail time, or the sentence was only a fine or probation;",
            "You received a certificate of rehabilitation; or",
            "The conviction was later dismissed, set aside or the sentence was suspended."
        ];
        p1_list_items.forEach(item => {
            y = drawWrappedText(page, `• ${item}`, font, mainFontSize, leftMargin + 10, y, contentWidth - 10, lineHeight);
        });

        // --- PAGE 2 ---
        page = pages[1];
        y = height - 70;
        
        const p2_note = "NOTE: IF THE CRIMINAL BACKGROUND CHECK REVEALS ANY CONVICTION(S) THAT YOU DID NOT REPORT ON THIS FORM BY CHECKING YES, YOUR FAILURE TO DISCLOSE THE CONVICTION(S) MAY RESULT IN AN EXEMPTION DENIAL, APPLICATION DENIAL, LICENSE REVOCATION, DECERTIFICATION, RESCISSION OF APPROVAL, OR EXCLUSION FROM A LICENSED FACILITY, CERTIFIED FAMILY HOME, OR THE HOME OF A RESOURCE FAMILY.";
        y = drawWrappedText(page, p2_note, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 3;

        const p2_move_note = "If you move or change your mailing address, you must send your updated information to the Caregiver Background Check Bureau within 10 days to:";
        y = drawWrappedText(page, p2_move_note, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 1.5;

        const addressBlock_p2 = "Caregiver Background Check Bureau\n744 P Street, M/S T9-15-62\nSacramento, CA 95814";
        drawText(page, addressBlock_p2, { x: leftMargin + 20, y: y, font: mainFontSize === 10 ? boldFont : font, size: mainFontSize, lineHeight: lineHeight});
        y -= (lineHeight * 5);
        
        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1 });
        y -= lineHeight * 2;
        
        const p2_certifyText = "I declare under penalty of perjury under the laws of the State of California that I have read and understand the information contained in this affidavit and that my responses and any accompanying attachments are true and correct.";
        y = drawWrappedText(page, p2_certifyText, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 5;

        const drawFieldBox_p2 = (label: string, value: string | undefined, x: number, yPos: number, boxWidth: number) => {
            drawText(page, label, {x, y: yPos + 12, font, size: smallFontSize});
            page.drawRectangle({x, y: yPos-12, width: boxWidth, height: 20, borderColor: rgb(0,0,0), borderWidth: 0.5});
            if(value) drawText(page, value, {x: x + 5, y: yPos-7, font, size: mainFontSize});
        };
        
        drawFieldBox_p2("FACILITY/ORGANIZATION/AGENCY NAME:", "FirstLight Home Care of Rancho Cucamonga", leftMargin, y + 12, 300);
        drawFieldBox_p2("FACILITY/ORGANIZATION/AGENCY NUMBER:", "364700059", leftMargin + 320, y + 12, contentWidth - 320);
        y -= lineHeight * 5.5;

        drawFieldBox_p2("YOUR NAME (print clearly):", formData.fullName, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 5.5;

        drawFieldBox_p2("Street Address:", formData.address, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 5.5;

        drawFieldBox_p2("City", formData.city, leftMargin, y + 12, 200);
        drawFieldBox_p2("State", formData.state, leftMargin + 220, y + 12, 100);
        drawFieldBox_p2("Zip Code", formData.zip, leftMargin + 340, y + 12, contentWidth - 340);
        y -= lineHeight * 5.5;

        drawFieldBox_p2("SOCIAL SECURITY NUMBER:", formData.ssn, leftMargin, y + 12, 200);
        drawFieldBox_p2("DRIVER’S LICENSE NUMBER/STATE:", formData.driversLicenseNumber, leftMargin + 220, y + 12, contentWidth - 220);
        y -= lineHeight * 5.5;

        const dobDateForField_p2 = (formData.dob && (formData.dob.toDate || isDate(formData.dob))) ? format(formData.dob.toDate ? formData.dob.toDate() : formData.dob, "MM/dd/yyyy") : '';
        drawFieldBox_p2("DATE OF BIRTH:", dobDateForField_p2, leftMargin, y + 12, contentWidth);
        y -= lineHeight * 6;

        if (formData.lic508Signature) await drawSignature(page, formData.lic508Signature, leftMargin + 5, y, 290, 20, pdfDoc);
        page.drawLine({ start: { x: leftMargin, y: y - 5 }, end: { x: leftMargin + 300, y: y - 5 }, color: rgb(0, 0, 0), thickness: 0.5 });
        drawText(page, "SIGNATURE:", { x: leftMargin, y: y - 15, font, size: smallFontSize });

        const sigDateForField_p2 = (formData.lic508SignatureDate && (formData.lic508SignatureDate.toDate || isDate(formData.lic508SignatureDate))) ? format(formData.lic508SignatureDate.toDate ? formData.lic508SignatureDate.toDate() : formData.lic508SignatureDate, "MM/dd/yyyy") : '';
        drawFieldBox_p2("DATE:", sigDateForField_p2, leftMargin + 320, y + 12, contentWidth - 320);
        y -= 40;

        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 1 });
        y -= 15;

        const instructionsLicensees_p2 = "Instructions to Licensees:";
        y = drawWrappedText(page, instructionsLicensees_p2, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        const p2_inst1 = "If the person discloses that they have ever been convicted of a crime, maintain this form in your facility/organization personnel file and send a copy to your Licensed Program Analyst (LPA) or assigned analyst.";
        y = drawWrappedText(page, p2_inst1, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= 15;

        const instructionsRegional_p2 = "Instructions to Regional Offices and Foster Family Agencies:";
        y = drawWrappedText(page, instructionsRegional_p2, boldFont, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        const p2_inst2 = "If ‘Yes’ is indicated in any box above, forward a copy of this completed form (and the LIC 198B, as applicable) to the Caregiver Background Check Bureau, 744 P Street, MS T9-15-62, Sacramento, CA 95814.";
        y = drawWrappedText(page, p2_inst2, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);
        y -= lineHeight * 2;
        const p2_inst3 = "If ‘No’ is indicated above in all boxes, keep this completed form in the facility file.";
        y = drawWrappedText(page, p2_inst3, font, mainFontSize, leftMargin, y, contentWidth, lineHeight);


        // --- PAGE 3 ---
        page = pages[2];
        y = height - 70;
        
        page.drawRectangle({x: leftMargin, y: y - 530, width: contentWidth, height: 550, borderColor: rgb(0,0,0), borderWidth: 1});
        
        drawText(page, "Privacy Notice", { x: (width / 2) - (boldFont.widthOfTextAtSize("Privacy Notice", titleFontSize) / 2), y, font: boldFont, size: titleFontSize }); y -= 15;
        drawText(page, "As Required by Civil Code § 1798.17", { x: (width / 2) - (font.widthOfTextAtSize("As Required by Civil Code § 1798.17", smallFontSize) / 2), y, font, size: smallFontSize }); y -= 25;

        const p3_content = [
            { text: "Collection and Use of Personal Information. The California Justice Information Services (CJIS) Division in the Department of Justice (DOJ) collects the information requested on this form as authorized by Penal Code sections 11100-11112; Health and Safety Code sections 1522, 1569.10-1569.24, 1596.80-1596.879; Family Code sections 8700-87200; Welfare and Institutions Code sections 16500-16523.1; and other various state statutes and regulations. The CJIS Division uses this information to process requests of authorized entities that want to obtain information as to the existence and content of a record of state or federal convictions to help determine suitability for employment, or volunteer work with children, elderly, or disabled; or for adoption or purposes of a license, certification, or permit. In addition, any personal information collected by state agencies is subject to the limitations in the Information Practices Act and state policy. The DOJ’s general privacy policy is available at http://oag.ca.gov/privacy-policy.", isBold: true },
            { text: "Providing Personal Information. All the personal information requested in the form must be provided. Failure to provide all the necessary information will result in delays and/or the rejection of your request. Notice is given for the request of the Social Security Number (SSN) on this form. The California Department of Justice uses a person’s SSN as an identifying number. The requested SSN is voluntary. Failure to provide the SSN may delay the processing of this form and the criminal record check.", isBold: true },
            { text: "Access to Your Information. You may review the records maintained by the CJIS Division in the DOJ that contain your personal information, as permitted by the Information Practices Act. See below for contact information.", isBold: true },
            { text: "Possible Disclosure of Personal Information. In order to be licensed, work at, or be present at, a licensed facility/organization, or be placed on a registry administered by the Department, the law requires that you complete a criminal background check. (Health and Safety Code sections 1522, 1568.09, 1569.17 and 1596.871). The Department will create a file concerning your criminal background check that will contain certain documents, including personal information that you provide. You have the right to access certain records containing your personal information maintained by the Department (Civil Code section 1798 et seq.). Under the California Public Records Act (Government Code section 6250 et seq.), the Department may have to provide copies of some of the records in the file to members of the public who ask for them, including newspaper and television reporters.", isBold: true },
            { text: "NOTE: IMPORTANT INFORMATION", isBold: true },
            { text: "The Department is required to tell people who ask, including the press, if someone in a licensed facility/ organization has a criminal record exemption. The Department must also tell people who ask the name of a licensed facility/organization that has a licensee, employee, resident, or other person with a criminal record exemption. This does not apply to Resource Family Homes, Small Family Child Care Homes, or the Home Care Aide Registry. The Department shall not release any information regarding Home Care Aides in response to a Public Records Act request, other than their Home Care Aide number.", isBold: false },
            { text: "The information you provide may also be disclosed in the following circumstances:", isBold: false },
            { text: "• With other persons or agencies where necessary to perform their legal duties, and their use of your information is compatible and complies with state law, such as for investigations or for licensing, certification, or regulatory purposes.", isBold: false },
            { text: "• To another government agency as required by state or federal law.", isBold: false },
        ];
        
        p3_content.forEach(item => {
            const currentFont = item.isBold ? boldFont : font;
            const indent = item.text.startsWith("•") ? 10 : 0;
            y = drawWrappedText(page, item.text, currentFont, mainFontSize, leftMargin + 5 + indent, y, contentWidth - 10 - indent, lineHeight);
        });


        // --- PAGE 4 ---
        page = pages[3];
        y = height - 70;
        
        page.drawRectangle({x: leftMargin, y: y - 500, width: contentWidth, height: 520, borderColor: rgb(0,0,0), borderWidth: 1});

        const p4_contact_info = "Contact Information";
        y = drawWrappedText(page, p4_contact_info, boldFont, mainFontSize, leftMargin + 5, y, contentWidth, lineHeight);
        const p4_content_1 = "For questions about this notice, CDSS programs, and the authorized use of your criminal history information, please contact your local licensing regional office.";
        y = drawWrappedText(page, p4_content_1, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        y -= 5;
        
        const p4_content_2 = "For further questions about this notice or your criminal records, you may contact the Associate Governmental Program Analyst at the DOJ’s Keeper of Records at (916) 210-3310, by email at keeperofrecords@doj.ca.gov, or by mail at:";
        y = drawWrappedText(page, p4_content_2, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        y -= 15;
        drawText(page, "Department of Justice\nBureau of Criminal Information & Analysis Keeper of Records\nP.O. Box 903417\nSacramento, CA 94203-4170", { x: leftMargin + 25, y: y, font: mainFontSize === 10 ? boldFont : font, size: mainFontSize, lineHeight: lineHeight});
        y -= (lineHeight * 5);
        
        const anrcTitle_p4 = "Applicant Notification and Record Challenge";
        drawText(page, anrcTitle_p4, { x: (width / 2) - (boldFont.widthOfTextAtSize(anrcTitle_p4, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight * 1.5;
        y = drawWrappedText(page, "Your fingerprints will be used to check the criminal history records of the FBI. You have the opportunity to complete or challenge the accuracy of the information contained in the FBI identification record. The procedure for obtaining a change, correction, or updating an FBI identification record are set forth in Title 28, CFR, 16.34. You can find additional information on the FBI website at https://www.fbi.gov/about-us/cjis/background-checks.", font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight); y -= 20;

        const fpasTitle_p4 = "Federal Privacy Act Statement";
        drawText(page, fpasTitle_p4, { x: (width / 2) - (boldFont.widthOfTextAtSize(fpasTitle_p4, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight * 1.5;
        
        const p4_authority_label = "Authority:";
        y = drawWrappedText(page, p4_authority_label, boldFont, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        const p4_authority = " The FBI’s acquisition, preservation, and exchange of fingerprints and associated information is generally authorized under 28 U.S.C. 534. Depending on the nature of your application, supplemental authorities include Federal statutes, State statutes pursuant to Pub. L. 92-544, Presidential Executive Orders, and federal regulations. Providing your fingerprints and associated information is voluntary; however, failure to do so may affect completion or approval of your application.";
        y = drawWrappedText(page, p4_authority, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight); y -= 15;
        
        const p4_principal_label = "Principal Purpose:";
        y = drawWrappedText(page, p4_principal_label, boldFont, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        const p4_principal = " Certain determinations, such as employment, licensing, and security clearances, may be predicated on fingerprint-based background checks. Your fingerprints and associated information/biometrics may be provided to the employing, investigating, or otherwise responsible agency, and/or the FBI for the purpose of comparing your fingerprints to other fingerprints in the FBI’s Next Generation Identification (NGI) system or its successor systems (including civil, criminal, and latent fingerprint repositories) or other available records of the employing, investigating, or otherwise responsible agency. The FBI may retain your fingerprints and associated information/biometrics in NGI after the completion of this application and, while retained, your fingerprints may continue to be compared against other fingerprints submitted to or retained by NGI.";
        y = drawWrappedText(page, p4_principal, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight); y -= 15;
        
        const p4_routine_label = "Routine Uses:";
        y = drawWrappedText(page, p4_routine_label, boldFont, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
        const p4_routine = " During the processing of this application and for as long thereafter as your fingerprints and associated information/biometrics are retained in NGI, your information may be disclosed pursuant to your consent, and may be disclosed without your consent as permitted by the Privacy Act of 1974 and all applicable Routine Uses as may be published at any time in the Federal Register, including the Routine Uses for the NGI system and the FBI’s Blanket Routine Uses. Routine uses include, but are not limited to, disclosures to:\n• employing, governmental or authorized non-governmental agencies responsible for employment, contracting, licensing, security clearances, and other suitability determinations;\n• local, state, tribal, or federal law enforcement agencies; criminal justice agencies; and agencies responsible for national security or public safety.";
        y = drawWrappedText(page, p4_routine, font, mainFontSize, leftMargin + 5, y, contentWidth-10, lineHeight); y-=20;
        
        const njarprTitle_p4 = "Noncriminal Justice Applicant’s Privacy Rights";
        drawText(page, njarprTitle_p4, { x: (width / 2) - (boldFont.widthOfTextAtSize(njarprTitle_p4, mainFontSize) / 2), y, font: boldFont, size: mainFontSize }); y -= lineHeight * 1.5;
        y = drawWrappedText(page, "As an applicant who is the subject of a national fingerprint-based criminal history record check for a noncriminal justice purpose (such as an application for employment or a license, an immigration or naturalization matter, security clearance, or adoption), you have certain rights which are discussed below.", font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);

        // --- PAGE 5 ---
        page = pages[4];
        y = height - 70;
        
        page.drawRectangle({x: leftMargin, y: y - 350, width: contentWidth, height: 370, borderColor: rgb(0,0,0), borderWidth: 1});

        
        const page5_items = [
            "You must be provided written notification(1) that your fingerprints will be used to check the criminal history records of the FBI.",
            "You must be provided, and acknowledge receipt of, an adequate Privacy Act Statement when you submit your fingerprints and associated personal information. This Privacy Act Statement should explain the authority for collecting your information and how your information will be used, retained, and shared. (2)",
            "If you have a criminal history record, the officials making a determination of your suitability for the employment, license, or other benefit must provide you the opportunity to complete or challenge the accuracy of the information in the record.",
            "The officials must advise you that the procedures for obtaining a change, correction, or update of your criminal history record are set forth at Title 28, Code of Federal Regulations (CFR), Section 16.34.",
            "If you have a criminal history record, you should be afforded a reasonable amount of time to correct or complete the record (or decline to do so) before the officials deny you the employment, license, or other benefit based on information in the criminal history record. (3)",
            "You have the right to expect that officials receiving the results of the criminal history record check will use it only for authorized purposes and will not retain or disseminate it in violation of federal statute, regulation or executive order, or rule, procedure or standard established by the National Crime Prevention and Privacy Compact Council. (4)"
        ];
        
        page5_items.forEach(item => {
            y = drawWrappedText(page, `• ${item}`, font, mainFontSize, leftMargin + 15, y, contentWidth - 30, lineHeight);
        });

        const p5_text = [
            "If agency policy permits, the officials may provide you with a copy of your FBI criminal history record for review and possible challenge. If agency policy does not permit it to provide you a copy of the record, you may obtain a copy of the record by submitting fingerprints and a fee to the FBI. Information regarding this process may be obtained at https://www.fbi.gov/services/cjis/identity-history-summary-checks.",
            "If you decide to challenge the accuracy or completeness of your FBI criminal history record, you should send your challenge to the agency that contributed the questioned information to the FBI. Alternatively, you may send your challenge directly to the FBI. The FBI will then forward your challenge to the agency that contributed the questioned information and request the agency to verify or correct the challenged entry. Upon receipt of an official communication from that agency, the FBI will make any necessary changes/corrections to your record in accordance with the information supplied by that agency. (See 28 CFR 16.30 through 16.34.) You can find additional information on the FBI website at https://www.fbi.gov/about-us/cjis/background-checks."
        ];

        p5_text.forEach(text => {
            y = drawWrappedText(page, text, font, mainFontSize, leftMargin + 5, y, contentWidth - 10, lineHeight);
            y -= 15;
        });

        page.drawLine({ start: { x: leftMargin, y: y }, end: { x: rightMargin, y: y }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) }); y-= 15;
        
        const footnotes = [
            "(1) Written notification includes electronic notification, but excludes oral notification.",
            "(2) https://www.fbi.gov/services/cjis/compact-council/privacy-act-statement",
            "(3) See 28 CFR 50.12(b)",
            "(4) See U.S.C. 552a(b); 28 U.S.C. 534(b); 34 U.S.C. § 40316 (formerly cited as 42 U.S.C. § 14616), Article IV(c)"
        ];
        footnotes.forEach(note => {
             y = drawWrappedText(page, note, font, smallFontSize, leftMargin, y, contentWidth, 11);
        });
        
        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };
    } catch (error: any) {
        console.error("Error generating LIC 508 PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
