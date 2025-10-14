
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
        // For local development, use a service account
        console.log("Initializing Firebase Admin for local development with service account.");
        const serviceAccount = require('./service-account.json');
        return admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: `https://${firebaseConfig.projectId}.firebaseio.com`,
        });
    }
}

export const serverApp = initializeServerApp();
export const serverDb = admin.firestore(serverApp);
export const serverAuth = admin.auth(serverApp);
