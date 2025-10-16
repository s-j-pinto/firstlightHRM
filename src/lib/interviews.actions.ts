
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { CaregiverProfile } from './types';
import { Timestamp } from 'firebase-admin/firestore';

interface SaveInterviewPayload {
  caregiverProfile: CaregiverProfile;
  inPersonDateTime: Date;
  interviewId: string;
  aiInsight: string | null;
}

export async function saveInterviewAndSchedule(payload: SaveInterviewPayload) {
  const { caregiverProfile, inPersonDateTime, interviewId, aiInsight } = payload;
  
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

  // First, save the AI insight and interview date to the existing interview document
  try {
    const interviewRef = serverDb.collection('interviews').doc(interviewId);
    await interviewRef.update({ 
      aiGeneratedInsight: aiInsight || '',
      inPersonInterviewDate: Timestamp.fromDate(inPersonDateTime),
    });
  } catch (dbError) {
    console.error("Error saving AI insight/date to interview:", dbError);
    return { message: "Failed to save AI Insight or date to the interview record.", error: true };
  }

  // Then, proceed with calendar scheduling
  if (!clientId || !clientSecret) {
      const errorMsg = "Google API credentials are not configured. Please set them in your environment.";
      return { message: errorMsg, error: true };
  }

  const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
  
  if (refreshToken) {
      oAuth2Client.setCredentials({ refresh_token: refreshToken });
  } else {
      const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          prompt: 'consent',
          scope: ['https://www.googleapis.com/auth/calendar.events'],
      });
      const errorMsg = "Admin authorization required. A refresh token is missing. Please authorize the application to generate one.";
      return { message: errorMsg, error: true, authUrl: authUrl };
  }

  try {
    // This will throw an error if the refresh token is invalid.
    await oAuth2Client.getAccessToken();

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    const startTime = inPersonDateTime;
    const endTime = new Date(startTime.getTime() + 2.5 * 60 * 60 * 1000); // 2.5 hours interview

    const event = {
      summary: `In-Person interview with ${caregiverProfile.fullName}`,
      location: '9650 Business Center Drive, Suite #132, Bldg #17, Rancho Cucamonga, CA 92730, PH: 909-321-4466',
      description: `Dear ${caregiverProfile.fullName},\nPlease bring the following documents to in-person Interview:\n- Driver's License,\n- Car insurance and registration,\n- Social Security card or US passport (to prove your work eligibility, If you are green card holder, bring Green card.)\n- Current negative TB-Test Copy,\n- HCA letter or number,\n- Live scan or Clearance letter if you have it,\n If you have not registered, please register on this link: https://guardian.dss.ca.gov/Applicant/ \n- CPR-First Aide proof card, Any other certification that you have.`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Los_Angeles',
      },
      attendees: [
        { email: 'care-rc@firstlighthomecare.com' },
        { email: caregiverProfile.email },
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 120 },
        ],
      },
    };

    await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendNotifications: true,
    });

    revalidatePath('/admin/manage-interviews');
    return { message: 'In-person meeting scheduled successfully.' };

  } catch(calendarError: any) {
     console.error('Error sending calendar invite:', calendarError);
     let errorMessage = 'Failed to send calendar invite. Please check Google credentials.';
     if (calendarError.message.includes('invalid_grant') || calendarError.message.includes('revoked')) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/calendar.events'],
        });
        return {
            message: "Your Google authentication token is invalid or has expired. Please re-authorize.",
            error: true,
            authUrl: authUrl
        };
      } else if (calendarError.response?.data?.error?.message) {
        errorMessage += ` Google API Error: ${calendarError.response.data.error.message}`;
     } else if (calendarError.message) {
        errorMessage += ` Error: ${calendarError.message}`;
     }

     return { message: errorMessage, error: true };
  }
}
