
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addCaregiver, addAppointment, getAppointments } from "./db-firestore";
import { caregiverFormSchema, appointmentSchema, CaregiverProfile } from "./types";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

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
    const appointments = await getAppointments();
    console.log(`Found ${appointments.length} appointments.`);
    return appointments;
}

export async function sendCalendarInvite(appointment: any) {
    console.log("DEBUG: Step 1 - `sendCalendarInvite` action started.");
    console.log("DEBUG: Step 2 - Received appointment data:", JSON.stringify(appointment, null, 2));

    console.log("DEBUG: Step 3 - Checking for Google credentials in environment variables...");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002';

    if (!clientId || !clientSecret) {
        const errorMsg = "⚠️ Google credentials not found. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env.local file via the Admin Settings page.";
        console.error("DEBUG: Step 4b -", errorMsg);
        return { message: errorMsg, error: true };
    }
    console.log("DEBUG: Step 4a - ✅ Google credentials found.");

    const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
    
    if (refreshToken) {
        console.log("DEBUG: Step 5a - Found refresh token. Setting credentials.");
        oAuth2Client.setCredentials({ refresh_token: refreshToken });
    } else {
        console.warn("DEBUG: Step 5b - ⚠️ No refresh token found.");
        const authUrl = oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/calendar'],
        });
        console.log("ACTION REQUIRED: Please authorize this app by visiting this URL:");
        console.log(authUrl);
        console.log("After authorization, you will be redirected with a 'code' in the URL. You need to create a GOOGLE_REFRESH_TOKEN. This is a one-time setup. A more advanced implementation would handle this OAuth2 flow automatically.");
        return { message: "Admin authorization required. Please check server logs." };
    }
    
    try {
        console.log("DEBUG: Step 6 - Refreshing access token.");
        const { token } = await oAuth2Client.getAccessToken();
        if (!token) throw new Error("Failed to retrieve access token.");
        oAuth2Client.setCredentials({ access_token: token });
        console.log("DEBUG: Step 7 - Access token refreshed successfully.");

        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        
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
                { email: 'swasthllc@gmail.com' }, // Admin/Organizer
                { email: appointment.caregiver?.email }, // Caregiver
            ],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'email', minutes: 24 * 60 },
                    { method: 'popup', minutes: 60 },
                ],
            },
        };

        console.log("DEBUG: Step 8 - Creating calendar event with details:", JSON.stringify(event, null, 2));
        await calendar.events.insert({
            calendarId: 'primary',
            requestBody: event,
            sendNotifications: true,
        });
        console.log("DEBUG: Step 9 - ✅ Successfully created calendar event.");
        
        const resultMessage = `Calendar invite sent to ${appointment.caregiver.fullName}.`;
        console.log("DEBUG: Step 10 - Preparing to return result message:", resultMessage);
        return { message: resultMessage };

    } catch (err) {
        console.error("DEBUG: Step 9 FAILED - Error creating calendar event:", err);
        return { message: `Failed to send invite. Check server logs for details.`, error: true };
    }
}

export async function saveAdminSettings(data: { availability: any, googleCalendar: any }) {
    console.log("--- ⚙️ Saving Admin Settings ---");
    console.log("Availability Config:", data.availability);
    
    let envFileContent = "";

    if (data.googleCalendar.clientId) {
      envFileContent += `GOOGLE_CLIENT_ID=${data.googleCalendar.clientId}\n`;
    }
    if (data.googleCalendar.clientSecret) {
      envFileContent += `GOOGLE_CLIENT_SECRET=${data.googleCalendar.clientSecret}\n`;
    }
    if (data.googleCalendar.refreshToken) {
      envFileContent += `GOOGLE_REFRESH_TOKEN=${data.googleCalendar.refreshToken}\n`;
    }

    if (envFileContent) {
        console.warn("IMPORTANT: For security, Google credentials should not be saved directly in the database.");
        console.warn("Please add the following lines to a .env.local file at the root of your project:");
        console.log("--- .env.local ---");
        console.log(envFileContent.trim());
        console.log("--------------------");
    } else {
        console.log("No new Google Calendar credentials were entered. Skipping .env.local instructions.");
    }
    
    console.log("-----------------------------");

    revalidatePath('/admin/settings');
    return { message: "Settings saved successfully." };
}
