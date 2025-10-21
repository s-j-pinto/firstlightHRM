
import admin from 'firebase-admin';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    // Check if the app is already initialized to prevent errors in hot-reloading environments
    if (admin.apps.length > 0 && admin.apps[0]) {
        return admin.apps[0];
    }

    console.log("[Firebase Admin] Attempting to initialize...");

    try {
        // This logic is now simplified to ALWAYS use the service account file for local dev.
        // For production App Hosting, environment variables would be used instead.
        const serviceAccount = require('../../service-account.json');
        console.log("[Firebase Admin] Initializing with service-account.json.");
        const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("[Firebase Admin] SDK initialized successfully with service account file.");
        return app;
    } catch (e: any) {
        console.error("[Firebase Admin] CRITICAL: Failed to initialize Firebase Admin SDK with service-account.json.", e);
        // This throws an error that will be caught by the server action and reported to the user.
        throw new Error(`Could not initialize Firebase Admin SDK. Make sure the service-account.json file is correctly placed and formatted. Error: ${e.message}`);
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
