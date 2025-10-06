
'use server';

import { serverDb } from '@/firebase/server-init';
import type { CaregiverProfile, Appointment } from "./types";
import { Timestamp } from 'firebase-admin/firestore';

export const addCaregiver = async (profile: Omit<CaregiverProfile, "id">): Promise<string> => {
  console.log("Step 6a: Inside addCaregiver function (using admin SDK on server).");
  const caregiverData = {
    ...profile,
  };
  console.log("Step 6b: Preparing to add document to 'caregiver_profiles' collection.");
  const docRef = await serverDb.collection("caregiver_profiles").add(caregiverData);
  console.log("Step 6c: Document added with ID:", docRef.id);
  return docRef.id;
};

export const addAppointment = async (appointment: Omit<Appointment, "id">): Promise<string> => {
  console.log("Step C-1: Inside addAppointment function.");
  const docRef = await serverDb.collection("appointments").add({
      ...appointment,
      startTime: Timestamp.fromDate(appointment.startTime),
      endTime: Timestamp.fromDate(appointment.endTime),
  });
  console.log("Step C-2: Appointment document added with ID:", docRef.id);
  return docRef.id;
};

export const getAppointments = async (): Promise<Appointment[]> => {
    console.log("Fetching appointments using admin SDK on server...");
    const appointmentsSnapshot = await serverDb.collection("appointments").get();
    const appointments = appointmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            ...data, 
            id: doc.id,
            startTime: (data.startTime as Timestamp).toDate(),
            endTime: (data.endTime as Timestamp).toDate(),
        } as Appointment
    });
    console.log(`Fetched ${appointments.length} appointments.`);
    return appointments;
};
