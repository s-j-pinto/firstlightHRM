

"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const initialContactSchema = z.object({
  clientName: z.string().min(1, "Client's Name is required."),
  clientAddress: z.string().min(1, "Client's Address is required."),
  dateOfBirth: z.date().optional(),
  rateOffered: z.coerce.number().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  clientPhone: z.string().min(1, "Client's Phone is required."),
  clientEmail: z.string().email("A valid email is required."),
  mainContact: z.string().optional(),
  allergies: z.string().optional(),
  pets: z.string().optional(),
  dateOfHomeVisit: z.date().optional(),
  timeOfVisit: z.string().optional(),
  referredBy: z.string().optional(),
  promptedCall: z.string().min(1, "This field is required."),
  companionCareNotes: z.string().optional(),
  personalCareNotes: z.string().optional(),
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
  contactPhone: z.string().optional(),
  languagePreference: z.string().optional(),
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
        return { message: "Invalid data provided.", error: true };
    }

    const firestore = serverDb;
    const now = Timestamp.now();

    const dataToSave = {
        ...validation.data,
        status: "INITIAL PHONE CONTACT COMPLETED",
        lastUpdatedAt: now,
    };
    
    try {
        if (contactId) {
            // Update existing document
            const contactRef = firestore.collection('initial_contacts').doc(contactId);
            await contactRef.update(dataToSave);
        } else {
            // Create a new client_signup document as well to show on the dashboard
            const signupRef = firestore.collection('client_signups').doc();
            await signupRef.set({
                formData: {
                    clientName: validation.data.clientName,
                    clientPhone: validation.data.clientPhone,
                    clientEmail: validation.data.clientEmail,
                    clientAddress: validation.data.clientAddress,
                    dateOfBirth: validation.data.dateOfBirth,
                    rateOffered: validation.data.rateOffered,
                    city: validation.data.city,
                    zip: validation.data.zip,
                },
                clientEmail: validation.data.clientEmail,
                clientPhone: validation.data.clientPhone,
                status: 'INITIAL PHONE CONTACT COMPLETED',
                createdAt: now,
                lastUpdatedAt: now,
            });
        }
        
        revalidatePath('/admin/assessments');
        revalidatePath('/owner/dashboard');
        return { message: "Initial contact saved successfully." };

    } catch (error: any) {
        console.error("Error saving initial contact:", error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}

    