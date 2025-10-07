
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { caregiverFormSchema, appointmentSchema } from "./types";
import type { CaregiverProfile, Appointment } from "./types";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, Timestamp as ClientTimestamp } from 'firebase/firestore';
import { firebaseConfig } from "@/firebase/config";

// Helper to initialize Firebase app on the server, reusing the instance if it exists.
const getFirebaseApp = () => {
  if (getApps().length) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
};

export const getAppointments = async (): Promise<Appointment[]> => {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    const appointmentsSnapshot = await getDocs(collection(db, "appointments"));
    const appointments = appointmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            ...data, 
            id: doc.id,
            startTime: (data.startTime as ClientTimestamp).toDate(),
            endTime: (data.endTime as ClientTimestamp).toDate(),
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
    console.log("Validation failed.", validatedFields.error.flatten().fieldErrors);
    return {
      message: "Invalid form data. Please check your entries.",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const app = getFirebaseApp();
    const db = getFirestore(app);
    const docRef = await addDoc(collection(db, "caregiver_profiles"), validatedFields.data);
    
    // Redirect to the scheduling page with the new caregiver's info in query params
    const params = new URLSearchParams({
        caregiverId: docRef.id,
        caregiverName: validatedFields.data.fullName,
        caregiverEmail: validatedFields.data.email,
        caregiverPhone: validatedFields.data.phone,
        step: 'schedule'
    });
    
    redirect(`/?${params.toString()}`);

  } catch (e: any) {
    console.error("FAILED to add caregiver. Error:", e);
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
        const app = getFirebaseApp();
        const db = getFirestore(app);
        await addDoc(collection(db, "appointments"), {
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

export async function getAdminAppointments() {
    const appointments = await getAppointments();
    return appointments;
}
