"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addCaregiver, addAppointment, getAppointments } from "./db";
import { caregiverFormSchema, appointmentSchema } from "./types";

const toBoolean = (value: unknown) => value === "on";

export async function submitCaregiverProfile(prevState: any, formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    
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

    const validatedFields = caregiverFormSchema.safeParse({
        ...data,
        dateOfBirth: new Date(data.dateOfBirth as string),
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
    });

    if (!validatedFields.success) {
        console.error("Validation Errors:", validatedFields.error.flatten().fieldErrors);
      return {
        message: "Invalid form data. Please check your entries.",
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const newCaregiver = addCaregiver(validatedFields.data);

    return {
      message: "Profile submitted successfully.",
      caregiverId: newCaregiver.id,
      caregiverName: newCaregiver.fullName
    };
  } catch (e) {
    console.error("Submission Error:", e);
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

    addAppointment(validatedFields.data);

    // Mock sending confirmation notification
    console.log(`---
    ✅ Appointment Scheduled!
    TO: ${validatedFields.data.caregiverEmail}
    WHAT: Interview with Caregiver Connect
    WHEN: ${validatedFields.data.startTime.toLocaleString()}
    ---`);


    revalidatePath("/admin");
    redirect(`/confirmation?time=${validatedFields.data.startTime.toISOString()}`);
}

export async function getAdminAppointments() {
    // In a real app, you'd have authentication and authorization here
    return getAppointments();
}

export async function sendCalendarInvite(appointment: any) {
    // In a real app, this would use the Google Calendar API
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
    // In a real app, this would save to a secure config store or database
    console.log("--- ⚙️ Saving Admin Settings ---");
    console.log("Availability Config:", data.availability);
    console.log("Google Calendar Config:", data.googleCalendar);
    console.log("-----------------------------");

    revalidatePath('/admin/settings');
    return { message: "Settings saved successfully." };
}
