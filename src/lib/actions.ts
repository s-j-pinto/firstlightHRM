
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addCaregiver, addAppointment } from "./db-firestore";
import { caregiverFormSchema, appointmentSchema } from "./types";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { getAppointments as dbGetAppointments } from "./db-firestore";

export async function submitCaregiverProfile(data: any) {
  console.log("Step 1: Starting caregiver profile submission.");
  
  console.log("Step 2: Received raw data object:", JSON.stringify(data, null, 2));
  
  const parsedData = {
      ...data,
      yearsExperience: Number(data.yearsExperience || 0),
      canChangeBrief: !!data.canChangeBrief,
      canTransfer: !!data.canTransfer,
      canPrepareMeals: !!data.canPrepareMeals,
      canDoBedBath: !!data.canDoBedBath,
      canUseHoyerLift: !!data.canUseHoyerLift,
      canUseGaitBelt: !!data.canUseGaitBelt,
      canUsePurwick: !!data.canUsePurwick,
      canEmptyCatheter: !!data.canEmptyCatheter,
      canEmptyColostomyBag: !!data.canEmptyColostomyBag,
      canGiveMedication: !!data.canGiveMedication,
      canTakeBloodPressure: !!data.canTakeBloodPressure,
      hasDementiaExperience: !!data.hasDementiaExperience,
      hasHospiceExperience: !!data.hasHospiceExperience,
      hca: !!data.hca,
      hha: !!data.hha,
      cna: !!data.cna,
      liveScan: !!data.liveScan,
      negativeTbTest: !!data.negativeTbTest,
      cprFirstAid: !!data.cprFirstAid,
      canWorkWithCovid: !!data.canWorkWithCovid,
      covidVaccine: !!data.covidVaccine,
  };
  console.log("Step 3: Parsed and transformed form data for validation.");

  const validatedFields = caregiverFormSchema.safeParse(parsedData);

  if (!validatedFields.success) {
    console.error("Step 4 FAILED: Validation Errors:", validatedFields.error.flatten().fieldErrors);
    return {
      message: "Invalid form data. Please check your entries.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  console.log("Step 4: Form data validated successfully.");

  try {
    console.log("Step 5: Attempting to add caregiver to Firestore...");
    const newCaregiverId = await addCaregiver(validatedFields.data);
    console.log("Step 6: Successfully added caregiver with ID:", newCaregiverId);

    return {
      message: "Profile submitted successfully.",
      caregiverId: newCaregiverId,
      caregiverName: validatedFields.data.fullName
    };
  } catch (e) {
    console.error("Step 7 FAILED: An unexpected error occurred during submission.", e);
    if (e instanceof Error && 'code' in e) {
        console.error("Firestore error code:", (e as any).code);
        console.error("Firestore error message:", e.message);
    }
    return {
      message: "An unexpected error occurred while saving your profile.",
    };
  }
}

export async function scheduleAppointment(data: z.infer<typeof appointmentSchema>) {
    console.log("Step A: Starting appointment scheduling.");
    const validatedFields = appointmentSchema.safeParse(data);

    if (!validatedFields.success) {
        console.error("Step B FAILED: Validation Errors:", validatedFields.error.flatten().fieldErrors);
        return {
            error: "Invalid appointment data."
        }
    }
    console.log("Step B: Appointment data validated successfully.");

    try {
        console.log("Step C: Attempting to add appointment to Firestore...");
        await addAppointment(validatedFields.data);
        console.log("Step D: Successfully added appointment.");
    } catch (e) {
        console.error("Step E FAILED: An unexpected error occurred during appointment scheduling.", e);
        // Handle or rethrow error as needed
        return {
            error: "Could not schedule appointment."
        }
    }

    revalidatePath("/admin");
    console.log("Step F: Revalidated admin path.");
    
    const redirectUrl = `/confirmation?time=${validatedFields.data.startTime.toISOString()}`;
    console.log("Step G: Redirecting to", redirectUrl);
    redirect(redirectUrl);
}

export async function getAdminAppointments() {
    console.log("Fetching admin appointments...");
    const appointments = await dbGetAppointments();
    console.log(`Found ${appointments.length} appointments.`);
    return appointments;
}

export async function sendCalendarInvite(appointment: any) {
    console.log("SERVER: [1/10] `sendCalendarInvite` action started.");
    console.log("SERVER: [2/10] Received appointment data:", JSON.stringify(appointment, null, 2));

    console.log("SERVER: [3/10] Reading Google credentials from environment variables...");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    if (!clientId || !clientSecret) {
        const errorMsg = "Google credentials not found. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in a `.env.local` file in the project root.";
        console.error("SERVER: [FAIL] ", errorMsg);
        return { message: errorMsg, error: true };
    }
    console.log("SERVER: [4/10] ✅ Google Client ID and Secret found.");

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    if (refreshToken) {
        console.log("SERVER: [5/10] ✅ Refresh token found. Setting credentials on OAuth2 client.");
        oAuth2Client.setCredentials({ refresh_token: refreshToken });
    } else {
        console.warn("SERVER: [FAIL] ⚠️ No refresh token found.");
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/calendar.events'],
        });
        const errorMsg = "Admin authorization required. A refresh token is missing. Please follow the steps to authorize the application."
        console.log("ACTION REQUIRED: Authorization URL generated for client.", authUrl);
        return { message: errorMsg, error: true, authUrl: authUrl };
    }
    
    try {
        console.log("SERVER: [6/10] Initializing Google Calendar API client...");
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        
        console.log("SERVER: [7/10] Preparing calendar event details...");
        const event = {
            summary: `Interview with ${appointment.caregiver?.fullName}`,
            location: '9650 Business Center Drive, Suite 132, Rancho Cucamonga, CA',
            description: `In-person interview with caregiver candidate ${appointment.caregiver?.fullName}. \nContact Email: ${appointment.caregiver?.email}\nContact Phone: ${appointment.caregiver?.phone}`,
            start: {
                dateTime: new Date(appointment.startTime).toISOString(),
                timeZone: 'America/Los_Angeles',
            },
            end: {
                dateTime: new Date(appointment.endTime).toISOString(),
                timeZone: 'America/Los_Angeles',
            },
            attendees: [
                { email: 'swasthllc@gmail.com' }, 
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

        console.log("SERVER: [8/10] Sending request to Google Calendar API to create event...");
        await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendNotifications: true,
        });
        console.log("SERVER: [9/10] ✅ Successfully created calendar event.");
        
        const resultMessage = `Calendar invite sent to ${appointment.caregiver.fullName}.`;
        console.log("SERVER: [10/10] Returning success message to client:", resultMessage);
        return { message: resultMessage };

    } catch (err: any) {
        console.error("SERVER: [FAIL] Error during Google Calendar operation:", err);
        let errorMessage = `Failed to send invite. Check server logs for details.`;
        if (err.response?.data?.error) {
            console.error("Google API Error Details:", err.response.data.error);
            errorMessage = `Google API Error: ${err.response.data.error.message}`;
        }
        return { message: errorMessage, error: true };
    }
}

export async function saveAdminSettings(data: { availability: any, googleAuthCode?: string }) {
    console.log("--- ⚙️ Saving Admin Settings ---");
    
    if (data.googleAuthCode) {
        console.log("Received Google Auth Code:", data.googleAuthCode);
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

        if (!clientId || !clientSecret) {
            return { message: "Cannot get refresh token without Client ID and Secret in .env.local", error: true };
        }

        const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
        try {
            const { tokens } = await oAuth2Client.getToken(data.googleAuthCode);
            if (tokens.refresh_token) {
                console.log('✅ GOT REFRESH TOKEN! ✅');
                console.log('--- COPY AND PASTE THIS INTO YOUR .env.local FILE ---');
                console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
                console.log('----------------------------------------------------');
                return { 
                    message: "Refresh token obtained! Add it to your .env.local file and restart the server.",
                    refreshToken: tokens.refresh_token,
                };
            } else {
                 return { message: "Could not obtain refresh token. You might need to generate a new auth code.", error: true };
            }
        } catch (error: any) {
            console.error("Error while retrieving access token", error);
            const errorMessage = error.response?.data?.error_description || "Failed to get refresh token. Check logs.";
            return { message: errorMessage, error: true };
        }
    }
    
    console.log("Availability settings logged. In a real app, you would save this to a database.");
    
    revalidatePath('/admin/settings');
    
    return { 
        message: "Availability settings updated." 
    };
}

    