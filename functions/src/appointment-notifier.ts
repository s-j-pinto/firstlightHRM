
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { toZonedTime, format } from "date-fns-tz";


// Check if the app is already initialized to prevent re-initialization
if (!getFirestore().app.name) {
    initializeApp();
}

const db = getFirestore();
const pacificTimeZone = "America/Los_Angeles";

export const sendNewAppointmentEmail = onDocumentCreated("appointments/{appointmentId}", async (event) => {
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
    logger.info("Retrieved caregiver data:", caregiverData);


    // Ensure startTime and endTime are valid Timestamps before converting
    const startTime = (appointment.startTime as Timestamp)?.toDate();
    const endTime = (appointment.endTime as Timestamp)?.toDate();

    if (!startTime || !endTime) {
        logger.error("Invalid start or end time in appointment data", { appointmentId: snapshot.id });
        return;
    }

    const zonedStartTime = toZonedTime(startTime, pacificTimeZone);

    const formattedStartTime = format(zonedStartTime, "h:mm a", { timeZone: pacificTimeZone });
    const formattedDate = format(zonedStartTime, "EEEE, MMMM do, yyyy", { timeZone: pacificTimeZone });


    const email = {
      to: [adminEmail],
      message: {
        subject: `[Action Required] New Phone Interview Appointment Requested with ${caregiverData.fullName || 'N/A'}`,
        html: `
          <h1>New Phone Interview Appointment</h1>
          <p>A new phone interview has been scheduled with a caregiver candidate. Please review their details and send them a calendar invite for the selected time.</p>
          <p>You can manage this appointment on the <a href="https://care-connect-360--firstlighthomecare-hrm.us-central1.hosted.app/login?redirect=/admin">Admin Dashboard</a>.</p>
          
          <h2>Appointment Details</h2>
          <ul>
            <li><strong>Caregiver:</strong> ${caregiverData.fullName || 'N/A'}</li>
            <li><strong>Date:</strong> ${formattedDate}</li>
            <li><strong>Time:</strong> ${formattedStartTime} (Pacific Time)</li>
          </ul>
          
          <h2>Caregiver Snapshot</h2>
          <ul>
            <li><strong>Email:</strong> ${caregiverData.email}</li>
            <li><strong>Phone:</strong> ${caregiverData.phone}</li>
            <li><strong>Years of Experience:</strong> ${caregiverData.yearsExperience}</li>
            <li><strong>Has Car:</strong> ${caregiverData.hasCar}</li>
            <li><strong>Valid License:</strong> ${caregiverData.validLicense}</li>
            <li><strong>HCA Certified:</strong> ${caregiverData.hca ? 'Yes' : 'No'}</li>
            <li><strong>CNA Certified:</strong> ${caregiverData.cna ? 'Yes' : 'No'}</li>
            <li><strong>Dementia Experience:</strong> ${caregiverData.hasDementiaExperience ? 'Yes' : 'No'}</li>
            <li><strong>Hospice Experience:</strong> ${caregiverData.hasHospiceExperience ? 'Yes' : 'No'}</li>
          </ul>
          
          <h3>Summary:</h3>
          <p>${caregiverData.summary || 'Not provided'}</p>

          <p style="margin-top: 20px;">Please proceed to the admin dashboard to view the full profile and manage the interview process.</p>
        `,
      },
    };

    await db.collection("mail").add(email);
    logger.log(`Admin notification email for caregiver ${caregiverData.fullName} queued for delivery.`);

  } catch (error) {
    logger.error("Error sending new appointment admin email:", error);
  }
});
