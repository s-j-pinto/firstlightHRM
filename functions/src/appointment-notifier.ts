
// DEPRECATED: This Cloud Function is no longer in use.
// The logic for sending the new appointment email to the admin has been
// moved to a Next.js server action in `src/lib/appointments.actions.ts`.
// This file and its trigger in `src/functions/index.ts` can be safely removed.

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

export const sendNewAppointmentEmail = onDocumentCreated("appointments/{appointmentId}", async (event) => {
  logger.warn("DEPRECATED FUNCTION TRIGGERED: sendNewAppointmentEmail was called but is no longer in use. Please remove this function.");
  return;
});
