"use server";

import { revalidatePath } from "next/cache";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { serverDb } from "@/firebase/server-init";
import type { Appointment } from "./types";

export async function sendCalendarInvite(appointment: Appointment & { caregiver: any }) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://9000-firebase-firstlighthrmgit-1759870304232.cluster-dcua5e7jvjesmwvkamxwtt7yac.cloudworkstations.dev/?monospaceUid=442053/admin/settings';

    if (!clientId || !clientSecret) {
        const errorMsg = "Google credentials not found. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in a `.env.local` file in the project root.";
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
        const errorMsg = "Admin authorization required. A refresh token is missing. Please authorize the application to generate one."
        return { message: errorMsg, error: true, authUrl: authUrl };
    }
    
    try {
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        
        const event = {
            summary: `FirstLight Interview with ${appointment.caregiver?.fullName}`,
            location: '9650 Business Center Drive, Suite 132, Rancho Cucamonga, CA',
            description: `Dear ${appointment.caregiver?.fullName},\nPlease bring the following documents:\n Driver's License,\nCar insurance and registration.\nSocial Security card or US passport (to prove your work eligibility, If you are green card holder, bring Green card.)\nCurrent negative TB-Test Copy,\nHCA letter or number,\nlive scan or Clearance letter if you have it.\nCPR-First Aide proof card, Any other certification that you have. \n\nContact Email: ${appointment.caregiver?.email}\nContact Phone: ${appointment.caregiver?.phone}`,
            start: {
                dateTime: new Date(appointment.startTime).toISOString(),
                timeZone: 'America/Los_Angeles',
            },
            end: {
                dateTime: new Date(appointment.endTime).toISOString(),
                timeZone: 'America/Los_Angeles',
            },
            attendees: [
                { email: 'care-rc@firstlighthomecare.com' }, 
                { email: appointment.caregiver?.email }, 
            ],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 60 },
                ],
            },
        };

        await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendNotifications: true,
        });
        
        const firestore = serverDb;
        const appointmentRef = firestore.collection('appointments').doc(appointment.id);
        await appointmentRef.update({ inviteSent: true });

        revalidatePath('/admin');
        
        const resultMessage = `Calendar invite sent to ${appointment.caregiver.fullName}.`;
        return { message: resultMessage };

    } catch (err: any) {
        let errorMessage = `Failed to send invite. Check server logs for details.`;
        if (err.response?.data?.error?.message) {
            errorMessage = `Google API Error: ${err.response.data.error.message}`;
        } else if (err.message) {
            errorMessage = `Google API Error: ${err.message}`;
        }
        
        return { message: errorMessage, error: true };
    }
}

export async function saveAdminSettings(data: { availability: any, googleAuthCode?: string }) {
    if (data.googleAuthCode) {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://9000-firebase-studio-1759770880601.cluster-cxy3ise3prdrmx53pigwexthgs.cloudworkstations.dev/admin/settings';

        if (!clientId || !clientSecret) {
            return { message: "Cannot get refresh token without Client ID and Secret in .env.local", error: true };
        }

        const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
        try {
            const { tokens } = await oAuth2Client.getToken(data.googleAuthCode);
            if (tokens.refresh_token) {
                return { 
                    message: "Refresh token obtained! Add it to your `.env.local` file and restart the server.",
                    refreshToken: tokens.refresh_token,
                };
            } else {
                 return { message: "Could not obtain refresh token. You might need to generate a new auth code.", error: true };
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.error_description || "Failed to get refresh token. Check logs.";
            return { message: errorMessage, error: true };
        }
    }
    
    // Here you would save the `data.availability` to a database or config file.
    // For now, we'll just log it and return a success message.
    console.log("Availability settings received:", data.availability);
    
    revalidatePath('/admin/settings');
    
    return { 
        message: "Settings saved successfully." 
    };
}
