'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  Firestore,
  getFirestore
} from 'firebase/firestore';
import { useMemo, DependencyList } from 'react';

// Cache the SDK instances to prevent redundant initialization attempts
let cachedSdks: {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} | null = null;

// IMPORTANT: This function should only be called ONCE on the client,
// typically within the FirebaseClientProvider.
export function initializeFirebase() {
  if (typeof window !== "undefined" && cachedSdks) {
    return cachedSdks;
  }

  const apps = getApps();
  const firebaseApp = apps.length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  
  let firestore: Firestore;
  try {
    // Attempt to initialize Firestore with persistent multi-tab caching
    firestore = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (e: any) {
    // This catch block handles the case where initializeFirestore is called more than once
    // (common with Hot Module Replacement in Next.js).
    // We fall back to getFirestore() which returns the already initialized instance.
    console.warn("[Firebase] Firestore already initialized, retrieving existing instance.");
    firestore = getFirestore(firebaseApp);
  }

  const sdks = {
    firebaseApp,
    auth,
    firestore,
  };

  if (typeof window !== "undefined") {
    cachedSdks = sdks;
  }

  return sdks;
}

// Re-export everything from the provider and error handling modules
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';

// The useMemoFirebase hook remains unchanged.
type MemoFirebase<T> = T & { __memo?: boolean };

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoized = useMemo(factory, deps);
  if (typeof memoized === 'object' && memoized !== null) {
    (memoized as MemoFirebase<T>).__memo = true;
  }
  return memoized;
}
