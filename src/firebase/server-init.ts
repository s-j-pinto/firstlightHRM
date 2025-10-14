import admin from 'firebase-admin';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    // Check if the app is already initialized to prevent errors in hot-reloading environments
    if (admin.apps.length > 0 && admin.apps[0]) {
        return admin.apps[0];
    }

    // When deployed to App Hosting, GOOGLE_CLOUD_PROJECT is automatically set.
    const isProduction = !!process.env.GOOGLE_CLOUD_PROJECT;

    if (isProduction) {
         // In production, App Default Credentials are used.
        return admin.initializeApp();
    } else {
        // For local development, use a service account
        try {
            console.log("Initializing Firebase Admin for local development with service account.");
            const serviceAccount = require('./service-account.json');
            return admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
        } catch (e: any) {
            if (e.code === 'MODULE_NOT_FOUND') {
                console.log("Initializing Firebase Admin using Application Default Credentials for local development.");
                // If service account is not found, fall back to Application Default Credentials
                // This is useful for local development when `gcloud auth application-default login` is used.
                 return admin.initializeApp();
            } else {
                throw e;
            }
        }
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
