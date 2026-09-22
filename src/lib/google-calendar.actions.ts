
"use server";

import { revalidatePath } from "next/cache";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { serverDb } from "@/firebase/server-init";
import type { Appointment } from "./types";
import { format, toZonedTime, formatInTimeZone, fromZonedTime } from 'date-fns-tz';

/**
 * Standardized helper to determine the redirect URI.
 * Consistent across all Google API interactions.
 */
export async function getRedirectUri() {
    // Priority 1: Explicitly set redirect URI (useful for overrides)
    if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
    
    // Priority 2: Use the public base URL origin
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (baseUrl) {
        try {
            // We use the origin (e.g., https://app.com) to avoid path restrictions in Cloud Console
            return new URL(baseUrl).origin;
        } catch (e) {
            return baseUrl.replace(/\/$/, '');
        }
    }

    // Priority 3: Fallback for local development environment
    return `http://localhost:3000`;
};

/**
 * Generates a fresh Google Authorization URL.
 */
export async function generateGoogleAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = await getRedirectUri();

    if (!clientId || !clientSecret) {
        const missing = !clientId ? 'GOOGLE_CLIENT_ID' : 'GOOGLE_CLIENT_SECRET';
        return { 
            error: `Missing ${missing}. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your apphosting.yaml file.` 
        };
    }

    try {
        const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/calendar.events'],
        });

        return { authUrl };
    } catch (e: any) {
        return { error: `Failed to create auth client: ${e.message}` };
    }
}

/**
 * Sends a Google Calendar invite for a phone interview.
 * If an event already exists, it updates it instead of creating a new one.
 */
export async function sendCalendarInvite(appointment: Appointment & { caregiver: any }) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = await getRedirectUri();

    if (!clientId || !clientSecret) {
        const errorMsg = "Google credentials (ID/Secret) not found in environment.";
        return { message: errorMsg, error: true };
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    if (!refreshToken) {
        const result = await generateGoogleAuthUrl();
        const errorMsg = "Admin authorization required. Please go to Admin Settings to authorize Google Calendar."
        return { message: errorMsg, error: true, authUrl: result.authUrl };
    }
    
    oAuth2Client.setCredentials({ refresh_token: refreshToken });
    
    try {
        await oAuth2Client.getAccessToken();

        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        
        const event = {
            summary: `Phone Interview FirstLight with ${appointment.caregiver?.fullName} call @ ${appointment.caregiver?.phone}`,
            location: 'Phone Interview',
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
                { email: 'lpinto@firstlighthomecare.com' }, 
                { email: 'hr_assist@firstlighthomecare.com' },
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

        let finalEventId = appointment.googleEventId;

        if (finalEventId) {
            // Update existing event
            await calendar.events.update({
                calendarId: 'primary',
                eventId: finalEventId,
                requestBody: event,
            });
        } else {
            // Create new event
            const res = await calendar.events.insert({
                calendarId: 'primary',
                requestBody: event,
                sendNotifications: true,
            });
            finalEventId = res.data.id || undefined;
        }
        
        const firestore = serverDb;
        const appointmentRef = firestore.collection('appointments').doc(appointment.id);
        
        const updateData: any = { inviteSent: true };
        if (finalEventId) {
            updateData.googleEventId = finalEventId;
        }
        
        await appointmentRef.update(updateData);

        revalidatePath('/admin');
        
        return { message: `Calendar invite ${appointment.googleEventId ? 'updated' : 'sent'} for ${appointment.caregiver.fullName}.` };

    } catch (err: any) {
        console.error("Error sending Google Calendar invite:", err);
        
        if (err.message?.includes('invalid_grant') || err.message?.includes('revoked')) {
            const result = await generateGoogleAuthUrl();
            return {
                message: "Your Google authentication token is invalid or has expired. Please re-authorize in Admin Settings.",
                error: true,
                authUrl: result.authUrl
            };
        }

        return { message: `Google API Error: ${err.message}`, error: true };
    }
}

export async function saveAdminSettings({ googleAuthCode }: { googleAuthCode: string }) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = await getRedirectUri();

    if (!clientId || !clientSecret) {
        return { message: "Cannot get refresh token: Client ID or Secret is missing.", error: true };
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    try {
        const { tokens } = await oAuth2Client.getToken(googleAuthCode);
        if (tokens.refresh_token) {
            return { 
                message: "Refresh token obtained! Copy the value below, add it to your environment secrets as GOOGLE_REFRESH_TOKEN, and redeploy.",
                refreshToken: tokens.refresh_token,
            };
        } else {
             return { message: "Google did not return a refresh token. You may need to revoke access first.", error: true };
        }
    } catch (error: any) {
        console.error("Error in saveAdminSettings:", error);
        return { message: error.message || "Failed to exchange code for token.", error: true };
    }
}

export async function sendHomeVisitInvite(payload: { clientName: string; clientAddress: string; clientEmail: string; additionalEmail?: string | null; dateOfHomeVisit: Date; timeOfVisit: string; }) {
    const { clientName, clientAddress, clientEmail, additionalEmail, dateOfHomeVisit, timeOfVisit } = payload;
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = await getRedirectUri();

    if (!clientId || !clientSecret) {
        return { message: "Google credentials not configured.", error: true };
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    if (!refreshToken) {
        const result = await generateGoogleAuthUrl();
        return { message: "Admin authorization required.", error: true, authUrl: result.authUrl };
    }
    
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        await oAuth2Client.getAccessToken();
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const pacificTimeZone = 'America/Los_Angeles';

        const datePart = format(dateOfHomeVisit, 'yyyy-MM-dd');
        const dateTimeString = `${datePart}T${timeOfVisit}`;
        const zonedStartTime = fromZonedTime(dateTimeString, pacificTimeZone);
        const endDateTime = new Date(zonedStartTime.getTime() + 60 * 60 * 1000);

        const attendees = [{ email: 'lpinto@firstlighthomecare.com' }, { email: clientEmail }];
        if (additionalEmail) attendees.push({ email: additionalEmail });

        await calendar.events.insert({
            calendarId: 'primary',
            requestBody: {
                summary: `Home Visit with ${clientName}`,
                location: clientAddress,
                description: `In-home assessment and consultation for ${clientName}.`,
                start: { dateTime: zonedStartTime.toISOString(), timeZone: pacificTimeZone },
                end: { dateTime: endDateTime.toISOString(), timeZone: pacificTimeZone },
                attendees: attendees,
                reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 120 }] },
            },
            sendNotifications: true,
        });

        return { message: "Home visit calendar invite sent successfully." };

    } catch (err: any) {
        console.error("Error sending home visit invite:", err);
        return { message: `Google API Error: ${err.message}`, error: true };
    }
}
