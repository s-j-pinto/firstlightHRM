
'use server';

import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import { drawText } from './utils';

export async function generateEmergencyContactPdf(formData: any): Promise<{ pdfData?: string; error?: string }> {
    try {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage(PageSizes.Letter);
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
        const logoImageBytes = await fetch(logoUrl).then(res => res.arrayBuffer());
        const logoImage = await pdfDoc.embedPng(logoImageBytes);
        const logoDims = logoImage.scale(0.25);


        let y = height - 50;
        const leftMargin = 60;
        const contentWidth = width - (leftMargin * 2);
        
        page.drawImage(logoImage, {
            x: (width / 2) - (logoDims.width / 2),
            y: y,
            width: logoDims.width,
            height: logoDims.height,
        });
        y -= logoDims.height + 20;

        const title = "Caregiver Emergency Contact Numbers";
        drawText(page, title, {
            x: (width / 2) - (boldFont.widthOfTextAtSize(title, 16) / 2),
            y,
            font: boldFont,
            size: 16,
        });
        y -= 30;

        const boxStartY = y + 10;

        const drawSection = (title: string, data: { [key: string]: string | undefined }, isFirst: boolean = false, subTitle?: string) => {
            if (!isFirst) {
                page.drawLine({ start: { x: leftMargin, y: y + 10 }, end: { x: width - leftMargin, y: y + 10 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
                y -= 20;
            }
            
            const titleWidth = boldFont.widthOfTextAtSize(title, 12);
            drawText(page, title, {
                x: leftMargin,
                y,
                font: boldFont,
                size: 12,
            });

            if (subTitle) {
                const subTitleWidth = boldFont.widthOfTextAtSize(subTitle, 12);
                drawText(page, subTitle, {
                    x: leftMargin + titleWidth + (contentWidth - titleWidth - subTitleWidth)/2,
                    y,
                    font: boldFont,
                    size: 12,
                });
            }

            y -= 25;

            const drawField = (label: string, value: string | undefined) => {
                if (value) {
                    drawText(page, `${label}:`, { x: leftMargin + 20, y, font: boldFont, size: 11 });
                    drawText(page, value, { x: leftMargin + 150, y, font, size: 11 });
                    y -= 20;
                }
            };
            
            Object.entries(data).forEach(([label, value]) => drawField(label, value));
            y -= 10;
        };
        
        const yourInfo = {
            "Name": formData.fullName,
            "Phone/Cell": formData.phone,
            "Address": formData.address,
            "City/State/Zip": `${formData.city || ''}, ${formData.state || ''} ${formData.zip || ''}`,
        };
        drawSection("Your Information", yourInfo, true, "General Information");
        
        if (formData.emergencyContact1_name) {
            const firstPersonInfo = {
                "Name": formData.emergencyContact1_name,
                "Phone/Cell": formData.emergencyContact1_phone,
                "Address": formData.emergencyContact1_address,
                "City/State/Zip": formData.emergencyContact1_cityStateZip,
            };
            drawSection("In Case of Emergency please notify: (First Person)", firstPersonInfo);
        }

        if (formData.emergencyContact2_name) {
            const secondPersonInfo = {
                "Name": formData.emergencyContact2_name,
                "Phone/Cell": formData.emergencyContact2_phone,
                "Address": formData.emergencyContact2_address,
                "City/State/Zip": formData.emergencyContact2_cityStateZip,
            };
            drawSection("Second Person", secondPersonInfo);
        }

        const boxEndY = y;

        page.drawRectangle({
            x: leftMargin - 20,
            y: boxEndY - 20,
            width: contentWidth + 40,
            height: boxStartY - (boxEndY - 20),
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });

        drawText(page, "REV 02/03/17", { x: leftMargin, y: 30, font: font, size: 9 });

        const pdfBytes = await pdfDoc.save();
        return { pdfData: Buffer.from(pdfBytes).toString('base64') };

    } catch (error: any) {
        console.error("Error generating Emergency Contact PDF:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
