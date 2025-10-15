
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { CaregiverProfile } from './types';

interface SaveInterviewPayload {
  caregiverProfile: CaregiverProfile;
  inPersonDateTime: Date;
}

export async function saveInterviewAndSchedule(payload: SaveInterviewPayload) {
  const { caregiverProfile, inPersonDateTime } = payload;

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Google API credentials are not fully configured in .env.local');
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    
    const startTime = inPersonDateTime;
    const endTime = new Date(startTime.getTime() + 2.5 * 60 * 60 * 1000); // 2.5 hours interview

    const event = {
      summary: `Firstlight In-Person Interview with ${caregiverProfile.fullName}`,
      location: '9650 Business Center Drive, Suite 132, Rancho Cucamonga, CA',
      description: `Dear ${caregiverProfile.fullName},\nPlease bring the following documents to In person Interview:\n- Driver's License,\n- Car insurance and registration,\n- Social Security card or US passport (to prove your work eligibility, If you are green card holder, bring Green card.)\n- Current negative TB-Test Copy,\n- HCA letter or number,\n- Live scan or Clearance letter if you have it,\n- CPR-First Aide proof card, Any other certification that you have.`,
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
     if (calendarError.response?.data?.error?.message) {
        errorMessage += ` Google API Error: ${calendarError.response.data.error.message}`;
     } else if (calendarError.message) {
        errorMessage += ` Error: ${calendarError.message}`;
     }
     return { message: errorMessage, error: true };
  }
}

    