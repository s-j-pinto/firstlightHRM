
import admin from 'firebase-admin';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    // Check if the app is already initialized to prevent errors in hot-reloading environments
    if (admin.apps.length > 0 && admin.apps[0]) {
        return admin.apps[0];
    }

    console.log("[Firebase Admin] Attempting to initialize...");

    // Check if running in a Google Cloud environment (like App Hosting)
    if (process.env.GCP_PROJECT) {
        console.log("[Firebase Admin] Google Cloud environment detected. Initializing with Application Default Credentials.");
        try {
            const app = admin.initializeApp();
            console.log("[Firebase Admin] SDK initialized successfully in production.");
            return app;
        } catch (e: any) {
            console.error("[Firebase Admin] CRITICAL: Failed to initialize in production environment.", e);
            // In a production environment, if this fails, we should throw to stop the process.
            throw new Error(`Could not initialize Firebase Admin SDK in production: ${e.message}`);
        }
    } else {
        // Fallback for local development
        console.log("[Firebase Admin] Local environment detected. Attempting to initialize with service-account.json.");
        try {
            const serviceAccount = require('../../service-account.json');
            const app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("[Firebase Admin] SDK initialized successfully for local development.");
            return app;
        } catch (e: any) {
            console.error("[Firebase Admin] CRITICAL: Failed to initialize for local development.", e);
            throw new Error(`Could not initialize Firebase Admin SDK. Make sure 'service-account.json' exists and is valid. Error: ${e.message}`);
        }
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
