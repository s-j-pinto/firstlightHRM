
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addCaregiver, addAppointment, getAppointments } from "./db-firestore";
import { caregiverFormSchema, appointmentSchema, CaregiverProfile } from "./types";

export async function submitCaregiverProfile(data: z.infer<typeof caregiverFormSchema>) {
  console.log("Step 1: Starting caregiver profile submission.");
  
  // The data is already a JS object, no need for Object.fromEntries
  console.log("Step 2: Received data object:", data);
  
  // No need to reconstruct availability, it's already an object
  console.log("Step 3: Availability object is already structured:", data.availability);

  // Booleans are already booleans, no need for toBoolean
  const parsedData = {
      ...data,
      yearsExperience: Number(data.yearsExperience),
  };
  console.log("Step 4: Parsed and transformed form data for validation.");

  const validatedFields = caregiverFormSchema.safeParse(parsedData);

  if (!validatedFields.success) {
    console.error("Step 5 FAILED: Validation Errors:", validatedFields.error.flatten().fieldErrors);
    return {
      message: "Invalid form data. Please check your entries.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  console.log("Step 5: Form data validated successfully.");

  try {
    console.log("Step 6: Attempting to add caregiver to Firestore...");
    const newCaregiverId = await addCaregiver(validatedFields.data);
    console.log("Step 7: Successfully added caregiver with ID:", newCaregiverId);

    return {
      message: "Profile submitted successfully.",
      caregiverId: newCaregiverId,
      caregiverName: validatedFields.data.fullName
    };
  } catch (e) {
    console.error("Step 8 FAILED: An unexpected error occurred during submission.", e);
    // Check if it's a Firestore error and log more details
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

    console.log("Step C: Attempting to add appointment to Firestore...");
    await addAppointment(validatedFields.data);
    console.log("Step D: Successfully added appointment.");

    revalidatePath("/admin");
    console.log("Step E: Revalidated admin path.");
    
    const redirectUrl = `/confirmation?time=${validatedFields.data.startTime.toISOString()}`;
    console.log("Step F: Redirecting to", redirectUrl);
    redirect(redirectUrl);
}

export async function getAdminAppointments() {
    console.log("Fetching admin appointments...");
    const appointments = await getAppointments();
    console.log(`Found ${appointments.length} appointments.`);
    return appointments;
}

export async function sendCalendarInvite(appointment: any) {
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

    return { message: `Calendar invite sent to ${appointment.caregiver.fullName}.` };
}

export async function saveAdminSettings(data: { availability: any, googleCalendar: any }) {
    console.log("--- ⚙️ Saving Admin Settings ---");
    console.log("Availability Config:", data.availability);
    console.log("Google Calendar Config:", data.googleCalendar);
    console.log("-----------------------------");

    revalidatePath('/admin/settings');
    return { message: "Settings saved successfully." };
}
