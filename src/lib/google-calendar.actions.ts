
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
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    if (!clientId || !clientSecret) {
        const errorMsg = "Google credentials not found. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.";
        return { message: errorMsg, error: true };
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    if (!refreshToken) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/calendar.events'],
        });
        const errorMsg = "Admin authorization required. A refresh token is missing. Please authorize the application to generate one."
        return { message: errorMsg, error: true, authUrl: authUrl };
    }
    
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    
    try {
        await oAuth2Client.getAccessToken(); // This also validates the refresh token

        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        
        const event = {
            summary: `Phone Interview FirstLight with ${appointment.caregiver?.fullName} call @ ${appointment.caregiver?.phone}`,
            location: '9650 Business Center Drive, Suite 132, Rancho Cucamonga, CA',
            description: `Dear ${appointment.caregiver?.fullName},\nPlease block an hour for phone interview with FirstLightHomeCare Office Administrator. \n\nContact Email: ${appointment.caregiver?.email}\nContact Phone: ${appointment.caregiver?.phone}`,
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
        
        return { message: `Calendar invite sent to ${appointment.caregiver.fullName}.` };

    } catch (err: any) {
        console.error("Error sending Google Calendar invite:", err);
        let errorMessage = `Failed to send invite. Check server logs for details.`;
        
        if (err.message?.includes('invalid_grant') || err.message?.includes('revoked')) {
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
        }

        if (err.response?.data?.error?.message) {
            errorMessage = `Google API Error: ${err.response.data.error.message}`;
        } else if (err.message) {
            errorMessage = `Google API Error: ${err.message}`;
        }
        
        return { message: errorMessage, error: true };
    }
}

export async function saveAdminSettings({ googleAuthCode }: { googleAuthCode: string }) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    if (!clientId || !clientSecret) {
        return { message: "Cannot get refresh token without Client ID and Secret in .env.local", error: true };
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    try {
        const { tokens } = await oAuth2Client.getToken(googleAuthCode);
        if (tokens.refresh_token) {
            return { 
                message: "Refresh token obtained! Add it to your `.env.local` file and restart the server.",
                refreshToken: tokens.refresh_token,
            };
        } else {
             return { message: "Could not obtain refresh token. You might need to generate a new auth code.", error: true };
        }
    } catch (error: any) {
        console.error("Error in saveAdminSettings:", error);
        const errorMessage = error.response?.data?.error_description || "Failed to get refresh token. Check logs.";
        return { message: errorMessage, error: true };
    }
}
