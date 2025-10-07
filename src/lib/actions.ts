
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { caregiverFormSchema, appointmentSchema } from "./types";
import { serverDb } from '@/firebase/server-init';
import type { CaregiverProfile, Appointment } from "./types";
import { Timestamp } from 'firebase-admin/firestore';


export const addCaregiver = async (profile: Omit<CaregiverProfile, "id">): Promise<string> => {
  const caregiverData = {
    ...profile,
  };
  const docRef = await serverDb.collection("caregiver_profiles").add(caregiverData);
  return docRef.id;
};

export const getAppointments = async (): Promise<Appointment[]> => {
    const appointmentsSnapshot = await serverDb.collection("appointments").get();
    const appointments = appointmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            ...data, 
            id: doc.id,
            startTime: (data.startTime as Timestamp).toDate(),
            endTime: (data.endTime as Timestamp).toDate(),
        } as Appointment
    });
    return appointments;
};

export async function submitCaregiverProfile(data: any) {
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

  const validatedFields = caregiverFormSchema.safeParse(parsedData);

  if (!validatedFields.success) {
    console.log("Step 2 (Server): Validation failed.", validatedFields.error.flatten().fieldErrors);
    return {
      message: "Invalid form data. Please check your entries.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }
  console.log("Step 2 (Server): Validation successful.");

  try {
    console.log("Step 3 (Server): Attempting to add caregiver to database...");
    const newCaregiverId = await addCaregiver(validatedFields.data);
    console.log(`Step 4 (Server): Caregiver added with ID: ${newCaregiverId}.`);

    return {
      message: "Profile submitted successfully.",
      caregiverId: newCaregiverId,
      caregiverName: validatedFields.data.fullName
    };
  } catch (e: any) {
    console.error("Step 4 (Server): FAILED to add caregiver. Error:", e);
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
    const validatedFields = appointmentSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            error: "Invalid appointment data."
        }
    }

    try {
        await serverDb.collection("appointments").add({
            ...validatedFields.data,
            startTime: Timestamp.fromDate(validatedFields.data.startTime),
            endTime: Timestamp.fromDate(validatedFields.data.endTime),
        });
    } catch (e) {
        return {
            error: "Could not schedule appointment."
        }
    }

    revalidatePath("/admin");
    
    const redirectUrl = `/confirmation?time=${validatedFields.data.startTime.toISOString()}`;
    redirect(redirectUrl);
}

export async function getAdminAppointments() {
    const appointments = await getAppointments();
    return appointments;
}

