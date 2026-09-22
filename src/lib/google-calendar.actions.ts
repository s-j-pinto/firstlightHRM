
"use server";

import { revalidatePath } from "next/cache";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { serverDb } from "@/firebase/server-init";
import type { Appointment } from "./types";
import { format, toZonedTime, formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const getRedirectUri = () => {
    // Priority 1: Explicitly set redirect URI
    if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
    
    // Priority 2: Use the public base URL if defined (works for both local and production)
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (baseUrl) {
        return `${baseUrl.replace(/\/$/, '')}/admin/settings`;
    }

    // Priority 3: Fallback for local development environment
    return `http://localhost:9002/admin/settings`;
};

/**
 * Generates a fresh Google Authorization URL.
 * This is used to manually trigger the OAuth flow if the token needs to be changed.
 */
export async function generateGoogleAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = getRedirectUri();

    if (!clientId || !clientSecret) {
        return { 
            error: "Google Credentials (ID/Secret) are not configured in environment variables. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in your secrets or .env.local file." 
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
 * Note: To switch the primary calendar, you must generate a new GOOGLE_REFRESH_TOKEN 
 * while logged into the desired Google account (lpinto@firstlighthomecare.com).
 */
export async function sendCalendarInvite(appointment: Appointment & { caregiver: any }) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = getRedirectUri();

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
        await oAuth2Client.getAccessToken(); // This also validates the refresh token

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
            const result = await generateGoogleAuthUrl();
            return {
                message: "Your Google authentication token is invalid or has expired. Please re-authorize in Admin Settings.",
                error: true,
                authUrl: result.authUrl
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
    const redirectUri = getRedirectUri();

    if (!clientId || !clientSecret) {
        return { message: "Cannot get refresh token: Client ID or Secret is missing from environment.", error: true };
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
             return { message: "Google did not return a refresh token. You may need to revoke access first at https://myaccount.google.com/permissions.", error: true };
        }
    } catch (error: any) {
        console.error("Error in saveAdminSettings:", error);
        const errorMessage = error.response?.data?.error_description || error.message || "Failed to exchange code for token.";
        return { message: errorMessage, error: true };
    }
}


interface HomeVisitPayload {
    clientName: string;
    clientAddress: string;
    clientEmail: string;
    additionalEmail?: string | null;
    dateOfHomeVisit: Date;
    timeOfVisit: string;
}

export async function sendHomeVisitInvite(payload: HomeVisitPayload) {
    const { clientName, clientAddress, clientEmail, additionalEmail, dateOfHomeVisit, timeOfVisit } = payload;
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const ownerEmail = 'lpinto@firstlighthomecare.com';
    const redirectUri = getRedirectUri();

    if (!clientId || !clientSecret) {
        return { message: "Google credentials not configured.", error: true };
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    if (!refreshToken) {
        const result = await generateGoogleAuthUrl();
        return { message: "Admin authorization required for Google Calendar.", error: true, authUrl: result.authUrl };
    }
    
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    // Dynamically build the list of attendees
    const attendees: { email: string }[] = [];
    if (ownerEmail) attendees.push({ email: ownerEmail });
    if (clientEmail) attendees.push({ email: clientEmail });
    if (additionalEmail && additionalEmail.trim() !== '') {
        attendees.push({ email: additionalEmail });
    }

    try {
        await oAuth2Client.getAccessToken(); // Ensure token is valid
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const pacificTimeZone = 'America/Los_Angeles';

        const datePart = format(dateOfHomeVisit, 'yyyy-MM-dd');
        const dateTimeString = `${datePart}T${timeOfVisit}`;
        
        const zonedStartTime = fromZonedTime(dateTimeString, pacificTimeZone);
        const endDateTime = new Date(zonedStartTime.getTime() + 60 * 60 * 1000); // 1-hour duration
        
        const startDateTimeIso = zonedStartTime.toISOString();
        const endDateTimeIso = endDateTime.toISOString();

        const signatureHtml = `
            <br><br><br>
            <p>Best Wishes,</p>
            <p>
                <strong>Lolita Pinto</strong><br>
                Owner<br>
                Managing Director<br>
                Office (909)-321-4466<br>
                Fax (909)-694-2474
            </p>
            <p>CALIFORNIA HCO LICENSE # 364700059</p>
            <p>9650 Business Center Drive, Suite #113 | Rancho Cucamonga, CA 91730</p>
            <br>
            <img src="${logoUrl}" alt="FirstLight Home Care Logo" style="width: 200px; height: auto;"/>
            <br><br>
            <p style="font-size: 10px; color: #888;">
                <strong>CONFIDENTIALITY NOTICE</strong><br>
                This email, including any attachments or files transmitted with it, is intended to be confidential and solely for the use of the individual or entity to whom it is addressed. If you received it in error, or if you are not the intended recipient(s), please notify the sender by reply e-mail and delete/destroy the original message and any attachments, and any copies. Any unauthorized review, use, disclosure or distribution of this e-mail or information is prohibited and may be a violation of applicable laws.
            </p>
        `;

        const event = {
            summary: `Home Visit with ${clientName}`,
            location: clientAddress,
            description: `In-home assessment and consultation for ${clientName}.${signatureHtml}`,
            start: {
                dateTime: startDateTimeIso,
                timeZone: pacificTimeZone,
            },
            end: {
                dateTime: endDateTimeIso,
                timeZone: pacificTimeZone,
            },
            attendees: attendees,
            reminders: {
                useDefault: false,
                overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 120 }],
            },
        };

        await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendNotifications: true,
        });

        return { message: "Home visit calendar invite sent successfully." };

    } catch (err: any) {
        console.error("Error sending home visit invite:", err);
        
        let errorMessage = `Failed to send invite. Check server logs.`;
        if (err.message?.includes('Invalid attendee')) {
             const attendeeEmails = `Owner: ${ownerEmail}, Client: ${clientEmail}, Additional: ${additionalEmail || 'N/A'}`;
             errorMessage = `Google API Error: One of the attendee emails is invalid. Please check the client and additional email fields. Attempted emails: [${attendeeEmails}]`;
        } else if (err.message?.includes('invalid_grant') || err.message?.includes('revoked')) {
            const result = await generateGoogleAuthUrl();
            return { message: "Google authentication token is invalid. Please re-authorize.", error: true, authUrl: result.authUrl };
        } else if (err.response?.data?.error?.message) {
             errorMessage = `Google API Error: ${err.response.data.error.message}`;
        } else {
             errorMessage = `Google API Error: ${err.message}`;
        }
        
        return { message: errorMessage, error: true };
    }
}
