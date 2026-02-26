

"use server";

import { revalidatePath } from 'next/cache';
import { serverDb, serverAuth } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { sendHomeVisitInvite } from './google-calendar.actions';
import { sendSms } from './services/telnyx';

const initialContactSchema = z.object({
  clientName: z.string().min(1, "Client's Name is required."),
  source: z.string().min(1, "Source is required."),
  clientAddress: z.string().min(1, "Client's Address is required."),
  dateOfBirth: z.date().optional(),
  rateOffered: z.coerce.number().nonnegative("Rate cannot be negative").optional(),
  milageOffered: z.coerce.number().nonnegative("Mileage cannot be negative").optional(),
  clientDepositAmount: z.coerce.number().optional(),
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
  referralCode: z.string().optional(),
  promptedCall: z.string().min(1, "This field is required."),
  estimatedHours: z.string().optional(),
  estimatedStartDate: z.date().optional(),
  inHomeVisitSet: z.enum(["Yes", "No"]).optional(),
  inHomeVisitSetNoReason: z.string().optional(),
  sendFollowUpCampaigns: z.boolean().optional(),
  medicalIns: z.string().optional(),
  dnr: z.boolean().optional(),
  va: z.string().optional(),
  hasPoa: z.enum(["Yes", "No"]).optional(),
  ltci: z.string().optional(),
  contactPhone: z.string().min(1, "Contact Phone is required."),
  languagePreference: z.string().optional(),
  additionalEmail: z.string().email("Please enter a valid email.").optional().or(z.literal('')),
  createdAt: z.any().optional(),
  createdBy: z.string().optional(),
  clientIsBedridden: z.enum(["Yes", "No"]).optional(),
  clientUsesHoyerLift: z.enum(["Yes", "No"]).optional(),
  smokingEnvironment: z.enum(["Yes", "No"]).optional(),
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

export interface SubmitPayload {
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

    let status = "New";
    if (validation.data.inHomeVisitSet === "Yes") {
        status = "In-Home Visit Scheduled";
    }

    const { createdAt, ...restOfData } = validation.data;

    const dataToSave: { [key: string]: any } = {
        ...restOfData,
        status: status,
        lastUpdatedAt: now,
    };
    
    if (dataToSave.clientEmail) {
        dataToSave.clientEmail = dataToSave.clientEmail.trim().toLowerCase();
    }
    if (dataToSave.additionalEmail) {
        dataToSave.additionalEmail = dataToSave.additionalEmail.trim().toLowerCase();
    }

    try {
        let docId = contactId;
        const contactRef = docId ? firestore.collection('initial_contacts').doc(docId) : firestore.collection('initial_contacts').doc();
        if (!docId) {
            docId = contactRef.id;
        }
        
        const existingDoc = await contactRef.get();
        const existingData = existingDoc.data();

        if (existingDoc.exists) {
            await contactRef.update({ ...dataToSave });
        } else {
            await contactRef.set({
                ...dataToSave,
                createdBy: userEmail,
                createdAt: now,
            });
        }

        if (dataToSave.referralCode && dataToSave.source === "App Referral") {
            const referralQuery = await firestore.collection('referrals').where('newClientInitialContactId', '==', docId).get();
            if (referralQuery.empty) {
                const referralProfileQuery = await firestore.collection('referral_profiles').where('referralCode', '==', dataToSave.referralCode).limit(1).get();
                if (!referralProfileQuery.empty) {
                    const referrerProfile = referralProfileQuery.docs[0].data();
                    await firestore.collection('referrals').add({
                        referrerClientId: referrerProfile.clientId,
                        referralCodeUsed: dataToSave.referralCode,
                        newClientInitialContactId: docId,
                        newClientName: dataToSave.clientName,
                        status: 'Pending',
                        createdAt: now,
                    });
                }
            }
        }
        
        const oldVisitDate = existingData?.dateOfHomeVisit?.toDate();
        const oldVisitTime = existingData?.timeOfVisit;
        const newVisitDate = dataToSave.dateOfHomeVisit;
        const newVisitTime = dataToSave.timeOfVisit;
        
        const hasDateChanged = oldVisitDate?.getTime() !== newVisitDate?.getTime();
        const hasTimeChanged = oldVisitTime !== newVisitTime;
        const shouldSendInvite = dataToSave.inHomeVisitSet === "Yes" && newVisitDate && newVisitTime && (hasDateChanged || hasTimeChanged);

        if (shouldSendInvite) {
            const calendarResult = await sendHomeVisitInvite({
                clientName: dataToSave.clientName,
                clientAddress: dataToSave.clientAddress,
                clientEmail: dataToSave.clientEmail,
                additionalEmail: dataToSave.additionalEmail,
                dateOfHomeVisit: newVisitDate,
                timeOfVisit: newVisitTime,
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
            console.log("Calendar invite sent successfully because home visit details changed.");
        }
        
        revalidatePath('/admin/assessments');
        revalidatePath('/owner/dashboard');
        return { message: "Initial contact saved successfully.", docId: docId };

    } catch (error: any) {
        console.error("Error saving initial contact:", error);
        return { message: `An error occurred: ${error.message}`, error: true, docId: contactId };
    }
}


export async function closeInitialContact(contactId: string, closureReason: string) {
  if (!contactId || !closureReason) {
    return { error: true, message: "Contact ID and closure reason are required." };
  }

  const firestore = serverDb;
  const now = Timestamp.now();

  try {
    const contactRef = firestore.collection("initial_contacts").doc(contactId);

    const signupQuery = firestore.collection("client_signups").where("initialContactId", "==", contactId).limit(1);
    const signupSnapshot = await signupQuery.get();
    
    await firestore.runTransaction(async (transaction) => {
      transaction.update(contactRef, {
        status: "Closed",
        closureReason: closureReason,
        lastUpdatedAt: now,
        sendFollowUpCampaigns: false,
      });

      if (!signupSnapshot.empty) {
        const signupDocRef = signupSnapshot.docs[0].ref;
        transaction.update(signupDocRef, {
          status: "Archived",
          lastUpdatedAt: now,
        });
      }
    });

    revalidatePath("/admin/assessments");
    revalidatePath("/owner/dashboard");

    return { success: true, message: "Contact has been closed and the associated CSA has been archived." };

  } catch (error: any) {
    console.error("Error closing initial contact:", error);
    return { error: true, message: `An error occurred: ${error.message}` };
  }
}

export async function sendManualSms(contactId: string, message: string) {
    if (!contactId || !message) {
        return { error: "Contact ID and message are required." };
    }

    try {
        const contactDoc = await serverDb.collection('initial_contacts').doc(contactId).get();
        if (!contactDoc.exists) {
            return { error: "Contact not found." };
        }
        const clientPhone = contactDoc.data()?.clientPhone;
        if (!clientPhone) {
            return { error: "Contact does not have a phone number." };
        }

        const result = await sendSms(clientPhone, message, contactId);

        if (result.success) {
            revalidatePath(`/admin/initial-contact?contactId=${contactId}`);
            revalidatePath(`/owner/initial-contact?contactId=${contactId}`);
            return { message: "SMS sent successfully." };
        } else {
            return { error: result.message };
        }
    } catch (error: any) {
        return { error: `Failed to send SMS: ${error.message}` };
    }
}

    