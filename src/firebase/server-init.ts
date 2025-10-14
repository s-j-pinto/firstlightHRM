
import { initializeApp, getApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

// IMPORTANT: This file is for server-side use only.

const initializeServerApp = () => {
    if (admin.apps.length > 0) {
        return admin.app();
    }

    // When deployed to App Hosting, GOOGLE_CLOUD_PROJECT is automatically set.
    const isProduction = !!process.env.GOOGLE_CLOUD_PROJECT;

    if (isProduction) {
         // In production, App Default Credentials are used.
        return admin.initializeApp();
    } else {
        // For local development, explicitly connect to emulators.
        // Ensure you have the Firebase Emulator Suite running.
        console.log("Initializing Firebase Admin for local development with emulators.");
        process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
        process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
        
        return admin.initializeApp({
            projectId: firebaseConfig.projectId,
            // Using anonymous credentials for local emulator
            credential: admin.credential.applicationDefault()
        });
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
