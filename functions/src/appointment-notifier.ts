
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
const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";


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
        subject: `[Action Required] New Phone Interview with ${caregiverData.fullName || 'N/A'}`,
        html: `
          <body style="font-family: sans-serif; line-height: 1.6;">
            <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
              <h1 style="color: #333;">New Phone Interview Scheduled</h1>
              <p>A new phone interview has been requested by a caregiver candidate. Please review their details below and send a calendar invite from the dashboard.</p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h2 style="margin-top: 0; color: #555;">Appointment Details</h2>
                <p><strong>Caregiver:</strong> ${caregiverData.fullName || 'N/A'}</p>
                <p><strong>Date:</strong> ${formattedDate}</p>
                <p><strong>Time:</strong> ${formattedStartTime} (Pacific Time)</p>
              </div>

              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                  <h2 style="margin-top: 0; color: #555;">Caregiver Snapshot</h2>
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

    await db.collection("mail").add(email);
    logger.log(`Admin notification email for caregiver ${caregiverData.fullName} queued for delivery.`);

  } catch (error) {
    logger.error("Error sending new appointment admin email:", error);
  }
});

