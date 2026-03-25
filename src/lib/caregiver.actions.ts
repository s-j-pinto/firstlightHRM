
"use server";

import { revalidatePath } from "next/cache";
import { serverDb } from "@/firebase/server-init";
import { z } from "zod";
import { generalInfoSchema } from "./types";
import { WriteBatch } from "firebase-admin/firestore";


export async function updateCaregiverProfile(
  profileId: string,
  data: z.infer<typeof generalInfoSchema>
) {
  const validatedFields = generalInfoSchema.safeParse(data);

  if (!validatedFields.success) {
    return { message: "Invalid data provided.", error: true };
  }

  try {
    const firestore = serverDb;
    const profileRef = firestore.collection("caregiver_profiles").doc(profileId);

    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) {
      return { message: "Caregiver profile not found.", error: true };
    }

    // Using set with merge for a more robust update
    await profileRef.set(validatedFields.data, { merge: true });

    revalidatePath("/admin/manage-applications");
    revalidatePath("/admin");

    return { message: "Caregiver profile updated successfully." };
  } catch (error) {
    console.error("Error updating caregiver profile:", error);
    return { message: "Failed to update profile.", error: true };
  }
}

async function findAndBatchDelete(
  batch: WriteBatch,
  collectionName: string,
  field: string,
  value: string
) {
  const snapshot = await serverDb.collection(collectionName).where(field, "==", value).get();
  snapshot.forEach(doc => batch.delete(doc.ref));
}

export async function deleteCaregiverProfile(profileId: string) {
  if (!profileId) {
    return { message: "Caregiver Profile ID is required.", error: true };
  }

  try {
    const batch = serverDb.batch();

    // Delete from caregiver_profiles
    const profileRef = serverDb.collection("caregiver_profiles").doc(profileId);
    batch.delete(profileRef);

    // Delete from interviews
    await findAndBatchDelete(batch, "interviews", "caregiverProfileId", profileId);
    
    // Delete from appointments
    await findAndBatchDelete(batch, "appointments", "caregiverId", profileId);

    // Delete from caregiver_employees
    const employeeRef = serverDb.collection("caregiver_employees").doc(profileId);
    batch.delete(employeeRef);

    await batch.commit();

    revalidatePath("/admin/manage-applications");
    return { message: "Caregiver profile and all related records deleted successfully." };
  } catch (error: any) {
    console.error("Error deleting caregiver profile:", error);
    return { message: `Failed to delete profile: ${error.message}`, error: true };
  }
}

export async function resetCaregiverInterview(profileId: string) {
  if (!profileId) {
    return { message: "Caregiver Profile ID is required.", error: true };
  }

  try {
    const batch = serverDb.batch();

    // Delete from interviews
    await findAndBatchDelete(batch, "interviews", "caregiverProfileId", profileId);

    // Delete from caregiver_employees
    const employeeRef = serverDb.collection("caregiver_employees").doc(profileId);
    batch.delete(employeeRef);

    await batch.commit();

    revalidatePath("/admin/manage-applications");
    return { message: "Caregiver interview and employment records have been reset." };
  } catch (error: any) {
    console.error("Error resetting caregiver interview:", error);
    return { message: `Failed to reset interview: ${error.message}`, error: true };
  }
}
