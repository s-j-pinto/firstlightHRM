
// DEPRECATED: This Cloud Function is no longer in use.
// The logic for sending the new appointment email to the admin has been
// moved to a Next.js server action in `src/lib/appointments.actions.ts`.
// This file and its trigger in `src/functions/index.ts` can be safely removed.

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
  logger.warn("DEPRECATED FUNCTION TRIGGERED: sendNewAppointmentEmail was called but is no longer in use. Please remove this function.");
  return;
});
