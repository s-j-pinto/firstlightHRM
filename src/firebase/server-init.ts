
import admin from 'firebase-admin';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    // Check if the app is already initialized to prevent errors in hot-reloading environments
    if (admin.apps.length > 0 && admin.apps[0]) {
        return admin.apps[0];
    }

    console.log("[Firebase Admin] Attempting to initialize...");

    // Check if running in a Google Cloud environment (like App Hosting) where ADC are available.
    if (process.env.GCP_PROJECT) {
        console.log("[Firebase Admin] Google Cloud environment detected. Initializing with Application Default Credentials.");
        try {
            const app = admin.initializeApp();
            console.log("[Firebase Admin] SDK initialized successfully in production.");
            return app;
        } catch (e: any) {
            console.error("[Firebase Admin] CRITICAL: Failed to initialize in production environment.", e);
            throw new Error(`Could not initialize Firebase Admin SDK in production: ${e.message}`);
        }
    } else {
        // Fallback for local development using a service account file.
        console.log("[Firebase Admin] Local environment detected. Attempting to initialize with service-account.json.");
        try {
            // This 'require' is inside the 'else' block, so it only runs locally.
            const serviceAccount = require('../../service-account.json');
            const app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("[Firebase Admin] SDK initialized successfully for local development.");
            return app;
        } catch (e: any) {
            console.error("[Firebase Admin] CRITICAL: Failed to initialize for local development.", e);
            if (e.code === 'MODULE_NOT_FOUND') {
                 throw new Error("Could not initialize Firebase Admin SDK for local development. The 'service-account.json' file was not found. Please ensure it is in the root directory.");
            }
            throw new Error(`Could not initialize Firebase Admin SDK. Error: ${e.message}`);
        }
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
