
"use server";

import { serverDb } from '@/firebase/server-init';
import { format, isValid } from 'date-fns';

interface PotentialShiftPayload {
    caregiver: {
        name: string;
        email: string;
    };
    client: {
        id: string; // contactId
        name: string;
        city?: string;
        estimatedHours?: string;
        estimatedStartDate?: Date;
        promptedCall?: string;
        pets?: string;
        levelOfCareData: any;
        careNeedsData: any;
    };
}

function getClientInitials(name: string): string {
    if (!name) return 'N/A';
    const parts = name.split(' ');
    if (parts.length > 1) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function determineLevelOfCare(locData: any): string {
    if (!locData) return "Not Assessed";
    if (Object.keys(locData).some(k => k.startsWith('level_4_') && locData[k])) return "Level 4";
    if (Object.keys(locData).some(k => k.startsWith('level_3_') && locData[k])) return "Level 3";
    if (Object.keys(locData).some(k => k.startsWith('level_2_') && locData[k])) return "Level 2";
    if (Object.keys(locData).some(k => k.startsWith('level_1_') && locData[k])) return "Level 1";
    if (Object.keys(locData).some(k => k.startsWith('level_0_') && locData[k])) return "Level 0";
    return "Not Assessed";
}

function getTasksList(careNeeds: any): string {
    if (!careNeeds) return "<li>Details not provided.</li>";

    const taskMap: { [key: string]: string } = {
        companionCare_mealPreparation: 'Meal preparation and clean up',
        companionCare_cleanKitchen: 'Clean kitchen',
        companionCare_assistWithLaundry: 'Assist with laundry',
        companionCare_dustFurniture: 'Dust furniture',
        companionCare_assistWithEating: 'Assist with eating',
        companionCare_provideAlzheimersRedirection: "Alzheimer's redirection",
        companionCare_assistWithHomeManagement: 'Assist with home management',
        companionCare_preparationForBathing: 'Preparation for bathing',
        companionCare_groceryShopping: 'Grocery shopping',
        companionCare_cleanBathrooms: 'Clean bathrooms',
        companionCare_changeBedLinens: 'Change bed linens',
        companionCare_runErrands: 'Run errands',
        companionCare_escortAndTransportation: 'Escort and transportation',
        companionCare_provideRemindersAndAssistWithToileting: 'Toileting reminders',
        companionCare_provideRespiteCare: 'Provide respite care',
        companionCare_stimulateMentalAwareness: 'Stimulate mental awareness',
        companionCare_assistWithDressingAndGrooming: 'Dressing and grooming',
        companionCare_assistWithShavingAndOralCare: 'Shaving and oral care',
        personalCare_provideAlzheimersCare: "Alzheimer's care, cognitive impairment",
        personalCare_provideMedicationReminders: 'Medication reminders',
        personalCare_assistWithDressingGrooming: 'Assist with dressing, grooming',
        personalCare_assistWithBathingHairCare: 'Assist with bathing, hair care',
        personalCare_assistWithFeedingSpecialDiets: 'Assist with feeding, special diets',
        personalCare_assistWithMobilityAmbulationTransfer: 'Assist with mobility, ambulation and transfer',
        personalCare_assistWithIncontinenceCare: 'Assist with incontinence care',
    };

    const tasks = Object.keys(careNeeds)
        .filter(key => (key.startsWith('companionCare_') || key.startsWith('personalCare_')) && careNeeds[key] === true && taskMap[key])
        .map(key => `<li>${taskMap[key]}</li>`);

    return tasks.length > 0 ? `<ul>${tasks.join('')}</ul>` : "<li>No specific tasks selected.</li>";
}

export async function sendPotentialShiftEmail(payload: PotentialShiftPayload) {
    const { caregiver, client } = payload;

    if (!caregiver.email) {
        return { error: 'Caregiver email is missing.' };
    }

    const clientInitials = getClientInitials(client.name);
    const estimatedStartDate = client.estimatedStartDate && isValid(new Date(client.estimatedStartDate)) ? format(new Date(client.estimatedStartDate), 'MM/dd/yyyy') : "Not specified";
    const levelOfCare = determineLevelOfCare(client.levelOfCareData);
    const tasksList = getTasksList(client.careNeedsData);
    
    // Admin emails
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'lpinto@firstlighthomecare.com';
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";

    const emailHtml = `
        <body style="font-family: sans-serif; line-height: 1.6;">
            <p>${caregiver.name},</p>
            <p>Please review the potential shift details below and confirm or deny with the FLHC Office.</p>
            <br>
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">Shift Details</h3>
            <ul>
                <li><strong>Client Initials:</strong> ${clientInitials}</li>
                <li><strong>Estimated Start Date:</strong> ${estimatedStartDate}</li>
                <li><strong>Total Weekly Hours:</strong> ${client.estimatedHours || 'Not specified'}</li>
                <li><strong>Client Location:</strong> ${client.city || 'Not specified'}</li>
            </ul>
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">Level of Care & Client Profile</h3>
            <ul>
                <li><strong>Required Level of Care:</strong> ${levelOfCare}</li>
                <li><strong>Client Profile:</strong> ${client.promptedCall || 'Not specified'}</li>
            </ul>
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">Home Environment Details</h3>
            <ul>
                <li><strong>Pets in home:</strong> ${client.pets || 'None specified'}</li>
            </ul>
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">Tasks & Responsibilities</h3>
            ${tasksList}
            <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">Pay & Compensation</h3>
            <p>Please contact the Office below to discuss the hourly rate, overtime eligibility, and mileage reimbursement for this position.</p>
            <br>
            <p>--<br> Silvia <br> Care Coordinator<br> Office (909)-321-4466<br> Fax (909)-694-2474</p> <p>CALIFORNIA HCO LICENSE # 364700059</p> <p>9650 Business Center Drive, Suite #132 | Rancho Cucamonga, CA 91730</p> <p><a href="mailto:care-rc@firstlighthomecare.com">care-rc@firstlighthomecare.com</a><br> <a href="http://ranchocucamonga.firstlighthomecare.com">ranchocucamonga.firstlighthomecare.com</a></p> <p><a href="https://www.facebook.com/FirstLightHomeCareofRanchoCucamonga">https://www.facebook.com/FirstLightHomeCareofRanchoCucamonga</a></p> <br> <img src="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc" alt="FirstLight Home Care Logo" style="width: 200px; height: auto;"/> <br> <p><small><strong>CONFIDENTIALITY NOTICE</strong><br> This email, including any attachments or files transmitted with it, is intended to be confidential and solely for the use of the individual or entity to whom it is addressed. If you received it in error, or if you are not the intended recipient(s), please notify the sender by reply e-mail and delete/destroy the original message and any attachments, and any copies. Any unauthorized review, use, disclosure or distribution of this e-mail or information is prohibited and may be a violation of applicable laws.</small></p>
        </body>
    `;

    const emailToSend = {
        to: [caregiver.email],
        cc: [staffingAdminEmail, ownerEmail],
        message: {
            subject: `Potential FirstLight Homecare Shift for Client ${clientInitials}, in City ${client.city || ''} for ${client.estimatedHours || ''} weekly hours.`,
            html: emailHtml,
        },
    };

    try {
        await serverDb.collection("mail").add(emailToSend);
        return { success: true, message: `Shift email sent to ${caregiver.name}.` };
    } catch (error: any) {
        console.error("Error sending potential shift email:", error);
        return { error: `Failed to send email: ${error.message}` };
    }
}
