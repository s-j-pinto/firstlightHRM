
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { caregiverFormSchema } from "./types";
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

    const isBlocked = candidateStatus === 'Applied' || candidateStatus === 'Phonescreen Invite Needed' || candidateStatus === 'Phonescreen Scheduled';

    if (isBlocked) {
      const applicationDate = existingProfile.createdAt.toDate();
      const formattedDate = format(applicationDate, "MMMM do, yyyy");
      return { error: `Your application was already received on ${formattedDate} and is being processed by FirstLight Homecare hiring Manager.` };
    }
  }

  // If no duplicate with active status, save new profile
  const { uid, ...dataToSave } = validatedFields.data;
  const now = Timestamp.now();
  
  const profileRef = await profilesRef.add({
    ...dataToSave,
    email: normalizedEmail,
    fullNameLowercase: fullName.toLowerCase(),
    uid: data.uid,
    createdAt: now,
    hiringStatus: 'Applied',
    docsStatus: 'not-notified',
    nextStepText: 'Needs Phone Screen',
  });

  // --- Send Internal Notification ---
  const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || 'lpinto@firstlighthomecare.com';
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
  const hrAssistEmail = "hr_assist@firstlighthomecare.com";
  const internalRecipients = [ownerEmail, adminEmail, hrAssistEmail].filter(Boolean) as string[];

  if (internalRecipients.length > 0) {
      const emailHtml = `
          <body style="font-family: sans-serif; line-height: 1.6;">
              <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                  <h1 style="color: #333;">New Caregiver Application</h1>
                  <p>A new candidate has submitted an application via the caregiver portal.</p>
                  
                  <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                      <h2 style="margin-top: 0; color: #555;">Candidate Details</h2>
                      <p><strong>Name:</strong> ${fullName}</p>
                      <p><strong>Email:</strong> ${normalizedEmail}</p>
                      <p><strong>Phone:</strong> ${data.phone}</p>
                      <p><strong>Experience:</strong> ${data.yearsExperience} years</p>
                  </div>

                  <p>Please log in to the <strong>Phonescreen Dashboard</strong> to review their profile and send a calendar invitation.</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                      <a href="https://care-connect-360--firstlighthomecare-hrm.us-central1.hosted.app/admin/advanced-search" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
                          Go to Phonescreen Dashboard
                      </a>
                  </div>
              </div>
          </body>
      `;

      await serverDb.collection('mail').add({
          to: internalRecipients,
          message: {
              subject: `New Caregiver Application: ${fullName}`,
              html: emailHtml,
          },
      });
  }

  const redirectParams = new URLSearchParams({
    caregiverId: profileRef.id,
    caregiverName: data.fullName,
    caregiverEmail: normalizedEmail,
    caregiverPhone: data.phone,
    step: 'schedule'
  });

  redirect(`/?${redirectParams.toString()}`);
}
