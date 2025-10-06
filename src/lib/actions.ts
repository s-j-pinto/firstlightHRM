
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addCaregiver, addAppointment, getAppointments } from "./db-firestore";
import { caregiverFormSchema, appointmentSchema } from "./types";

const toBoolean = (value: unknown) => value === "on";

export async function submitCaregiverProfile(prevState: any, formData: FormData) {
  console.log("Step 1: Starting caregiver profile submission.");
  try {
    const data = Object.fromEntries(formData.entries());
    console.log("Step 2: Received form data.", Object.keys(data));
    
    // Reconstruct the availability object from FormData
    const availability: Record<string, string[]> = {
        monday: formData.getAll('availability.monday') as string[],
        tuesday: formData.getAll('availability.tuesday') as string[],
        wednesday: formData.getAll('availability.wednesday') as string[],
        thursday: formData.getAll('availability.thursday') as string[],
        friday: formData.getAll('availability.friday') as string[],
        saturday: formData.getAll('availability.saturday') as string[],
        sunday: formData.getAll('availability.sunday') as string[],
    };
    console.log("Step 3: Reconstructed availability object.");

    const parsedData = {
        ...data,
        yearsExperience: Number(data.yearsExperience),
        availability: availability,
        canChangeBrief: toBoolean(data.canChangeBrief),
        canTransfer: toBoolean(data.canTransfer),
        canPrepareMeals: toBoolean(data.canPrepareMeals),
        canDoBedBath: toBoolean(data.canDoBedBath),
        canUseHoyerLift: toBoolean(data.canUseHoyerLift),
        canUseGaitBelt: toBoolean(data.canUseGaitBelt),
        canUsePurwick: toBoolean(data.canUsePurwick),
        canEmptyCatheter: toBoolean(data.canEmptyCatheter),
        canEmptyColostomyBag: toBoolean(data.canEmptyColostomyBag),
        canGiveMedication: toBoolean(data.canGiveMedication),
        canTakeBloodPressure: toBoolean(data.canTakeBloodPressure),
        hasDementiaExperience: toBoolean(data.hasDementiaExperience),
        hasHospiceExperience: toBoolean(data.hasHospiceExperience),
        hca: toBoolean(data.hca),
        hha: toBoolean(data.hha),
        cna: toBoolean(data.cna),
        liveScan: toBoolean(data.liveScan),
        negativeTbTest: toBoolean(data.negativeTbTest),
        cprFirstAid: toBoolean(data.cprFirstAid),
        canWorkWithCovid: toBoolean(data.canWorkWithCovid),
        covidVaccine: toBoolean(data.covidVaccine),
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

    console.log("Step 6: Attempting to add caregiver to Firestore...");
    const newCaregiverId = await addCaregiver(validatedFields.data);
    console.log("Step 7: Successfully added caregiver with ID:", newCaregiverId);

    return {
      message: "Profile submitted successfully.",
      caregiverId: newCaregiverId,
      caregiverName: validatedFields.data.fullName
    };
  } catch (e) {
    console.error("Submission Error during profile persistence:", e);
    return {
      message: "An unexpected error occurred.",
    };
  }
}

export async function scheduleAppointment(data: z.infer<typeof appointmentSchema>) {
    const validatedFields = appointmentSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            error: "Invalid appointment data."
        }
    }

    await addAppointment(validatedFields.data);

    revalidatePath("/admin");
    redirect(`/confirmation?time=${validatedFields.data.startTime.toISOString()}`);
}

export async function getAdminAppointments() {
    return getAppointments();
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
