
import admin from 'firebase-admin';
import { firebaseConfig } from './config';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    if (admin.apps.length > 0) {
        return admin.app();
    }
    
    // Check if the service account environment variable is set.
    // This is the standard way to initialize in production environments like App Hosting.
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
            console.log("Initializing Firebase Admin with default credentials.");
            return admin.initializeApp({
                credential: admin.credential.applicationDefault(),
            });
        } catch (e) {
             console.error("Firebase Admin SDK initialization failed with default credentials:", e);
             // Fall through to the next method if this fails
        }
    }
    
    // Fallback for local development or environments without the service account env var.
    // This uses the client-side config, which is less secure for server-side operations
    // but necessary for the development environment to function.
    try {
        console.warn("Initializing Firebase Admin with client-side config project ID. This is intended for local development only.");
        return admin.initializeApp({
            projectId: firebaseConfig.projectId,
        });
    } catch (e) {
        console.error("Firebase Admin SDK initialization failed with fallback config:", e);
        // If all initialization methods fail, throw an error.
        throw new Error("Could not initialize Firebase Admin SDK. Please check your configuration and credentials.");
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
