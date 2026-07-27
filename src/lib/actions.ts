
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appointmentSchema, caregiverFormSchema } from "./types";
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { format } from "date-fns";

export async function submitCaregiverProfile(data: z.infer<typeof caregiverFormSchema>) {
  const validatedFields = caregiverFormSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: 'Invalid data submitted.' };
  }

  const { email, fullName } = validatedFields.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Check for duplicates
  const profilesRef = serverDb.collection('caregiver_profiles');
  const existingProfileQuery = await profilesRef.where('email', '==', normalizedEmail).get();

  if (!existingProfileQuery.empty) {
    const existingProfileDoc = existingProfileQuery.docs[0];
    const existingProfile = existingProfileDoc.data();
    const candidateStatus = existingProfile.hiringStatus || 'Applied';

    const isBlocked = candidateStatus === 'Applied' || candidateStatus === 'Phonescreen Invite Needed';

    if (isBlocked) {
      const applicationDate = existingProfile.createdAt.toDate();
      const formattedDate = format(applicationDate, "MMMM do, yyyy");
      return { error: `Your application was already received on ${formattedDate} and is being processed by FirstLight Homecare hiring Manager.` };
    }
  }

  // If no duplicate with "Applied" status, save new profile
  const { uid, ...dataToSave } = validatedFields.data;
  const profileRef = await profilesRef.add({
    ...dataToSave,
    email: normalizedEmail,
    fullNameLowercase: fullName.toLowerCase(),
    uid: data.uid,
    createdAt: Timestamp.now(),
    hiringStatus: 'Applied',
    docsStatus: 'not-notified',
    nextStepText: 'Needs Phone Screen',
  });

  const redirectParams = new URLSearchParams({
    caregiverId: profileRef.id,
    caregiverName: data.fullName,
    caregiverEmail: normalizedEmail,
    caregiverPhone: data.phone,
    step: 'schedule'
  });

  redirect(`/?${redirectParams.toString()}`);
}
