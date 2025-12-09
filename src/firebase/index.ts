
'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { useMemo, DependencyList } from 'react';

// IMPORTANT: This function should only be called ONCE on the client,
// typically within the FirebaseClientProvider.
export function initializeFirebase() {
  if (getApps().length > 0) {
    return getSdks(getApp());
  }
  const firebaseApp = initializeApp(firebaseConfig);
  return getSdks(firebaseApp);
}

function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp),
  };
}

// These exports are for convenience but can cause issues with multiple initializations.
// It's safer to rely on the provider hooks (useAuth, useFirestore).
// However, to maintain compatibility with existing code that imports these directly,
// we initialize it here. This part is sensitive to execution context.
const { firestore, auth } = getApps().length
  ? getSdks(getApp())
  : initializeFirebase();

export { firestore, auth };


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
