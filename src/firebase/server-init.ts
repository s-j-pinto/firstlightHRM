
import admin from 'firebase-admin';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    // Check if the app is already initialized to prevent errors in hot-reloading environments
    if (admin.apps.length > 0 && admin.apps[0]) {
        return admin.apps[0];
    }

    console.log("[Firebase Admin] Attempting to initialize...");

    // In a deployed App Hosting environment, application default credentials are automatically available.
    // For local development, we check for a service-account.json file.
    if (process.env.NODE_ENV !== 'production') {
        try {
            // This is for local development.
            const serviceAccount = require('../../service-account.json');
            console.log("[Firebase Admin] Initializing with service-account.json for local development.");
            const app = admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            return app;
        } catch (e: any) {
             if (e.code === 'MODULE_NOT_FOUND') {
                console.warn("[Firebase Admin] service-account.json not found. This is expected in production but will fail in local development if server-side auth is needed. Trying default credentials...");
            } else {
                console.error("[Firebase Admin] Error reading service-account.json:", e);
            }
        }
    }
    
    // This will be used in the deployed App Hosting environment.
    try {
        console.log("[Firebase Admin] Initializing with Application Default Credentials for production.");
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
