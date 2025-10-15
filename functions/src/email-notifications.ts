
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { formatInTimeZone } from "date-fns-tz";

initializeApp();
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

    const caregiverData = caregiverProfile.data();

    const startTime = appointment.startTime.toDate();
    const endTime = appointment.endTime.toDate();

    const email = {
      to: [adminEmail],
      message: {
        subject: `New FirstLightHRM Phone Interview Appointment with ${appointment.caregiverName}`,
        html: `
          <h1>New Appointment Scheduled</h1>
          <p>A new appointment has been scheduled with the following caregiver. Please send them a calendar invite.</p>
          
          <h2>Appointment Details</h2>
          <p><strong>Caregiver:</strong> ${appointment.caregiverName}</p>
          <p><strong>Date:</strong> ${formatInTimeZone(startTime, pacificTimeZone, 'EEEE, MMMM do, yyyy')}</p>
          <p><strong>Time:</strong> ${formatInTimeZone(startTime, pacificTimeZone, 'h:mm a')} - ${formatInTimeZone(endTime, pacificTimeZone, 'h:mm a')}</p>
          
          <h2>Caregiver Profile</h2>
          <p><strong>Email:</strong> ${caregiverData?.email}</p>
          <p><strong>Phone:</strong> ${caregiverData?.phone}</p>
          <p><strong>Years of Experience:</strong> ${caregiverData?.yearsExperience}</p>
          <p><strong>Summary:</strong> ${caregiverData?.summary}</p>
          
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
