/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions/v2";

// Import the function from its submodule
import { sendAppointmentEmail } from "./email-notifications";

// Set global options for the functions
setGlobalOptions({ maxInstances: 10 });

// Export the function so that Firebase can discover and deploy it
export { sendAppointmentEmail };
