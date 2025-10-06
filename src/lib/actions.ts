"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { addCaregiver, addAppointment, getAppointments } from "./db";
import { caregiverFormSchema, appointmentSchema } from "./types";

export async function submitCaregiverProfile(prevState: any, formData: FormData) {
  try {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = caregiverFormSchema.safeParse({
        ...data,
        dateOfBirth: new Date(data.dateOfBirth as string),
        yearsExperience: Number(data.yearsExperience),
        cprCertified: data.cprCertified === "on",
        specializations: formData.getAll('specializations'),
        availableDays: formData.getAll('availableDays'),
    });

    if (!validatedFields.success) {
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
