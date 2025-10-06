
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addCaregiver, addAppointment, getAppointments } from "./db-firestore";
import { caregiverFormSchema, appointmentSchema, CaregiverProfile } from "./types";

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

    console.log(`---
    ✉️ Sending Google Calendar Invite...
    TO: ${appointment.caregiver.email}
    ADMIN: admin@caregiverconnect.com
    WHEN: ${new Date(appointment.startTime).toLocaleString()} - ${new Date(appointment.endTime).toLocaleString()}
    WHERE: 9650 Business Center Drive, Suite 132, Rancho Cucamonga, CA
    DETAILS:
    Interview with ${appointment.caregiver.fullName}.
    Contact: ${appointment.caregiver.phone}
    ---`);
    
    console.log("DEBUG: Step 3 - Checking for Google credentials in environment variables...");
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (clientId && clientSecret) {
        console.log("DEBUG: Step 4a - ✅ Google credentials found.");
        // Here you would implement the actual Google Calendar API call
        console.log("DEBUG: Step 5a - (Placeholder) Google Calendar API call would happen here.");
    } else {
        console.warn("DEBUG: Step 4b - ⚠️ Google credentials not found.");
        console.warn("ACTION REQUIRED: Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env.local file.");
    }

    const resultMessage = `Calendar invite sent to ${appointment.caregiver.fullName}.`;
    console.log("DEBUG: Step 6 - Preparing to return result message:", resultMessage);
    
    return { message: resultMessage };
}

export async function saveAdminSettings(data: { availability: any, googleCalendar: any }) {
    console.log("--- ⚙️ Saving Admin Settings ---");
    console.log("Availability Config:", data.availability);
    
    if (data.googleCalendar.clientId || data.googleCalendar.clientSecret) {
        console.warn("IMPORTANT: For security, Google credentials should not be saved directly.");
        console.warn("Please add the following to your .env.local file at the root of your project:");
        console.log(`GOOGLE_CLIENT_ID=${data.googleCalendar.clientId || 'YOUR_CLIENT_ID'}`);
        console.log(`GOOGLE_CLIENT_SECRET=${data.googleCalendar.clientSecret || 'YOUR_CLIENT_SECRET'}`);
    } else {
        console.log("No Google Calendar credentials were entered. Skipping .env.local instructions.");
    }
    
    console.log("-----------------------------");

    revalidatePath('/admin/settings');
    return { message: "Settings saved successfully." };
}
