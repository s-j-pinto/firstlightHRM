
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

  const { email } = validatedFields.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Check for duplicates
  const profilesRef = serverDb.collection('caregiver_profiles');
  const existingProfileQuery = await profilesRef.where('email', '==', normalizedEmail).get();

  if (!existingProfileQuery.empty) {
    const existingProfileDoc = existingProfileQuery.docs[0];
    const existingProfile = existingProfileDoc.data();

    // Now check if this profile is in "Applied" or "Phonescreen Invite Needed" status
    const appointmentsRef = serverDb.collection('appointments');
    const appointmentsQuery = await appointmentsRef.where('caregiverId', '==', existingProfileDoc.id).get();

    const interviewsRef = serverDb.collection('interviews');
    const interviewsQuery = await interviewsRef.where('caregiverProfileId', '==', existingProfileDoc.id).get();

    const hiredRef = serverDb.collection('caregiver_employees');
    const hiredQuery = await hiredRef.where('caregiverProfileId', '==', existingProfileDoc.id).get();

    // Determine the status of the candidate matching candidate-status-report logic
    let candidateStatus = 'Applied';
    if (!hiredQuery.empty) {
      candidateStatus = 'Hired';
    } else if (!interviewsQuery.empty) {
      const interview = interviewsQuery.docs[0].data();
      if (interview.rejectionReason) candidateStatus = interview.rejectionReason;
      else if (interview.phoneScreenPassed === 'No') candidateStatus = 'Phone Screen Failed';
      else if (interview.finalInterviewStatus === 'Rejected at Orientation') candidateStatus = 'Rejected at Orientation';
      else if (interview.finalInterviewStatus === 'No Show') candidateStatus = 'No Show';
      else if (interview.finalInterviewStatus === 'Process Terminated') candidateStatus = 'Process Terminated';
      else if (interview.orientationScheduled) candidateStatus = 'Orientation Scheduled';
      else if (interview.finalInterviewStatus === 'Passed') candidateStatus = 'Final Interview Passed';
      else if (interview.finalInterviewStatus === 'Failed') candidateStatus = 'Final Interview Failed';
      else candidateStatus = 'Final Interview Pending';
    } else {
      const activeAppointments = appointmentsQuery.docs.filter(
        (doc) => doc.data().appointmentStatus !== 'cancelled'
      );
      if (activeAppointments.length > 0) {
        const hasScheduledAppointment = activeAppointments.some(
          (doc) => doc.data().inviteSent === true
        );
        candidateStatus = hasScheduledAppointment ? 'Phonescreen Scheduled' : 'Phonescreen Invite Needed';
      }
    }

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
    uid: data.uid,
    createdAt: Timestamp.now()
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


export async function scheduleAppointment(data: z.infer<typeof appointmentSchema>) {
    const validatedFields = appointmentSchema.safeParse(data);

    if (!validatedFields.success) {
        // This should ideally not be hit if client-side validation is working
        redirect('/?step=schedule&error=invalid_data');
        return;
    }
    
    // The data is now saved via createAppointmentAndSendAdminEmail
    revalidatePath("/admin");
    
    // Redirect to confirmation using the primary start time
    const redirectUrl = `/confirmation?time=${validatedFields.data.startTime.toISOString()}`;
    redirect(redirectUrl);
}

