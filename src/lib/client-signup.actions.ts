
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const clientSignupSchema = z.object({
  clientEmail: z.string().email(),
  formData: z.any(),
  status: z.enum(["INCOMPLETE", "PENDING CLIENT SIGNATURES"]),
});

export async function saveClientSignupForm(payload: z.infer<typeof clientSignupSchema>) {
  const validation = clientSignupSchema.safeParse(payload);

  if (!validation.success) {
    return { message: "Invalid data provided for client signup form.", error: true };
  }

  const { clientEmail, formData, status } = validation.data;
  const firestore = serverDb;

  try {
    const signupData = {
      clientEmail,
      formData,
      status,
      lastUpdatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    };

    // For simplicity in this step, we'll create a new document each time.
    // A full implementation would check for an existing draft to update.
    await firestore.collection('client_signups').add(signupData);

    revalidatePath('/owner/dashboard'); // Assuming there will be a list there

    if (status === 'INCOMPLETE') {
      return { message: "Draft of the client intake form has been saved." };
    } else {
      // Placeholder for email logic
      console.log(`[Action] Pretending to send signature link to: ${clientEmail}`);
      return { message: "The form has been saved and a signature link has been sent to the client." };
    }
  } catch (error: any) {
    console.error("Error saving client signup form:", error);
    return { message: `An error occurred: ${error.message}`, error: true };
  }
}
