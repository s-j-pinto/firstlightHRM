
import admin from 'firebase-admin';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    // Check if the app is already initialized to prevent errors in hot-reloading environments
    if (admin.apps.length > 0 && admin.apps[0]) {
        return admin.apps[0];
    }

    console.log("[Firebase Admin] Attempting to initialize...");

    try {
        // Use application default credentials which are available in App Hosting.
        const app = admin.initializeApp({
            credential: admin.credential.applicationDefault(),
        });
        console.log("[Firebase Admin] SDK initialized successfully.");
        return app;
    } catch (e: any) {
        console.error("[Firebase Admin] CRITICAL: Failed to initialize Firebase Admin SDK.", e);
        // This will prevent the app from starting if Firebase Admin can't be initialized.
        throw new Error(`Could not initialize Firebase Admin SDK: ${e.message}`);
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
