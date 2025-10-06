
'use server';

import { getFirestore, collection, addDoc, getDocs, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import type { CaregiverProfile, Appointment } from "./types";
import { firebaseConfig } from '@/firebase/config';

// Server-side initialization
function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }
  
  console.log("Initializing Firebase Admin SDK...");
  // This is a simplified initialization. In a real-world scenario, you'd use service accounts.
  const app = initializeApp({
    projectId: firebaseConfig.projectId,
  });
  console.log("Firebase Admin SDK initialized.");
  return app;
}

const db = getFirestore(getAdminApp());

export const addCaregiver = async (profile: Omit<CaregiverProfile, "id">): Promise<string> => {
  console.log("Step 6a: Inside addCaregiver function.");
  const caregiverData = {
    ...profile,
  };
  console.log("Step 6b: Preparing to add document to 'caregiver_profiles' collection.");
  const docRef = await addDoc(collection(db, "caregiver_profiles"), caregiverData);
  console.log("Step 6c: Document added with ID:", docRef.id);
  return docRef.id;
};

export const addAppointment = async (appointment: Omit<Appointment, "id">): Promise<string> => {
  const docRef = await addDoc(collection(db, "appointments"), {
      ...appointment,
      startTime: Timestamp.fromDate(appointment.startTime),
      endTime: Timestamp.fromDate(appointment.endTime),
  });
  return docRef.id;
};

export const getAppointments = async (): Promise<Appointment[]> => {
    const appointmentsSnapshot = await getDocs(collection(db, "appointments"));
    return appointmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            ...data, 
            id: doc.id,
            startTime: (data.startTime as Timestamp).toDate(),
            endTime: (data.endTime as Timestamp).toDate(),
        } as Appointment
    });
};
