

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
        const signingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/new-client-login`;
      
        const email = {
            to: [clientEmail],
            message: {
            subject: "Action Required: Please Sign Your FirstLight Home Care Agreement",
            html: `
                <body style="font-family: sans-serif; line-height: 1.6;">
                <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                    <h1 style="color: #333;">Complete Your Onboarding</h1>
                    <p>Hello,</p>
                    <p>Thank you for choosing FirstLight Home Care. To finalize your service agreement, please log in to your secure portal to review and sign the pending documents by clicking the button below.</p>
                    <div style="text-align: center; margin: 30px 0;">
                    <a href="${signingLink}" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
                        Log In to Sign Documents
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
        return { message: "Signature email sent successfully.", error: false };

    } catch (error: any) {
        console.error("Error sending signature email:", error);
        return { message: `Failed to send signature email: ${error.message}`, error: true };
    }
}


export async function submitClientSignature(payload: { signupId: string; signature: string; initials: string; date: string; }) {
    const { signupId, signature, initials, date } = payload;
    const firestore = serverDb;
    const ownerEmail = process.env.OWNER_EMAIL;

    try {
        const signupRef = firestore.collection('client_signups').doc(signupId);
        
        await signupRef.update({
            'formData.clientSignature': signature,
            'formData.clientInitials': initials,
            'formData.clientSignatureDate': date,
            status: 'CLIENT_SIGNATURES_COMPLETED',
            lastUpdatedAt: Timestamp.now(),
        });
        
        // Notify owner to review and finalize
        const signupDoc = await signupRef.get();
        const clientName = signupDoc.data()?.formData?.clientName || 'the client';
        
        if (ownerEmail) {
            const email = {
                to: [ownerEmail],
                message: {
                    subject: `Action Required: Review Signed Document for ${clientName}`,
                    html: `<p>The client, ${clientName}, has signed their intake form. Please log in to the Owner Dashboard to review the document and finalize the submission.</p><p>Document ID: ${signupId}</p>`
                }
            };
            await firestore.collection("mail").add(email);
        }

        revalidatePath(`/client-sign/${signupId}`);
        revalidatePath('/owner/dashboard');
        
        return { message: "Thank you! Your signature has been submitted. The office will now conduct a final review." };

    } catch (error: any) {
        console.error("Error submitting client signature:", error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}

export async function finalizeAndSubmit(signupId: string) {
    const firestore = serverDb;
    const ownerEmail = process.env.OWNER_EMAIL;
    try {
        const signupRef = firestore.collection('client_signups').doc(signupId);
        const signupDoc = await signupRef.get();
        if (!signupDoc.exists) {
            return { message: "Signup document not found.", error: true };
        }

        // 1. Update status to SIGNED AND PUBLISHED
        await signupRef.update({
            status: 'SIGNED AND PUBLISHED',
            lastUpdatedAt: Timestamp.now(),
        });
        
        const clientEmail = signupDoc.data()?.formData?.clientEmail;
        
        // 2. Here you would trigger PDF generation and upload to GCS.
        // For now, we will simulate this by preparing an email.
        
        const emailRecipients = [ownerEmail, clientEmail].filter(Boolean) as string[];

        if (emailRecipients.length > 0) {
            const email = {
                to: emailRecipients,
                message: {
                    subject: "Your FirstLight Home Care Service Agreement is Complete",
                    html: `<p>The Client Service Agreement has been finalized. A PDF copy should be attached to this email.</p><p>Document ID: ${signupId}</p><p>(Note: PDF attachment is a placeholder for now.)</p>`,
                    // attachments: [{ filename: '...', path: '...' }] // This would be added once PDF generation is live
                }
            };
            await firestore.collection("mail").add(email);
        }

        revalidatePath('/owner/dashboard');
        revalidatePath(`/owner/new-client-signup?signupId=${signupId}`);
        return { message: 'Document has been finalized and emails have been sent.' };
    } catch (error: any) {
        console.error("Error finalizing document:", error);
        return { message: `An error occurred during finalization: ${error.message}`, error: true };
    }
}
