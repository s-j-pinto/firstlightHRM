
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { CaregiverProfile } from './types';
import { Timestamp } from 'firebase-admin/firestore';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

interface SaveInterviewPayload {
  caregiverProfile: CaregiverProfile;
  eventDateTime: Date;
  interviewId: string;
  aiInsight: string | null;
  interviewType: 'In-Person' | 'Google Meet' | 'Orientation';
  interviewNotes: string;
  candidateRating: number;
  pathway: 'separate' | 'combined';
  finalInterviewStatus?: 'Passed' | 'Failed' | 'Pending';
}

export async function saveInterviewAndSchedule(payload: SaveInterviewPayload) {
  const { 
    caregiverProfile, 
    eventDateTime, 
    interviewId, 
    aiInsight, 
    interviewType,
    interviewNotes,
    candidateRating,
    pathway,
    finalInterviewStatus
  } = payload;
  
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    let calendarAuthUrl: string | null = null;
    let calendarErrorMessage: string | null = null;
    let conferenceLink: string | undefined = undefined;

    // --- Determine Event Duration and Title ---
    let durationHours: number;
    let eventTitle: string;

    if (interviewType === 'Orientation') {
        durationHours = 1.5;
        eventTitle = `Orientation: ${caregiverProfile.fullName}`;
    } else if (pathway === 'combined') {
        durationHours = 3;
        eventTitle = `Interview + Orientation: ${caregiverProfile.fullName}`;
    } else { // separate final interview
        durationHours = 1;
        eventTitle = `Final Interview: ${caregiverProfile.fullName}`;
    }
    
    // --- Calendar Integration ---
    if (clientId && clientSecret && refreshToken) {
      const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
      oAuth2Client.setCredentials({ refresh_token: refreshToken });

      try {
        await oAuth2Client.getAccessToken(); // Validate token
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const startTime = eventDateTime;
        const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

        const eventRequestBody: any = {
            summary: eventTitle,
            start: { dateTime: startTime.toISOString(), timeZone: 'America/Los_Angeles' },
            end: { dateTime: endTime.toISOString(), timeZone: 'America/Los_Angeles' },
            attendees: [{ email: 'care-rc@firstlighthomecare.com' }, { email: caregiverProfile.email }],
            reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 120 }] },
        };
        
        if (interviewType === 'Google Meet') {
          eventRequestBody.location = 'Google Meet';
          eventRequestBody.description = `This is a confirmation for your video interview. Please join using the Google Meet link.`;
          eventRequestBody.conferenceData = { createRequest: { requestId: `interview-${interviewId}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
        } else {
          eventRequestBody.location = '9650 Business Center Drive, Suite #132, Bldg #17, Rancho Cucamonga, CA 92730, PH: 909-321-4466';
          eventRequestBody.description = `Dear ${caregiverProfile.fullName},\nPlease bring the following documents to in-person Interview:\n- Driver's License,\n- Car insurance and registration,\n- Social Security card or US passport (to prove your work eligibility, If you are green card holder, bring Green card.)\n- Current negative TB-Test Copy,\n- HCA letter or number,\n- Live scan or Clearance letter if you have it,\n If you have not registered, please register on this link: https://guardian.dss.ca.gov/Applicant/ \n- CPR-First Aide proof card, Any other certification that you have.`;
        }

        const createdEvent = await calendar.events.insert({ 
            calendarId: 'primary', 
            requestBody: eventRequestBody, 
            sendNotifications: true,
            conferenceDataVersion: 1,
        });
        conferenceLink = createdEvent.data.hangoutLink;
      } catch (calendarError: any) {
          console.error('Error sending calendar invite:', calendarError);
          // Don't crash, just log and set an error message to return
          calendarErrorMessage = `Failed to create calendar event: ${calendarError.message}`;
      }
    } else {
      calendarErrorMessage = "Calendar integration is not fully configured (missing client ID, secret, or refresh token).";
    }

    // --- Firestore Update ---
    const interviewRef = serverDb.collection('interviews').doc(interviewId);
    
    const updateData: { [key: string]: any } = {
        interviewNotes,
        candidateRating,
        phoneScreenPassed: "Yes",
        aiGeneratedInsight: aiInsight || '',
        interviewPathway: pathway,
    };

    if (interviewType === 'Orientation') {
        updateData.orientationScheduled = true;
        updateData.orientationDateTime = Timestamp.fromDate(eventDateTime);
    } else {
        updateData.interviewDateTime = Timestamp.fromDate(eventDateTime);
        updateData.interviewType = interviewType;
        updateData.googleMeetLink = conferenceLink || null;
        updateData.finalInterviewStatus = finalInterviewStatus || (pathway === 'combined' ? 'Passed' : 'Pending');
        updateData.orientationScheduled = pathway === 'combined';
    }


    await interviewRef.update(updateData);

    // --- Confirmation Email ---
    const pacificTimeZone = 'America/Los_Angeles';
    const zonedStartTime = toZonedTime(eventDateTime, pacificTimeZone);
    const formattedDate = formatInTimeZone(zonedStartTime, pacificTimeZone, 'eeee, MMMM do');
    const formattedStartTime = formatInTimeZone(zonedStartTime, pacificTimeZone, 'h:mm a');
    const locationInfo = interviewType === 'Google Meet' 
        ? `<p><strong>Meeting Link:</strong><br><a href="${conferenceLink || '#'}">${conferenceLink || 'Meeting link will be in calendar invite.'}</a></p>`
        : `<p><strong>Office address:</strong><br>9650 Business Center Drive, Suite #132, Bldg #17, Rancho Cucamonga, CA 92730, PH: 909-321-4466</p>`;

    const confirmationEmail = {
        to: [caregiverProfile.email],
        cc: ['care-rc@firstlighthomecare.com'],
        message: {
            subject: `Confirmation: ${eventTitle} with FirstLight Home Care`,
            html: `<p>${caregiverProfile.fullName},</p><p>This is to confirm your ${interviewType} session on ${formattedDate} at ${formattedStartTime}.</p>${locationInfo}<p>Thank you,</p><p>FirstLight Home Care</p>`,
        },
    };
    await serverDb.collection("mail").add(confirmationEmail);
    
    revalidatePath('/admin/manage-interviews');
    
    // --- Final Response ---
    if (calendarErrorMessage) {
        return { message: `Interview details saved and email sent, but calendar invite failed: ${calendarErrorMessage}`, error: true, authUrl: calendarAuthUrl };
    }
    
    return { message: `Next event scheduled and all notifications sent.` };

  } catch (error: any) {
    console.error("Critical error in saveInterviewAndSchedule:", error);
    return { message: `A critical server error occurred: ${error.message}`, error: true };
  }
}
