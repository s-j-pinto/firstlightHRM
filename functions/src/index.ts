
/**
 * This file is now primarily for extensions or other non-Genkit Cloud Functions.
 * The AI-related logic has been moved to Next.js Server Actions.
 * The scheduled follow-up logic has been moved to a Next.js API Route.
 */

import {setGlobalOptions} from "firebase-functions/v2";
import {onCall} from "firebase-functions/v2/onCall";
import * as logger from "firebase-functions/logger";

// Set global options for the functions if any are defined.
setGlobalOptions({ maxInstances: 10 });

/**
 * A simple "hello world" style function that can be used to verify that
 * Cloud Function deployments are succeeding. It can be removed if not needed.
 */
export const forceRedeploy = onCall((request) => {
    logger.info("forceRedeploy function was called successfully.", {structuredData: true});
    return { message: "Deployment appears to be successful." };
});
