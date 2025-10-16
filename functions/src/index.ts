/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {onRequest} from "firebase-functions/v2/onRequest";
import * as logger from "firebase-functions/logger";

// Import the function from its submodule
import { sendNewAppointmentEmail } from "./appointment-notifier";
import { interviewInsights } from "./interview-insights";

// Set global options for the functions
setGlobalOptions({ maxInstances: 10 });

// This is a simple function to force a redeployment.
export const forceRedeploy = onRequest((request, response) => {
    logger.info("Deployment of all functions has been successfully forced.", {structuredData: true});
    response.send("Deployment of all functions has been successfully forced.");
});

// Export the function so that Firebase can discover and deploy it
export { sendNewAppointmentEmail, interviewInsights };
