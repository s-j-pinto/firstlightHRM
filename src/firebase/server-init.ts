import admin from 'firebase-admin';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    // Check if the app is already initialized to prevent errors in hot-reloading environments
    if (admin.apps.length > 0 && admin.apps[0]) {
        return admin.apps[0];
    }

    console.log("[Firebase Admin] Attempting to initialize...");

    try {
        // This is for local development. It directly uses the service account file.
        const serviceAccount = require('../../service-account.json');
        console.log("[Firebase Admin] Initializing with service-account.json for local development.");
        const app = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        return app;
    } catch (e: any) {
        if (e.code === 'MODULE_NOT_FOUND') {
            // This case is for the deployed App Hosting environment where ADC is used.
            console.log("[Firebase Admin] service-account.json not found. Initializing with Application Default Credentials for production.");
            try {
                const app = admin.initializeApp({
                    credential: admin.credential.applicationDefault(),
                });
                console.log("[Firebase Admin] SDK initialized successfully with ADC.");
                return app;
            } catch (prodError: any) {
                 console.error("[Firebase Admin] CRITICAL: Failed to initialize Firebase Admin SDK with ADC.", prodError);
                 throw new Error(`Could not initialize Firebase Admin SDK in production: ${prodError.message}`);
            }
        } else {
            console.error("[Firebase Admin] CRITICAL: Error reading or parsing service-account.json:", e);
            throw new Error(`Could not initialize Firebase Admin SDK with service account file: ${e.message}`);
        }
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
