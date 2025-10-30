

"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const clientSignupSchema = z.object({
  signupId: z.string().nullable(),
  clientEmail: z.string().email(),
  formData: z.any(),
  status: z.enum(["INCOMPLETE", "PENDING CLIENT SIGNATURES"]),
});

export async function saveClientSignupForm(payload: z.infer<typeof clientSignupSchema>) {
  const validation = clientSignupSchema.safeParse(payload);

  if (!validation.success) {
    return { message: "Invalid data provided for client signup form.", error: true };
  }

  const { signupId, clientEmail, formData, status } = validation.data;
  const firestore = serverDb;

  try {
    let docRef;
    if (signupId) {
        docRef = firestore.collection('client_signups').doc(signupId);
        await docRef.update({
            clientEmail,
            formData,
            status,
            lastUpdatedAt: Timestamp.now(),
        });
    } else {
         docRef = await firestore.collection('client_signups').add({
            clientEmail,
            formData,
            status,
            createdAt: Timestamp.now(),
            lastUpdatedAt: Timestamp.now(),
        });
    }

    revalidatePath('/owner/dashboard');

    if (status === 'INCOMPLETE') {
      return { message: "Draft of the client intake form has been saved.", signupId: docRef.id };
    } else {
      const signingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/client-sign/${docRef.id}`;
      
      const email = {
        to: [clientEmail],
        message: {
          subject: "Action Required: Please Sign Your FirstLight Home Care Agreement",
          html: `
            <body style="font-family: sans-serif; line-height: 1.6;">
              <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h1 style="color: #333;">Complete Your Onboarding</h1>
                <p>Hello,</p>
                <p>Thank you for choosing FirstLight Home Care. To finalize your service agreement, please review and sign the intake form by clicking the button below.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${signingLink}" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
                    Review and Sign Document
                  </a>
                </div>
                <p>If you have any questions, please don't hesitate to contact our office.</p>
                <p>Thank you,<br/>The FirstLight Home Care Team</p>
              </div>
            </body>
          `,
        },
      };

      await firestore.collection("mail").add(email);

      return { message: "The form has been saved and a signature link has been sent to the client.", signupId: docRef.id };
    }
  } catch (error: any) {
    console.error("Error saving client signup form:", error);
    return { message: `An error occurred: ${error.message}`, error: true };
  }
}

export async function submitClientSignature(payload: { signupId: string; signature: string; initials: string; date: string; }) {
    const { signupId, signature, initials, date } = payload;
    const firestore = serverDb;

    try {
        const signupRef = firestore.collection('client_signups').doc(signupId);
        
        // Here you would also generate and save the PDF to Cloud Storage
        // For now, we'll just update the status and signature data

        await signupRef.update({
            'formData.clientSignature': signature,
            'formData.clientInitials': initials,
            'formData.clientSignatureDate': date,
            status: 'SIGNED AND PUBLISHED',
            lastUpdatedAt: Timestamp.now(),
        });
        
        revalidatePath(`/client-sign/${signupId}`);
        revalidatePath('/owner/dashboard');
        
        return { message: "Thank you! Your document has been signed and submitted." };

    } catch (error: any) {
        console.error("Error submitting client signature:", error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}
