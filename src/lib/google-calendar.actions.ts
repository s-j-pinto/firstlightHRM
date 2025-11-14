

"use server";

import { revalidatePath } from "next/cache";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { serverDb } from "@/firebase/server-init";
import type { Appointment } from "./types";
import { format, toZonedTime, formatInTimeZone } from 'date-fns-tz';

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
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'lpinto@firstlighthomecare.com';
    const adminEmail = 'care-rc@firstlighthomecare.com';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    if (!clientId || !clientSecret) {
        return { message: "Google credentials not configured.", error: true };
    }

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    if (!refreshToken) {
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/calendar.events'],
        });
        return { message: "Admin authorization required for Google Calendar.", error: true, authUrl };
    }
    
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    // TEMPORARY: Override for testing
    const attendees: { email: string }[] = [{ email: 's_j_pinto@yahoo.com' }];
    
    // PRODUCTION attendees:
    // const attendees: { email: string }[] = [];
    // if (ownerEmail) attendees.push({ email: ownerEmail });
    // if (adminEmail) attendees.push({ email: adminEmail });
    // if (clientEmail) attendees.push({ email: clientEmail });
    // if (additionalEmail && additionalEmail.trim() !== '') {
    //     attendees.push({ email: additionalEmail });
    // }

    try {
        await oAuth2Client.getAccessToken(); // Ensure token is valid
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const pacificTimeZone = 'America/Los_Angeles';

        // 1. Get the date part and time part.
        const datePart = format(dateOfHomeVisit, 'yyyy-MM-dd');
        const timePart = timeOfVisit; // e.g., "14:30"
        
        // 2. Combine them into a single string.
        const dateTimeString = `${datePart} ${timePart}`;

        // 3. Format this combined string into a full ISO 8601 string *with* the correct timezone offset.
        const startDateTimeIso = formatInTimeZone(dateTimeString, pacificTimeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");

        // 4. Calculate end time based on the correct start time.
        const startDateTime = new Date(startDateTimeIso);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); // 1-hour duration
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
            <p>9650 Business Center Drive, Suite #132 | Rancho Cucamonga, CA 91730</p>
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
             const attendeeEmails = `Owner: ${ownerEmail}, Admin: ${adminEmail}, Client: ${clientEmail}, Additional: ${additionalEmail || 'N/A'}`;
             errorMessage = `Google API Error: One of the attendee emails is invalid. Please check the client and additional email fields. Attempted emails: [${attendeeEmails}]`;
        } else if (err.message?.includes('invalid_grant') || err.message?.includes('revoked')) {
            const authUrl = oAuth2Client.generateAuthUrl({
                access_type: 'offline', prompt: 'consent', scope: ['https://www.googleapis.com/auth/calendar.events'],
            });
            return { message: "Google authentication token is invalid. Please re-authorize.", error: true, authUrl };
        } else if (err.response?.data?.error?.message) {
             errorMessage = `Google API Error: ${err.response.data.error.message}`;
        } else {
             errorMessage = `Google API Error: ${err.message}`;
        }
        
        return { message: errorMessage, error: true };
    }
}
