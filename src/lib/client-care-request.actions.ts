
"use server";

import { revalidatePath } from 'next/cache';
import { serverAuth, serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { format } from 'date-fns';

const requestCareSchema = z.object({
  preferredDate: z.date(),
  preferredTime: z.string(),
  duration: z.string(),
  reason: z.string(),
  preferredCaregiver: z.string().optional(),
  urgency: z.string(),
});

type RequestCareFormValues = z.infer<typeof requestCareSchema>;

export async function submitCareRequest(payload: RequestCareFormValues) {
    const validation = requestCareSchema.safeParse(payload);
    const staffingAdminEmail = process.env.STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";

    if (!validation.success) {
        return { message: "Invalid data provided.", error: true };
    }

    const data = validation.data;
    const firestore = serverDb;

    try {
        const { get } = await serverAuth.verifySessionCookie(require('next/headers').cookies().get('__session')?.value || '', true);
        const user = await serverAuth.getUser(get.uid);

        if (!user || !user.customClaims || !user.customClaims.clientId) {
             return { message: "Authentication failed or client ID not found.", error: true };
        }
        
        const clientId = user.customClaims.clientId as string;

        const clientDoc = await firestore.collection('Clients').doc(clientId).get();
        if (!clientDoc.exists) {
            return { message: "Associated client profile not found.", error: true };
        }
        const clientData = clientDoc.data();
        const clientName = clientData?.['Client Name'] || 'Unknown Client';

        const [hours, minutes] = data.preferredTime.split(':').map(Number);
        const preferredDateTime = new Date(data.preferredDate);
        preferredDateTime.setHours(hours, minutes);

        const requestData = {
            clientId: clientId,
            clientName: clientName,
            clientEmail: user.email,
            preferredDateTime: Timestamp.fromDate(preferredDateTime),
            duration: data.duration,
            reason: data.reason,
            preferredCaregiver: data.preferredCaregiver || 'N/A',
            urgency: data.urgency,
            status: 'pending', // Initial status
            createdAt: Timestamp.now(),
        };

        await firestore.collection('client_additional_care_requests').add(requestData);

        const formattedDate = format(preferredDateTime, 'EEEE, MMMM do, yyyy @ h:mm a');

        // Send email to staffing admin
        const email = {
            to: [staffingAdminEmail],
            message: {
                subject: `[Action Required] New Care Request from ${clientName}`,
                html: `
                    <body style="font-family: sans-serif; line-height: 1.6;">
                        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                            <h1 style="color: #333;">New Additional Care Request</h1>
                            <p>A new request for additional care has been submitted by a client. Please review the details below and follow up with the client.</p>
                            
                            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h2 style="margin-top: 0; color: #555;">Request Details</h2>
                                <p><strong>Client:</strong> ${clientName}</p>
                                <p><strong>Client Contact Email:</strong> ${user.email}</p>
                                <p><strong>Urgency:</strong> ${data.urgency}</p>
                                <p><strong>Preferred Date & Time:</strong> ${formattedDate}</p>
                                <p><strong>Requested Duration:</strong> ${data.duration}</p>
                                <p><strong>Preferred Caregiver:</strong> ${data.preferredCaregiver || 'N/A'}</p>
                                <p><strong>Reason:</strong></p>
                                <p style="white-space: pre-wrap; background: #fff; padding: 10px; border-radius: 4px;">${data.reason}</p>
                            </div>

                            <div style="text-align: center;">
                                <a href="https://care-connect-360--firstlighthomecare-hrm.us-central1.hosted.app/login?role=staffing" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
                                    Go to Staffing Dashboard
                                </a>
                            </div>
                        </div>
                    </body>
                `,
            },
        };
        
        await firestore.collection("mail").add(email);

        return { message: `Your request has been sent to the staffing admin as of ${format(new Date(), 'PPpp')}.` };

    } catch (error: any) {
        console.error("Error submitting care request:", error);
        if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/invalid-session-cookie') {
            return { message: 'Your session has expired. Please log in again.', error: true };
        }
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}
