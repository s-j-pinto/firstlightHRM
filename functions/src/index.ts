
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/onCall";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {onCall} from "firebase-functions/v2/onCall";
import * as logger from "firebase-functions/logger";
import { generateInterviewInsights } from "./interview-insights";

// Set global options for the functions
setGlobalOptions({ maxInstances: 10 });

// This is a simple function to force a redeployment.
export const forceRedeploy = onCall((request) => {
    logger.info("Deployment of all functions has been successfully forced.", {structuredData: true});
    return { message: "Deployment of all functions has been successfully forced." };
});

// Export the function so that Firebase can discover and deploy it
export const interviewInsights = onCall(async (request) => {
    // The request.data will contain the payload sent from the client.
    // We pass it directly to our Genkit logic handler.
    return await generateInterviewInsights(request.data);
});
