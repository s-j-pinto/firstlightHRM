
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { caregiverFormSchema, appointmentSchema } from "./types";
import { serverDb } from "@/firebase/server-init";

export async function getAdminAppointments() {
    const appointmentsSnapshot = await serverDb.collection("appointments").get();
    const appointments = appointmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            ...data, 
            startTime: (data.startTime).toDate(),
            endTime: (data.endTime).toDate(),
        }
    });
    return appointments;
};

export async function submitCaregiverProfile(data: any) {
  console.log("Step 2 (Server): `submitCaregiverProfile` action started.");
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
    console.log("Step 2.1 (Server): Validation failed.", validatedFields.error.flatten().fieldErrors);
    throw new Error("Invalid form data.");
  }
  console.log("Step 2.2 (Server): Validation successful.");

  try {
    console.log("Step 3 (Server): Firestore DB instance obtained. Attempting to add document.");
    const docRef = await serverDb.collection("caregiver_profiles").add(validatedFields.data);
    console.log(`Step 4 (Server): Document added successfully with ID: ${docRef.id}. Preparing to redirect.`);
    
    const params = new URLSearchParams({
        caregiverId: docRef.id,
        caregiverName: validatedFields.data.fullName,
        caregiverEmail: validatedFields.data.email,
        caregiverPhone: validatedFields.data.phone,
        step: 'schedule'
    });
    
    redirect(`/?${params.toString()}`);

  } catch (e: any) {
    console.error("Step 4.1 (Server): FAILED to add document to Firestore. Error:", e);
    throw new Error("An unexpected error occurred while saving your profile.");
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
        });
    } catch (e) {
        console.error("Failed to schedule appointment:", e);
        return {
            error: "Could not schedule appointment."
        }
    }

    revalidatePath("/admin");
    
    const redirectUrl = `/confirmation?time=${validatedFields.data.startTime.toISOString()}`;
    redirect(redirectUrl);
}
