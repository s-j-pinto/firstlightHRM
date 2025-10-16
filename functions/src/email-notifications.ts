
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { formatInTimeZone } from "date-fns-tz";
import { Timestamp } from "firebase-admin/firestore";

// Check if the app is already initialized to prevent re-initialization
if (!getFirestore().app.name) {
    initializeApp();
}

const db = getFirestore();
const pacificTimeZone = "America/Los_Angeles";

export const sendAppointmentEmail = onDocumentCreated("appointments/{appointmentId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.log("No data associated with the event");
    return;
  }

  const appointment = snapshot.data();
  const adminEmail = "care-rc@firstlighthomecare.com";

  try {
    const caregiverProfile = await db.collection('caregiver_profiles').doc(appointment.caregiverId).get();

    if (!caregiverProfile.exists) {
      logger.error(`Caregiver profile with ID ${appointment.caregiverId} not found`);
      return;
    }

    const caregiverData = caregiverProfile.data()!;

    // Ensure startTime and endTime are valid Timestamps before converting
    const startTime = (appointment.startTime as Timestamp)?.toDate();
    const endTime = (appointment.endTime as Timestamp)?.toDate();

    if (!startTime || !endTime) {
        logger.error("Invalid start or end time in appointment data", { appointmentId: snapshot.id });
        return;
    }

    const email = {
      to: [adminEmail],
      message: {
        subject: `New Phone Interview Appointment with ${caregiverData.fullName}`,
        html: `
          <h1>New Appointment Scheduled</h1>
          <p>A new appointment slot has been requested with the following caregiver. Please send them a calendar invite.</p>
          
          <h2>Appointment Details</h2>
          <p><strong>Caregiver:</strong> ${caregiverData.fullName}</p>
          <p><strong>Date:</strong> ${formatInTimeZone(startTime, pacificTimeZone, 'EEEE, MMMM do, yyyy')}</p>
          <p><strong>Time:</strong> ${formatInTimeZone(startTime, pacificTimeZone, 'h:mm a')} - ${formatInTimeZone(endTime, pacificTimeZone, 'h:mm a')} (Pacific Time)</p>
          
          <h2>Caregiver Profile</h2>
          <p><strong>Email:</strong> ${caregiverData.email}</p>
          <p><strong>Phone:</strong> ${caregiverData.phone}</p>
          <p><strong>Years of Experience:</strong> ${caregiverData.yearsExperience}</p>
          <p><strong>Summary:</strong> ${caregiverData.summary}</p>
          
          <p>You can view the full details on the admin dashboard.</p>
        `,
      },
    };

    await db.collection("mail").add(email);
    logger.log("Email queued for delivery");

  } catch (error) {
    logger.error("Error sending appointment email:", error);
  }
});

