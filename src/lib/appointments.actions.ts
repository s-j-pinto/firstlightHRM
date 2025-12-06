
"use server";

import { revalidatePath } from "next/cache";
import { serverDb } from "@/firebase/server-init";
import { toZonedTime, format } from "date-fns-tz";
import type { CaregiverProfile } from "./types";

export async function createAppointmentAndSendAdminEmail({caregiverId, preferredTimes}: {caregiverId: string, preferredTimes: Date[]}) {
    const firestore = serverDb;
    const adminEmail = "care-rc@firstlighthomecare.com";
    const pacificTimeZone = "America/Los_Angeles";
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";


    if (!preferredTimes || preferredTimes.length === 0) {
        return { message: "No preferred times were provided.", error: true };
    }
    
    // Sort to ensure the first time is the earliest
    preferredTimes.sort((a, b) => a.getTime() - b.getTime());
    const primaryStartTime = preferredTimes[0]; // The earliest time is the primary one

    try {
        // Step 1: Create the appointment document
        const appointmentData = {
            caregiverId: caregiverId,
            startTime: primaryStartTime,
            endTime: new Date(primaryStartTime.getTime() + 60 * 60 * 1000), // 60 min slot
            preferredTimes: preferredTimes,
            appointmentStatus: 'pending',
            inviteSent: false,
            createdAt: new Date(),
        };
        await firestore.collection('appointments').add(appointmentData);

        // Step 2: Fetch caregiver profile
        const caregiverProfileSnap = await firestore.collection('caregiver_profiles').doc(caregiverId).get();
        if (!caregiverProfileSnap.exists) {
             throw new Error(`Caregiver profile with ID ${caregiverId} not found.`);
        }
        const caregiverData = caregiverProfileSnap.data() as CaregiverProfile;

        // Step 3: Construct and queue the admin notification email
        const formattedPreferredTimes = preferredTimes.map(time => {
            const zonedTime = toZonedTime(time, pacificTimeZone);
            return `<li>${format(zonedTime, "EEEE, MMMM do, yyyy 'at' h:mm a", { timeZone: pacificTimeZone })}</li>`;
        }).join('');


        const email = {
            to: [adminEmail],
            message: {
                subject: `[Action Required] New Phone Interview with ${caregiverData.fullName || 'N/A'}`,
                html: `
                  <body style="font-family: sans-serif; line-height: 1.6;">
                    <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                      <h1 style="color: #333;">New Phone Interview Scheduled</h1>
                      <p>A new phone interview has been requested by a caregiver candidate. Please review their details and preferred times below, then send a calendar invite from the dashboard for the most suitable slot.</p>
                      
                      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h2 style="margin-top: 0; color: #555;">Candidate's Preferred Times</h2>
                        <ul style="padding-left: 20px;">
                           ${formattedPreferredTimes}
                        </ul>
                         <p><strong>Note:</strong> The earliest time has been set as the default on the dashboard.</p>
                      </div>

                      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                          <h2 style="margin-top: 0; color: #555;">Caregiver Snapshot</h2>
                          <p><strong>Caregiver:</strong> ${caregiverData.fullName || 'N/A'}</p>
                          <p><strong>Email:</strong> ${caregiverData.email}</p>
                          <p><strong>Phone:</strong> ${caregiverData.phone}</p>
                          <p><strong>Experience:</strong> ${caregiverData.yearsExperience} years</p>
                          <p><strong>Summary:</strong> ${caregiverData.summary || 'Not provided'}</p>
                          <ul style="padding-left: 20px;">
                            <li><strong>HCA Certified:</strong> ${caregiverData.hca ? 'Yes' : 'No'}</li>
                            <li><strong>CNA Certified:</strong> ${caregiverData.cna ? 'Yes' : 'No'}</li>
                            <li><strong>Dementia Experience:</strong> ${caregiverData.hasDementiaExperience ? 'Yes' : 'No'}</li>
                            <li><strong>Hospice Experience:</strong> ${caregiverData.hasHospiceExperience ? 'Yes' : 'No'}</li>
                            <li><strong>Has Car:</strong> ${caregiverData.hasCar}</li>
                            <li><strong>Valid License:</strong> ${caregiverData.validLicense}</li>
                          </ul>
                      </div>

                      <div style="text-align: center;">
                        <a href="https://care-connect-360--firstlighthomecare-hrm.us-central1.hosted.app/login?redirect=/admin" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-size: 16px; display: inline-block;">
                          Go to Admin Dashboard
                        </a>
                      </div>
                      
                      <div style="margin-top: 30px; text-align: center;">
                        <img src="${logoUrl}" alt="FirstLight Home Care Logo" width="200" />
                      </div>
                    </div>
                  </body>
                `,
            },
        };
        
        await firestore.collection("mail").add(email);

        revalidatePath('/admin');
        return { message: "Appointment created and admin email queued." };

    } catch (error) {
        console.error("Error creating appointment or sending admin email:", error);
        return { message: "Failed to create appointment or send notification.", error: true };
    }
}


export async function updateAppointment(appointmentId: string, newStartTime: Date, newEndTime: Date) {
    try {
        const firestore = serverDb;
        const appointmentRef = firestore.collection('appointments').doc(appointmentId);
        
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) {
            return { message: "Appointment not found.", error: true };
        }

        // Reset inviteSent to false whenever the appointment is updated
        await appointmentRef.update({
            startTime: newStartTime,
            endTime: newEndTime,
            inviteSent: false, 
        });

        revalidatePath('/admin');

        return { message: "Appointment updated successfully. You may now send a new invite." };
    } catch (error) {
        console.error("Error updating appointment:", error);
        return { message: "Failed to update appointment.", error: true };
    }
}

export async function cancelAppointment(appointmentId: string, reason: string) {
    try {
        const firestore = serverDb;
        const appointmentRef = firestore.collection('appointments').doc(appointmentId);

        await appointmentRef.update({
            appointmentStatus: "cancelled",
            cancelReason: reason,
            cancelDateTime: new Date(),
        });

        revalidatePath('/admin');
        
        return { message: "Appointment cancelled successfully." };
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        return { message: "Failed to cancel appointment.", error: true };
    }
}
