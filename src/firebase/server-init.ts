
import admin from 'firebase-admin';
import { firebaseConfig } from './config';

// IMPORTANT: This file is for server-side use only.

// The service account is automatically available in the App Hosting environment
// and will be used by initializeApp() if no credentials are provided.
// For local development, you would need to set the GOOGLE_APPLICATION_CREDENTIALS
// environment variable to point to your service account key file.
// https://firebase.google.com/docs/admin/setup#initialize-sdk

const initializeServerApp = () => {
    if (admin.apps.length > 0) {
        return admin.app();
    }
    
    try {
        // This will use the service account from the environment in production on App Hosting
        return admin.initializeApp();
    } catch (e) {
        console.warn("Could not initialize Firebase Admin with default credentials. This is normal for local dev without GOOGLE_APPLICATION_CREDENTIALS. Falling back to client-like config (NOT FOR PROD).", e);
        // Fallback for local development if GOOGLE_APPLICATION_CREDENTIALS is not set.
        // This uses a less secure method and is not recommended for production.
        return admin.initializeApp({
            credential: admin.credential.applicationDefault(), // May not work in all environments
            projectId: firebaseConfig.projectId,
        });
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
