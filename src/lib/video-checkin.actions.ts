
"use server";

import { revalidatePath } from 'next/cache';
import { serverAuth, serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { format, set } from 'date-fns';

const requestSchema = z.object({
    requestedBy: z.string().min(1),
    notes: z.string().optional(),
});
type RequestFormData = z.infer<typeof requestSchema>;

export async function requestVideoCheckin(payload: RequestFormData) {
    const validation = requestSchema.safeParse(payload);
    const staffingAdminEmail = process.env.STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";

    if (!validation.success) {
        return { message: "Invalid data provided.", error: true };
    }
    const data = validation.data;
    const firestore = serverDb;

    try {
        const sessionCookie = cookies().get("__session")?.value || "";
        const decodedIdToken = await serverAuth.verifySessionCookie(sessionCookie, true);

        if (!decodedIdToken.clientId) {
             return { message: "Authentication failed or client ID not found in session.", error: true };
        }
        const clientId = decodedIdToken.clientId as string;

        const clientDoc = await firestore.collection('Clients').doc(clientId).get();
        if (!clientDoc.exists) {
            return { message: "Associated client profile not found.", error: true };
        }
        const clientData = clientDoc.data()!;
        const clientName = clientData['Client Name'] || 'Unknown Client';
        const clientEmail = clientData['Email'] || '';

        const requestData = {
            clientId: clientId,
            clientName: clientName,
            clientEmail: clientEmail,
            requestedBy: data.requestedBy,
            notes: data.notes || '',
            status: 'pending' as const,
            createdAt: Timestamp.now(),
        };

        await firestore.collection('video_checkin_requests').add(requestData);

        // Send email notification to staffing admin
        const email = {
            to: [staffingAdminEmail],
            message: {
                subject: `New Video Check-in Request from ${clientName}`,
                html: `
                    <p>A new video check-in request has been submitted by ${clientName}.</p>
                    <p><strong>For:</strong> ${data.requestedBy}</p>
                    <p><strong>Notes:</strong> ${data.notes || 'N/A'}</p>
                    <p>Please log in to the Staffing Admin dashboard to schedule the video call.</p>
                `,
            },
        };
        await firestore.collection("mail").add(email);

        return { message: `Your request has been sent successfully.` };
    } catch (error: any) {
        console.error("Error submitting video check-in request:", error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}


const scheduleSchema = z.object({
  requestId: z.string(),
  caregiverEmail: z.string().email(),
  scheduledDate: z.date(),
  scheduledTime: z.string(),
});
type SchedulePayload = z.infer<typeof scheduleSchema>;

export async function scheduleVideoCheckin(payload: SchedulePayload) {
  const validation = scheduleSchema.safeParse(payload);
  if (!validation.success) {
    return { message: "Invalid scheduling data.", error: true };
  }
  const { requestId, caregiverEmail, scheduledDate, scheduledTime } = validation.data;
  const firestore = serverDb;

  try {
    const requestRef = firestore.collection('video_checkin_requests').doc(requestId);
    const requestDoc = await requestRef.get();
    if (!requestDoc.exists) {
        return { message: 'Request not found.', error: true };
    }
    const requestData = requestDoc.data()!;

    // --- Google Calendar Integration ---
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';
    
    if (!clientId || !clientSecret || !refreshToken) {
        return { message: 'Google Calendar is not configured on the server.', error: true };
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    await oAuth2Client.getAccessToken();
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const [hours, minutes] = scheduledTime.split(':').map(Number);
    const scheduledAt = set(scheduledDate, { hours, minutes });
    const endTime = new Date(scheduledAt.getTime() + 15 * 60 * 1000); // 15-minute duration

    const event = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: `Video Check-in for ${requestData.clientName}`,
        description: `A scheduled video check-in call with ${requestData.requestedBy}. Notes: ${requestData.notes || 'N/A'}`,
        start: { dateTime: scheduledAt.toISOString(), timeZone: 'America/Los_Angeles' },
        end: { dateTime: endTime.toISOString(), timeZone: 'America/Los_Angeles' },
        attendees: [{ email: caregiverEmail }, { email: requestData.clientEmail }],
        conferenceData: { createRequest: { requestId: `video-check-in-${requestId}` } },
      },
      conferenceDataVersion: 1,
      sendNotifications: true,
    });

    const meetLink = event.data.hangoutLink;

    // Update Firestore document
    await requestRef.update({
      status: 'scheduled',
      caregiverEmail,
      scheduledAt: Timestamp.fromDate(scheduledAt),
      googleMeetLink: meetLink,
    });

    revalidatePath('/staffing-admin/manage-video-checkins');
    return { message: 'Video check-in scheduled and invites sent.' };

  } catch (error: any) {
    console.error("Error scheduling video check-in:", error);
    return { message: `An error occurred: ${error.message}`, error: true };
  }
}

    