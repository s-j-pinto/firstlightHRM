
/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/onCall";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/onRequest";
import * as logger from "firebase-functions/logger";
import { onCallGenkit } from "@genkit-ai/firebase/functions";
import { interviewInsightsFlow } from "./interview-insights";

// Set global options for the functions
setGlobalOptions({ maxInstances: 10 });

// This is a simple function to force a redeployment.
export const forceRedeploy = onRequest((request, response) => {
    logger.info("Deployment of all functions has been successfully forced.", {structuredData: true});
    response.send("Deployment of all functions has been successfully forced.");
});

// Export the Genkit flow as a callable function
export const interviewInsights = onCallGenkit(interviewInsightsFlow);
