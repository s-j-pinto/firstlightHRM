
import { initializeApp, getApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

// This pattern ensures that we're only initializing Firebase Admin once.
function safelyInitializeApp(): App {
  if (!getApps().length) {
    return initializeApp();
  }
  return getApp();
}

let app: App;
let auth: Auth;
let firestore: Firestore;
let storage: Storage;
let messaging: Messaging;

/**
 * Lazily initializes and returns the Firebase Admin App instance.
 */
export function getLazyApp(): App {
  if (!app) {
    app = safelyInitializeApp();
  }
  return app;
}

/**
 * Lazily initializes and returns the Firebase Admin Auth service.
 */
export function getLazyAuth(): Auth {
  if (!auth) {
    auth = getAuth(getLazyApp());
  }
  return auth;
}

/**
 * Lazily initializes and returns the Firebase Admin Firestore service.
 */
export function getLazyFirestore(): Firestore {
  if (!firestore) {
    firestore = getFirestore(getLazyApp());
  }
  return firestore;
}

/**
 * Lazily initializes and returns the Firebase Admin Storage service.
 */
export function getLazyStorage(): Storage {
  if (!storage) {
    storage = getStorage(getLazyApp());
  }
  return storage;
}

/**
 * Lazily initializes and returns the Firebase Admin Messaging service.
 */
export function getLazyMessaging(): Messaging {
  if (!messaging) {
    messaging = getMessaging(getLazyApp());
  }
  return messaging;
}
