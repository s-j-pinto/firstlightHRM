

"use server";

import { revalidatePath } from 'next/cache';
import { serverDb, serverAuth } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { sendHomeVisitInvite } from './google-calendar.actions';

const initialContactSchema = z.object({
  clientName: z.string().min(1, "Client's Name is required."),
  clientAddress: z.string().min(1, "Client's Address is required."),
  dateOfBirth: z.date().optional(),
  rateOffered: z.coerce.number().optional(),
  city: z.string().min(1, "City is required."),
  zip: z.string().min(1, "Zip code is required."),
  clientPhone: z.string().min(1, "Client's Phone is required."),
  clientEmail: z.string().email("A valid email is required."),
  mainContact: z.string().min(1, "Main Contact is required."),
  allergies: z.string().optional(),
  pets: z.string().optional(),
  dateOfHomeVisit: z.date().optional(),
  timeOfVisit: z.string().optional(),
  referredBy: z.string().optional(),
  promptedCall: z.string().min(1, "This field is required."),
  estimatedHours: z.string().optional(),
  estimatedStartDate: z.date().optional(),
  inHomeVisitSet: z.enum(["Yes", "No"]).optional(),
  inHomeVisitSetNoReason: z.string().optional(),
  medicalIns: z.string().optional(),
  dnr: z.boolean().optional(),
  va: z.string().optional(),
  hasPoa: z.enum(["Yes", "No"]).optional(),
  ltci: z.string().optional(),
  advanceDirective: z.boolean().optional(),
  contactPhone: z.string().min(1, "Contact Phone is required."),
  languagePreference: z.string().optional(),
  additionalEmail: z.string().email("Please enter a valid email.").optional().or(z.literal('')),
  createdAt: z.any().optional(),
  createdBy: z.string().optional(),
  companionCare_mealPreparation: z.boolean().optional(),
  companionCare_cleanKitchen: z.boolean().optional(),
  companionCare_assistWithLaundry: z.boolean().optional(),
  companionCare_dustFurniture: z.boolean().optional(),
  companionCare_assistWithEating: z.boolean().optional(),
  companionCare_provideAlzheimersRedirection: z.boolean().optional(),
  companionCare_assistWithHomeManagement: z.boolean().optional(),
  companionCare_preparationForBathing: z.boolean().optional(),
  companionCare_groceryShopping: z.boolean().optional(),
  companionCare_cleanBathrooms: z.boolean().optional(),
  companionCare_changeBedLinens: z.boolean().optional(),
  companionCare_runErrands: z.boolean().optional(),
  companionCare_escortAndTransportation: z.boolean().optional(),
  companionCare_provideRemindersAndAssistWithToileting: z.boolean().optional(),
  companionCare_provideRespiteCare: z.boolean().optional(),
  companionCare_stimulateMentalAwareness: z.boolean().optional(),
  companionCare_assistWithDressingAndGrooming: z.boolean().optional(),
  companionCare_assistWithShavingAndOralCare: z.boolean().optional(),
  companionCare_other: z.string().optional(),
  personalCare_provideAlzheimersCare: z.boolean().optional(),
  personalCare_provideMedicationReminders: z.boolean().optional(),
  personalCare_assistWithDressingGrooming: z.boolean().optional(),
  personalCare_assistWithBathingHairCare: z.boolean().optional(),
  personalCare_assistWithFeedingSpecialDiets: z.boolean().optional(),
  personalCare_assistWithMobilityAmbulationTransfer: z.boolean().optional(),
  personalCare_assistWithIncontinenceCare: z.boolean().optional(),
  personalCare_assistWithOther: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.inHomeVisitSet === "Yes") {
        if (!data.dateOfHomeVisit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Date of Home Visit is required when a visit is set.",
                path: ["dateOfHomeVisit"],
            });
        }
        if (!data.timeOfVisit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Time of Visit is required when a visit is set.",
                path: ["timeOfVisit"],
            });
        }
    }
});

interface SubmitPayload {
    contactId: string | null;
    formData: z.infer<typeof initialContactSchema>;
}

export async function submitInitialContact(payload: SubmitPayload) {
    const { contactId, formData } = payload;
    
    const validation = initialContactSchema.safeParse(formData);
    if (!validation.success) {
        console.error("Server-side validation failed:", validation.error.flatten());
        return { message: "Invalid data provided.", error: true, docId: contactId };
    }

    const firestore = serverDb;
    const now = Timestamp.now();
    let userEmail = 'unknown';

    try {
        const sessionCookie = cookies().get("__session")?.value;
        if (sessionCookie) {
            const decodedToken = await serverAuth.verifySessionCookie(sessionCookie);
            userEmail = decodedToken.email || 'unknown';
        }
    } catch (e) {
        console.warn('Could not get user from session cookie for createdBy field.');
    }

    const dataToSave = {
        ...validation.data,
        status: "INITIAL PHONE CONTACT COMPLETED",
        lastUpdatedAt: now,
    };
    
    try {
        let docId = contactId;
        if (docId) {
            // Update existing document
            const contactRef = firestore.collection('initial_contacts').doc(docId);
            await contactRef.update({
                ...dataToSave,
            });
        } else {
            // Create a new document
            const contactRef = await firestore.collection('initial_contacts').add({
                ...dataToSave,
                createdBy: userEmail,
                createdAt: now,
            });
            docId = contactRef.id;
        }

        // Check if we need to send a calendar invite
        if (dataToSave.inHomeVisitSet === "Yes" && dataToSave.dateOfHomeVisit && dataToSave.timeOfVisit) {
            const calendarResult = await sendHomeVisitInvite({
                clientName: dataToSave.clientName,
                clientAddress: dataToSave.clientAddress,
                clientEmail: dataToSave.clientEmail,
                additionalEmail: dataToSave.additionalEmail,
                dateOfHomeVisit: dataToSave.dateOfHomeVisit,
                timeOfVisit: dataToSave.timeOfVisit,
            });
            
            if (calendarResult.error) {
                console.error("Failed to send calendar invite:", calendarResult.message);
                return { 
                    message: `Contact saved, but calendar invite failed: ${calendarResult.message}`, 
                    error: true, 
                    docId: docId,
                    authUrl: calendarResult.authUrl 
                };
            }
            console.log("Calendar invite sent successfully.");
        }
        
        revalidatePath('/admin/assessments');
        revalidatePath('/owner/dashboard');
        return { message: "Initial contact saved successfully.", docId: docId };

    } catch (error: any) {
        console.error("Error saving initial contact:", error);
        return { message: `An error occurred: ${error.message}`, error: true, docId: contactId };
    }
}
