
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

interface CareLogGroupPayload {
  groupId?: string;
  clientId: string;
  caregiverEmails: string[];
}

export async function saveCareLogGroup(payload: CareLogGroupPayload) {
  const { groupId, clientId, caregiverEmails } = payload;

  if (!clientId) {
    return { message: "Client must be selected.", error: true };
  }
  if (!caregiverEmails || caregiverEmails.length === 0) {
    return { message: "At least one caregiver must be selected.", error: true };
  }

  const firestore = serverDb;

  try {
    const clientDoc = await firestore.collection('Clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return { message: "Selected client not found.", error: true };
    }
    const clientName = clientDoc.data()?.['Client Name'] || 'Unknown Client';

    const groupData = {
      clientId,
      clientName,
      caregiverEmails,
      status: 'ACTIVE',
      lastUpdatedAt: Timestamp.now(),
    };

    if (groupId) {
      // Update existing group
      const groupRef = firestore.collection('carelog_groups').doc(groupId);
      await groupRef.update(groupData);
    } else {
      // Create new group
      const groupRef = firestore.collection('carelog_groups').doc();
      await groupRef.set({ ...groupData, createdAt: Timestamp.now() });
    }

    revalidatePath('/staffing-admin');
    return { message: `CareLog group for ${clientName} has been saved successfully.` };
  } catch (error: any) {
    console.error("Error saving CareLog group:", error);
    return { message: `An error occurred: ${error.message}`, error: true };
  }
}

export async function deleteCareLogGroup(groupId: string) {
  if (!groupId) {
    return { message: "Group ID is missing.", error: true };
  }

  const firestore = serverDb;
  try {
    const groupRef = firestore.collection('carelog_groups').doc(groupId);
    await groupRef.update({
        status: 'INACTIVE',
        lastUpdatedAt: Timestamp.now(),
    });

    revalidatePath('/staffing-admin');
    return { message: "CareLog group has been marked as inactive." };
  } catch (error: any) {
    console.error("Error deactivating CareLog group:", error);
    return { message: `An error occurred while deactivating the group: ${error.message}`, error: true };
  }
}

export async function reactivateCareLogGroup(groupId: string) {
  if (!groupId) {
    return { message: "Group ID is missing.", error: true };
  }

  const firestore = serverDb;
  try {
    const groupRef = firestore.collection('carelog_groups').doc(groupId);
    await groupRef.update({
        status: 'ACTIVE',
        lastUpdatedAt: Timestamp.now(),
    });

    revalidatePath('/staffing-admin');
    return { message: "CareLog group has been reactivated successfully." };
  } catch (error: any) {
    console.error("Error reactivating CareLog group:", error);
    return { message: `An error occurred while reactivating the group: ${error.message}`, error: true };
  }
}
    