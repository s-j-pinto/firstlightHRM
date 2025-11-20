
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb, serverAuth } from '@/firebase/server-init';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { generateClientIntakePdf } from './pdf.actions';
import { finalizationSchema } from './types';

const clientSignupSchema = z.object({
  signupId: z.string().nullable(),
  clientEmail: z.string().email(),
  formData: z.any(),
  status: z.enum(["Incomplete", "Pending Client Signatures"]),
});

export async function createCsaFromContact(initialContactId: string) {
    if (!initialContactId) {
        return { error: "Initial Contact ID is required." };
    }

    const firestore = serverDb;
    const now = Timestamp.now();

    try {
        // 1. Check if a signup document already exists for this contact
        const existingSignupQuery = await firestore.collection('client_signups')
            .where('initialContactId', '==', initialContactId)
            .limit(1)
            .get();

        if (!existingSignupQuery.empty) {
            const existingSignupId = existingSignupQuery.docs[0].id;
            console.log(`CSA already exists for contact ${initialContactId} with ID: ${existingSignupId}`);
            return { signupId: existingSignupId };
        }

        // 2. Fetch the initial contact data
        const contactRef = firestore.collection('initial_contacts').doc(initialContactId);
        const contactDoc = await contactRef.get();
        if (!contactDoc.exists) {
            return { error: "Initial contact record not found." };
        }
        const contactData = contactDoc.data()!;

        // 3. Prepare the pre-populated form data for the new signup document
        const formDataForSignup = {
            clientName: contactData.clientName || '',
            clientAddress: contactData.clientAddress || '',
            clientCity: contactData.city || '',
            clientState: contactData.state || 'CA', // Defaulting state
            clientPostalCode: contactData.zip || '',
            clientPhone: contactData.clientPhone || '',
            clientEmail: contactData.clientEmail || '',
            clientDOB: contactData.dateOfBirth ? formatDateForInput(contactData.dateOfBirth) : '',
            // Companion Care Fields
            companionCare_mealPreparation: contactData.companionCare_mealPreparation || false,
            companionCare_cleanKitchen: contactData.companionCare_cleanKitchen || false,
            companionCare_assistWithLaundry: contactData.companionCare_assistWithLaundry || false,
            companionCare_dustFurniture: contactData.companionCare_dustFurniture || false,
            companionCare_assistWithEating: contactData.companionCare_assistWithEating || false,
            companionCare_provideAlzheimersRedirection: contactData.companionCare_provideAlzheimersRedirection || false,
            companionCare_assistWithHomeManagement: contactData.companionCare_assistWithHomeManagement || false,
            companionCare_preparationForBathing: contactData.companionCare_preparationForBathing || false,
            companionCare_groceryShopping: contactData.companionCare_groceryShopping || false,
            companionCare_cleanBathrooms: contactData.companionCare_cleanBathrooms || false,
            companionCare_changeBedLinens: contactData.companionCare_changeBedLinens || false,
            companionCare_runErrands: contactData.companionCare_runErrands || false,
            companionCare_escortAndTransportation: contactData.companionCare_escortAndTransportation || false,
            companionCare_provideRemindersAndAssistWithToileting: contactData.companionCare_provideRemindersAndAssistWithToileting || false,
            companionCare_provideRespiteCare: contactData.companionCare_provideRespiteCare || false,
            companionCare_stimulateMentalAwareness: contactData.companionCare_stimulateMentalAwareness || false,
            companionCare_assistWithDressingAndGrooming: contactData.companionCare_assistWithDressingAndGrooming || false,
            companionCare_assistWithShavingAndOralCare: contactData.companionCare_assistWithShavingAndOralCare || false,
            companionCare_other: contactData.companionCare_other || '',
            // Personal Care Fields are not in initial contact, so they won't be pre-populated
        };

        // 4. Create the new client_signup document
        const signupRef = firestore.collection('client_signups').doc();
        await signupRef.set({
            initialContactId: initialContactId,
            formData: formDataForSignup,
            clientEmail: contactData.clientEmail,
            clientPhone: contactData.clientPhone,
            status: 'Incomplete', // Start as incomplete until sent
            createdAt: now,
            lastUpdatedAt: now,
        });

        console.log(`Created new CSA document ${signupRef.id} from contact ${initialContactId}`);
        return { signupId: signupRef.id };

    } catch (error: any) {
        console.error("Error creating CSA from contact:", error);
        return { error: `An error occurred: ${error.message}` };
    }
}

// Helper to format date for HTML date input
const formatDateForInput = (date: any) => {
    if (!date) return '';
    try {
        const d = date.toDate ? date.toDate() : new Date(date);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return '';
    }
};

export async function saveClientSignupForm(payload: z.infer<typeof clientSignupSchema>) {
    const validation = clientSignupSchema.safeParse(payload);
    if (!validation.success) {
        console.error("Server-side validation failed:", validation.error.flatten());
        return { message: "Invalid data provided.", error: true };
    }
    const { signupId, formData, status } = validation.data;
    const firestore = serverDb;
    const now = Timestamp.now();

    try {
        let docId = signupId;
        
        // This is the reference to the signup document itself.
        const signupDocRef = docId ? firestore.collection('client_signups').doc(docId) : firestore.collection('client_signups').doc();
        if (!docId) {
            docId = signupDocRef.id; // Assign new ID if creating
        }

        // Get the initialContactId *before* saving, as we need it for the sync.
        const existingSignupDoc = await signupDocRef.get();
        const initialContactId = existingSignupDoc.exists ? existingSignupDoc.data()?.initialContactId : null;

        const saveData = {
            formData: formData,
            clientEmail: formData.clientEmail,
            clientPhone: formData.clientPhone,
            status: status,
            lastUpdatedAt: now,
        };

        if (existingSignupDoc.exists) {
            await signupDocRef.update(saveData);
        } else {
            await signupDocRef.set({
                ...saveData,
                initialContactId: null, // This should have been set on creation from contact.
                createdAt: now,
            });
        }
        
        // Sync back to the initial contact form if it exists.
        if (initialContactId) {
            const contactRef = firestore.collection('initial_contacts').doc(initialContactId);
             const dataToSync: { [key: string]: any } = {
                clientName: formData.clientName || '',
                clientAddress: formData.clientAddress || '',
                city: formData.clientCity || '',
                zip: formData.clientPostalCode || '',
                clientPhone: formData.clientPhone || '',
                clientEmail: formData.clientEmail || '',
                dateOfBirth: formData.clientDOB ? Timestamp.fromDate(new Date(formData.clientDOB)) : null,
                lastUpdatedAt: now,
            };

            const otherTextfields = ['companionCare_other', 'personalCare_assistWithOther'];

            // Dynamically add all companion and personal care fields to the sync object
            Object.keys(formData).forEach(key => {
                if (key.startsWith('companionCare_') || key.startsWith('personalCare_')) {
                    if (otherTextfields.includes(key)) {
                        // This is a text field, save as string or empty string
                        dataToSync[key] = formData[key] || '';
                    } else {
                        // This is a checkbox, save as boolean
                        dataToSync[key] = formData[key] || false;
                    }
                }
            });

            await contactRef.update(dataToSync);
            console.log(`Successfully synced CSA changes back to Initial Contact ID: ${initialContactId}`);
        } else {
            console.warn(`Could not sync to Initial Contact: initialContactId not found on signup document ${docId}.`);
        }

        revalidatePath(`/admin/new-client-signup`, 'page');
        revalidatePath(`/owner/new-client-signup`, 'page');
        if (initialContactId) {
            revalidatePath(`/admin/initial-contact?contactId=${initialContactId}`);
            revalidatePath(`/owner/initial-contact?contactId=${initialContactId}`);
        }

        return { message: "CSA saved and initial contact synced.", docId };

    } catch (error: any) {
        console.error("Error saving CSA:", error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}


export async function sendSignatureEmail(signupId: string, clientEmail: string) {
    if (!signupId || !clientEmail) {
        return { message: "Signup ID and client email are required.", error: true };
    }
    const firestore = serverDb;
    try {
        const signupDoc = await firestore.collection('client_signups').doc(signupId).get();
        if (!signupDoc.exists) {
            return { message: "Signup document not found.", error: true };
        }
        const formData = signupDoc.data()?.formData;
        console.log("[DEBUG] sendSignatureEmail: formData received:", formData);

        const redirectPath = `/client-sign/${signupId}`;
        const loginUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/new-client-login`);
        loginUrl.searchParams.set('redirect', redirectPath);

        const signingLink = loginUrl.toString();
        
        console.log('[DEBUG] sendSignatureEmail: Generated signing link:', signingLink);
        
        let attachmentsHtml = '';
        if (formData?.receivedPrivacyPractices) {
            attachmentsHtml += `<p><strong>Download:</strong> <a href="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/waivers%2FFLHC_Privacy_Policy_NoticeRancho.pdf?alt=media&token=2bffc77a-fdfc-46af-85d2-04dd2ccab29f">Notice of Privacy Practices</a></p>`;
        }
        if (formData?.receivedClientRights) {
            attachmentsHtml += `<p><strong>Download:</strong> <a href="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/waivers%2FClient%20Rights%20and%20Responsibilities%20revised%203-11-24.pdf?alt=media&token=9a22bfc7-215f-4724-b569-2eb0050ba999">Client Rights and Responsibilities</a></p>`;
        }

        const emailHtml = `
            <body style="font-family: sans-serif; line-height: 1.6;">
            <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h1 style="color: #333;">Complete Your Onboarding</h1>
                <p>Hello,</p>
                <p>Thank you for choosing FirstLight Home Care. To finalize your service agreement, please click the button below to log in to your secure portal and sign the pending documents.</p>
                <div style="text-align: center; margin: 30px 0;">
                <a href="${signingLink}" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
                    Log In to Sign Documents
                </a>
                </div>
                ${attachmentsHtml ? `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;"><h2 style="font-size: 16px; color: #555;">Reference Documents</h2>${attachmentsHtml}</div>` : ''}
                <p>If you have any questions, please don't hesitate to contact our office.</p>
                <p>Thank you,<br/>The FirstLight Home Care Team</p>
            </div>
            </body>
        `;
      
        const email = {
            to: [clientEmail],
            message: {
                subject: "Action Required: Please Sign Your FirstLight Home Care Agreement",
                html: emailHtml,
            },
        };
        
        console.log("[DEBUG] sendSignatureEmail: Final email object before sending:", email);

        await firestore.collection("mail").add(email);
        return { message: "Signature email sent successfully.", error: false };

    } catch (error: any) {
        console.error("Error sending signature email:", error);
        return { message: `Failed to send signature email: ${error.message}`, error: true };
    }
}

const clientSignaturePayloadSchema = z.object({
  signupId: z.string(),
  signature: z.string().optional(),
  repSignature: z.string().optional(),
  agreementSignature: z.string().min(1, "Client signature in the payment agreement section is required."),
  printedName: z.string().optional(),
  date: z.date().optional(),
  repPrintedName: z.string().optional(),
  repDate: z.date().optional(),
  initials: z.string().min(1, { message: "Initials are required for the hiring clause." }),
  servicePlanClientInitials: z.string().min(1, { message: "Initials are required for the service plan." }),
  agreementRelationship: z.string().optional(),
  agreementDate: z.date().optional(),
  transportationWaiverClientSignature: z.string().optional(),
  transportationWaiverClientPrintedName: z.string().optional(),
  transportationWaiverWitnessSignature: z.string().optional(),
  transportationWaiverDate: z.date().optional(),
}).superRefine((data, ctx) => {
    if (!data.signature && !data.repSignature) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either the client's or the representative's signature is required in the Acknowledgement section.",
            path: ["signature"], 
        });
    }
});


export async function submitClientSignature(payload: any) {
    
    const validationResult = clientSignaturePayloadSchema.safeParse(payload);

    if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        return { message: `${firstError.path.join('.')}: ${firstError.message}`, error: true };
    }

    const { signupId, ...signatureData } = validationResult.data;

    const firestore = serverDb;
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL||'lpinto@firstlighthomecare.com';

    try {
        const signupRef = firestore.collection('client_signups').doc(signupId);
        
        const updatePayload: { [key: string]: any } = {
            status: 'Client Signatures Completed',
            lastUpdatedAt: Timestamp.now(),
        };

        if (signatureData.signature) updatePayload['formData.clientSignature'] = signatureData.signature;
        if (signatureData.printedName) updatePayload['formData.clientPrintedName'] = signatureData.printedName;
        if (signatureData.date) updatePayload['formData.clientSignatureDate'] = Timestamp.fromDate(signatureData.date);
        if (signatureData.repSignature) updatePayload['formData.clientRepresentativeSignature'] = signatureData.repSignature;
        if (signatureData.repPrintedName) updatePayload['formData.clientRepresentativePrintedName'] = signatureData.repPrintedName;
        if (signatureData.repDate) updatePayload['formData.clientRepresentativeSignatureDate'] = Timestamp.fromDate(signatureData.repDate);
        if (signatureData.initials) updatePayload['formData.clientInitials'] = signatureData.initials;
        if (signatureData.servicePlanClientInitials) updatePayload['formData.servicePlanClientInitials'] = signatureData.servicePlanClientInitials;
        if (signatureData.agreementSignature) updatePayload['formData.agreementClientSignature'] = signatureData.agreementSignature;
        if (signatureData.agreementRelationship) updatePayload['formData.agreementRelationship'] = signatureData.agreementRelationship;
        if (signatureData.agreementDate) updatePayload['formData.agreementSignatureDate'] = Timestamp.fromDate(signatureData.agreementDate);
        if (signatureData.transportationWaiverClientSignature) updatePayload['formData.transportationWaiverClientSignature'] = signatureData.transportationWaiverClientSignature;
        if (signatureData.transportationWaiverClientPrintedName) updatePayload['formData.transportationWaiverClientPrintedName'] = signatureData.transportationWaiverClientPrintedName;
        if (signatureData.transportationWaiverWitnessSignature) updatePayload['formData.transportationWaiverWitnessSignature'] = signatureData.transportationWaiverWitnessSignature;
        if (signatureData.transportationWaiverDate) updatePayload['formData.transportationWaiverDate'] = Timestamp.fromDate(signatureData.transportationWaiverDate);

        await signupRef.update(updatePayload);
        
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

export async function finalizeAndSubmit(signupId: string, formData: any) {
    const firestore = serverDb;
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'lpinto@firstlighthomecare.com';
    const now = Timestamp.now();

    // Before doing anything, validate the final state of the data
    const validation = finalizationSchema.safeParse(formData);
    if (!validation.success) {
        console.error("Finalization validation failed:", validation.error.flatten().fieldErrors);
        return { error: true, message: `Validation failed: ${validation.error.errors[0].path.join('.')} - ${validation.error.errors[0].message}` };
    }

    try {
        const signupRef = firestore.collection('client_signups').doc(signupId);
        
        // First, save the final, validated state of the form data passed from the client
        await signupRef.update({
            formData: validation.data,
            lastUpdatedAt: now,
        });

        // Sync data back to initial_contacts before generating PDF
        const initialContactId = (await signupRef.get()).data()?.initialContactId;
        if (initialContactId) {
            const contactRef = firestore.collection('initial_contacts').doc(initialContactId);
            const dataToSync: { [key: string]: any } = {
                clientName: validation.data.clientName || '',
                clientAddress: validation.data.clientAddress || '',
                city: validation.data.clientCity || '',
                zip: validation.data.clientPostalCode || '',
                clientPhone: validation.data.clientPhone || '',
                clientEmail: validation.data.clientEmail || '',
                dateOfBirth: validation.data.clientDOB ? Timestamp.fromDate(new Date(validation.data.clientDOB)) : null,
                lastUpdatedAt: now,
            };
             Object.keys(validation.data).forEach(key => {
                if (key.startsWith('companionCare_') || key.startsWith('personalCare_')) {
                    dataToSync[key] = (validation.data as any)[key] || false;
                }
            });
            await contactRef.update(dataToSync);
             console.log(`Successfully synced CSA changes back to Initial Contact ID: ${initialContactId} during finalization.`);
        }

        const clientEmail = validation.data.clientEmail;
        const clientName = validation.data.clientName || 'Client';

        // 1. Generate PDF with the latest data
        const pdfBytes = await generateClientIntakePdf(validation.data);
        
        // 2. Upload to Firebase Storage
        const bucket = getStorage().bucket("gs://firstlighthomecare-hrm.firebasestorage.app");
        const fileName = `client-agreements/${clientName.replace(/ /g, '_')}_${signupId}.pdf`;
        const file = bucket.file(fileName);
        
        await file.save(Buffer.from(pdfBytes), {
            metadata: {
                contentType: 'application/pdf',
            },
        });
        
        const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: '03-09-2491',
        });

        // 3. Update status and save PDF URL
        await signupRef.update({
            status: 'Signed and Published',
            completedPdfUrl: signedUrl,
            lastUpdatedAt: now,
        });
        
        // 4. Send confirmation emails
        const emailRecipients = [ownerEmail, clientEmail].filter(Boolean) as string[];

        if (emailRecipients.length > 0) {
             let attachmentsHtml = '';
            if (validation.data?.receivedPrivacyPractices) {
                attachmentsHtml += `<p><strong>Download:</strong> <a href="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/waivers%2FFLHC_Privacy_Policy_NoticeRancho.pdf?alt=media&token=2bffc77a-fdfc-46af-85d2-04dd2ccab29f">Notice of Privacy Practices</a></p>`;
            }
            if (validation.data?.receivedClientRights) {
                attachmentsHtml += `<p><strong>Download:</strong> <a href="https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/waivers%2FClient%20Rights%20and%20Responsibilities%20revised%203-11-24.pdf?alt=media&token=9a22bfc7-215f-4724-b569-2eb0050ba999">Client Rights and Responsibilities</a></p>`;
            }

            const emailHtml = `
                <p>The Client Service Agreement for ${clientName} has been finalized. A PDF copy is available for download at the link below.</p>
                <p><a href="${signedUrl}">Download Completed Agreement</a></p>
                <p>Document ID: ${signupId}</p>
                ${attachmentsHtml ? `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee;"><h2 style="font-size: 16px; color: #555;">Reference Documents</h2>${attachmentsHtml}</div>` : ''}
            `;
            
            const email = {
                to: emailRecipients,
                message: {
                    subject: `Your FirstLight Home Care Service Agreement for ${clientName} is Complete`,
                    html: emailHtml,
                }
            };
            await firestore.collection("mail").add(email);
        }

        revalidatePath('/owner/dashboard');
        revalidatePath(`/owner/new-client-signup?signupId=${signupId}`);
        return { message: 'Document has been finalized, PDF generated, and confirmation emails have been sent.', completedPdfUrl: signedUrl };
    } catch (error: any) {
        console.error("Error finalizing document:", error);
        return { message: `An error occurred during finalization: ${error.message}`, error: true };
    }
}

export async function previewClientIntakePdf(formData: any) {
    try {
        const pdfBytes = await generateClientIntakePdf(formData);
        const pdfBase64 = Buffer.from(pdfBytes).toString('base64');
        return { pdfData: pdfBase64 };
    } catch (error: any) {
        console.error("Error generating PDF preview:", error);
        return { error: `Failed to generate PDF: ${error.message}` };
    }
}
