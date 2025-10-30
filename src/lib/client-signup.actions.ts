

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
  // This server action is now deprecated as writes are handled on the client.
  // It can be repurposed for just sending the email in a future step.
  console.warn("DEPRECATED: saveClientSignupForm server action was called. This logic should be on the client.");
  return { message: "This function is deprecated.", error: true };
}

export async function sendSignatureEmail(signupId: string, clientEmail: string) {
    if (!signupId || !clientEmail) {
        return { message: "Signup ID and client email are required.", error: true };
    }
    const firestore = serverDb;
    try {
        const signingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/client-sign/${signupId}`;
      
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
        return { message: "Signature email sent successfully." }

    } catch (error: any) {
        console.error("Error sending signature email:", error);
        return { message: `Failed to send signature email: ${error.message}`, error: true };
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
