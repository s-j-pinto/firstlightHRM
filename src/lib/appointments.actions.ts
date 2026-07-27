
"use server";

import { revalidatePath } from "next/cache";
import { serverDb } from "@/firebase/server-init";
import { toZonedTime, format } from "date-fns-tz";
import type { CaregiverProfile } from "./types";
import { Timestamp } from "firebase-admin/firestore";

export async function createAppointmentAndSendAdminEmail({caregiverId, preferredTimes}: {caregiverId: string, preferredTimes: Date[]}) {
    const firestore = serverDb;
    const adminEmail = "care-rc@firstlighthomecare.com";
    const pacificTimeZone = "America/Los_Angeles";

    if (!preferredTimes || preferredTimes.length === 0) {
        return { message: "No preferred times were provided.", error: true };
    }
    
    preferredTimes.sort((a, b) => a.getTime() - b.getTime());
    const primaryStartTime = preferredTimes[0];

    try {
        const caregiverDoc = await firestore.collection('caregiver_profiles').doc(caregiverId).get();
        const caregiverData = caregiverDoc.data();
        
        const appointmentData = {
            caregiverId: caregiverId,
            caregiverName: caregiverData?.fullName || 'Unknown',
            caregiverEmail: caregiverData?.email || '',
            startTime: primaryStartTime,
            endTime: new Date(primaryStartTime.getTime() + 60 * 60 * 1000),
            preferredTimes: preferredTimes,
            appointmentStatus: 'pending',
            inviteSent: false,
            createdAt: new Date(),
        };

        const batch = firestore.batch();
        const apptRef = firestore.collection('appointments').doc();
        batch.set(apptRef, appointmentData);

        // SYNC TO PROFILE
        batch.update(firestore.collection('caregiver_profiles').doc(caregiverId), {
            hiringStatus: 'Phonescreen Invite Needed',
            nextStepText: 'Send Calendar Invite',
            nextStepTime: Timestamp.fromDate(primaryStartTime),
            lastUpdatedAt: Timestamp.now()
        });

        await batch.commit();
        revalidatePath('/admin');
        return { message: "Appointment created and profile status synced." };
    } catch (error) {
        console.error("Error creating appointment:", error);
        return { message: "Failed to create appointment.", error: true };
    }
}


export async function updateAppointment(appointmentId: string, newStartTime: Date, newEndTime: Date) {
    try {
        const firestore = serverDb;
        const appointmentRef = firestore.collection('appointments').doc(appointmentId);
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) return { error: true, message: "Not found" };

        const caregiverId = appointmentDoc.data()?.caregiverId;

        await firestore.runTransaction(async (transaction) => {
            transaction.update(appointmentRef, {
                startTime: newStartTime,
                endTime: newEndTime,
                inviteSent: false, 
            });
            if (caregiverId) {
                transaction.update(firestore.collection('caregiver_profiles').doc(caregiverId), {
                    hiringStatus: 'Phonescreen Invite Needed',
                    nextStepText: 'Send Updated Invite',
                    nextStepTime: Timestamp.fromDate(newStartTime),
                    lastUpdatedAt: Timestamp.now()
                });
            }
        });

        revalidatePath('/admin');
        return { message: "Appointment updated and status synced." };
    } catch (error) {
        return { message: "Failed to update appointment.", error: true };
    }
}

export async function cancelAppointment(appointmentId: string, reason: string) {
    try {
        const firestore = serverDb;
        const appointmentRef = firestore.collection('appointments').doc(appointmentId);
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) return { error: true, message: "Not found" };

        const caregiverId = appointmentDoc.data()?.caregiverId;
        const terminalReasons = ["CG ghosted appointment", "Candidate withdrew application", "Pay rate too low"];
        const isTerminal = terminalReasons.includes(reason);

        await firestore.runTransaction(async (transaction) => {
            transaction.delete(appointmentRef);
            if (caregiverId) {
                const update: any = {
                    hiringStatus: isTerminal ? reason : 'Applied',
                    nextStepText: isTerminal ? 'Process Ended' : 'Needs Phone Screen',
                    nextStepTime: null,
                    lastUpdatedAt: Timestamp.now()
                };
                transaction.update(firestore.collection('caregiver_profiles').doc(caregiverId), update);
            }
        });

        revalidatePath('/admin');
        return { message: "Appointment cancelled and status synced." };
    } catch (error: any) {
        return { message: `Failed: ${error.message}`, error: true };
    }
}
