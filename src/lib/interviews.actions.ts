
'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { CaregiverProfile, Interview } from './types';
import { Timestamp } from 'firebase-admin/firestore';
import { format, formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

interface SaveInterviewPayload {
  caregiverProfile: {
    fullName: string;
    email: string;
  };
  eventDate: string; // Keep as string MM/DD/YYYY
  eventTime: string; // Keep as string HH:mm
  interviewId: string;
  aiInsight: string | null;
  interviewType: 'In-Person' | 'Google Meet' | 'Orientation';
  interviewNotes: string;
  candidateRating: string;
  pathway: 'separate' | 'combined';
  finalInterviewStatus?: 'Passed' | 'Failed' | 'Pending' | 'Pending reference checks' |'Rejected at Orientation';
  googleEventId?: string | null;
  previousPathway?: 'separate' | 'combined' | null;
  includeReferenceForm?: boolean;
}

export async function saveInterviewAndSchedule(payload: SaveInterviewPayload): Promise<{ message: string; error?: boolean; authUrl?: string | null }> {
  const { 
    caregiverProfile, 
    eventDate,
    eventTime,
    interviewId, 
    aiInsight, 
    interviewType,
    interviewNotes,
    candidateRating,
    pathway,
    finalInterviewStatus,
    googleEventId,
    previousPathway,
    includeReferenceForm,
  } = payload;
  


  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    let calendarAuthUrl: string | null = null;
    let calendarErrorMessage: string | null = null;
    let conferenceLink: string | undefined = undefined;
    let newGoogleEventId: string | undefined = undefined;

    // --- Timezone and Date Construction ---
    const pacificTimeZone = 'America/Los_Angeles';
    const [month, day, year] = eventDate.split('/');
    const isoDate = `${year}-${month}-${day}`;
    const dateTimeString = `${isoDate}T${eventTime}`;
    const startTime = fromZonedTime(dateTimeString, pacificTimeZone);
    
    // --- Determine Event Duration and Title ---
    let durationHours: number;
    let eventTitle: string;

    if (interviewType === 'Orientation') {
        durationHours = 2;
        eventTitle = `Orientation: ${caregiverProfile.fullName}`;
    } else if (pathway === 'combined') {
        durationHours = 3;
        eventTitle = `In-Person Interview + Orientation: ${caregiverProfile.fullName}`;
    } else { // separate final interview
        durationHours = 1;
        eventTitle = `In-Person Interview: ${caregiverProfile.fullName}`;
    }
    
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
    const logoHtml = `<img src="${logoUrl}" alt="FirstLight Home Care Logo" style="width: 200px; height: auto; margin-bottom: 20px;" /><br><br>`;


    // --- Calendar Integration ---
    if (clientId && clientSecret && refreshToken) {
      const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
      oAuth2Client.setCredentials({ refresh_token: refreshToken });

      try {
        await oAuth2Client.getAccessToken(); // Validate token
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        
        const eventRequestBody: any = {
            summary: eventTitle,
            start: { dateTime: startTime.toISOString(), timeZone: pacificTimeZone },
            end: { dateTime: endTime.toISOString(), timeZone: pacificTimeZone },
            attendees: [{ email: 'care-rc@firstlighthomecare.com' }, { email: caregiverProfile.email }],
            reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 60 }] },
        };
        
        if (interviewType === 'Google Meet') {
          eventRequestBody.location = 'Google Meet';
          eventRequestBody.description = `${logoHtml}This is a confirmation for your video interview with FirstLight Homecare. Please join using the Google Meet link.`;
          eventRequestBody.conferenceData = { createRequest: { requestId: `interview-${interviewId}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
        } else {
          eventRequestBody.location = '9650 Business Center Drive, Suite #113, Bldg #17, Rancho Cucamonga, CA 92730, PH: 909-321-4466';
          eventRequestBody.description = `${logoHtml}Dear ${caregiverProfile.fullName},\nPlease bring the following documents to in-person Interview with FirstLight Homecare:\n- Driver's License,\n- Car insurance and registration,\n- Social Security card or US passport (to prove your work eligibility, If you are green card holder, bring Green card.)\n- Current negative TB-Test Copy,\n- HCA letter, number, or Credit Card so during your interview, we can apply and pay $35 fee to guardian.`;
        }

        let createdEvent;
        const pathwayChanged = previousPathway && previousPathway !== pathway;
        if (googleEventId && interviewType !== 'Orientation' && !pathwayChanged) {
            createdEvent = await calendar.events.update({
                calendarId: 'primary',
                eventId: googleEventId,
                requestBody: eventRequestBody,
                sendUpdates: 'all',
            });
        } else {
            createdEvent = await calendar.events.insert({ 
                calendarId: 'primary', 
                requestBody: eventRequestBody, 
                sendNotifications: true,
                conferenceDataVersion: 1,
            });
        }
        conferenceLink = createdEvent.data.hangoutLink || undefined;
        newGoogleEventId = createdEvent.data.id || undefined;
      } catch (calendarError: any) {
          calendarErrorMessage = `Failed to create/update calendar event: ${calendarError.message}`;
      }
    }

    // --- Firestore Update with Denormalization ---
    const interviewRef = serverDb.collection('interviews').doc(interviewId);
    const updateData: any = {
        interviewNotes,
        candidateRating,
        phoneScreenPassed: "Yes",
        aiGeneratedInsight: aiInsight || '',
        interviewPathway: pathway,
        lastUpdatedAt: Timestamp.now(),
    };

    if (newGoogleEventId) updateData.googleEventId = newGoogleEventId;

    let denormalizedStatus = "Final Interview Pending";
    let nextStepText = "Needs In-Person Interview";

    if (interviewType === 'Orientation') {
        updateData.orientationScheduled = true;
        updateData.orientationDateTime = Timestamp.fromDate(startTime);
        denormalizedStatus = "Orientation Scheduled";
        nextStepText = `Orientation: ${formatInTimeZone(startTime, pacificTimeZone, 'PPp')}`;
    } else {
        updateData.interviewDateTime = Timestamp.fromDate(startTime);
        updateData.interviewType = interviewType;
        updateData.googleMeetLink = conferenceLink || null;
        updateData.finalInterviewStatus = (pathway === 'combined' ? 'Passed' : 'Pending');
        updateData.orientationScheduled = pathway === 'combined';
        if (pathway === 'combined') {
            updateData.orientationDateTime = Timestamp.fromDate(startTime);
            denormalizedStatus = "Orientation Scheduled";
            nextStepText = `Combined Session: ${formatInTimeZone(startTime, pacificTimeZone, 'PPp')}`;
        } else {
            denormalizedStatus = "Final Interview Pending";
            nextStepText = `${interviewType} Interview: ${formatInTimeZone(startTime, pacificTimeZone, 'PPp')}`;
        }
    }
    
    if (includeReferenceForm) {
      updateData.finalInterviewStatus = 'Pending reference checks';
    }

    const interviewDoc = await interviewRef.get();
    const profileId = interviewDoc.data()?.caregiverProfileId;

    await serverDb.runTransaction(async (transaction) => {
        transaction.update(interviewRef, updateData);
        if (profileId) {
            transaction.update(serverDb.collection('caregiver_profiles').doc(profileId), {
                hiringStatus: denormalizedStatus,
                nextStepText,
                nextStepTime: Timestamp.fromDate(startTime),
                lastUpdatedAt: Timestamp.now()
            });
        }
    });

    revalidatePath('/admin/manage-interviews');
    revalidatePath('/admin/advanced-search');
    
    return { message: `Next event scheduled and status synced.` };

  } catch (error: any) {
    console.error("Critical error in saveInterviewAndSchedule:", error);
    return { message: `A critical server error occurred: ${error.message}`, error: true };
  }
}

export async function rejectCandidate(payload: { 
  caregiverId: string;
  interviewId: string | null;
  reason: string;
  notes: string;
  caregiverName: string;
  caregiverEmail: string;
}) {
  const { caregiverId, interviewId, reason, notes, caregiverName, caregiverEmail } = payload;
  if (!caregiverId || !reason) {
    return { error: true, message: "Caregiver ID and reason are required." };
  }

  try {
    const firestore = serverDb;
    const batch = firestore.batch();
    const now = Timestamp.now();
    const status = (reason === "CG ghosted appointment") ? "No Show" : "Process Terminated";
    const interviewRef = interviewId ? firestore.collection('interviews').doc(interviewId) : firestore.collection('interviews').doc();
      
    const interviewPayload: any = {
        caregiverProfileId: caregiverId,
        finalInterviewStatus: status,
        rejectionReason: reason,
        rejectionNotes: notes,
        rejectionDate: now.toDate(),
        lastUpdatedAt: now,
        phoneScreenPassed: 'No',
    };

    if (interviewId) {
        batch.update(interviewRef, interviewPayload);
    } else {
        batch.set(interviewRef, { ...interviewPayload, interviewType: "Phone", interviewDateTime: now.toDate(), createdAt: now });
    }

    // SYNC STATUS TO PROFILE
    batch.update(firestore.collection('caregiver_profiles').doc(caregiverId), {
        hiringStatus: reason,
        nextStepText: 'Process Ended',
        nextStepTime: null,
        lastUpdatedAt: now
    });

    await batch.commit();
    revalidatePath('/admin/manage-interviews');
    revalidatePath('/admin/advanced-search');
    return { success: true, message: 'Candidate has been rejected and status synced.' };
  } catch (error: any) {
    return { error: true, message: `An error occurred: ${error.message}` };
  }
}

export async function initiateOnboardingForms(interviewId: string) {
  if (!interviewId) return { error: 'Interview ID is required.' };
  try {
    const interviewRef = serverDb.collection('interviews').doc(interviewId);
    const intDoc = await interviewRef.get();
    const profileId = intDoc.data()?.caregiverProfileId;

    await serverDb.runTransaction(async (transaction) => {
        transaction.update(interviewRef, {
            onboardingFormsInitiated: true,
            lastUpdatedAt: Timestamp.now(),
        });
        if (profileId) {
            transaction.update(serverDb.collection('caregiver_profiles').doc(profileId), {
                docsStatus: 'notified',
                lastUpdatedAt: Timestamp.now()
            });
        }
    });

    revalidatePath('/admin/manage-interviews');
    revalidatePath('/admin/advanced-search');
    return { success: 'Onboarding forms initiated and status synced.' };
  } catch (error: any) {
    return { error: `Failed: ${error.message}` };
  }
}
