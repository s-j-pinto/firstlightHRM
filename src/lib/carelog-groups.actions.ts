
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

interface CareLogGroupPayload {
  groupId?: string;
  clientId: string;
  caregiverIds: string[];
}

export async function saveCareLogGroup(payload: CareLogGroupPayload) {
  const { groupId, clientId, caregiverIds } = payload;

  if (!clientId) {
    return { message: "Client must be selected.", error: true };
  }
  if (!caregiverIds || caregiverIds.length === 0) {
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
      caregiverIds,
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

    revalidatePath('/admin/settings');
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
    await firestore.collection('carelog_groups').doc(groupId).delete();

    revalidatePath('/admin/settings');
    return { message: "CareLog group has been deleted." };
  } catch (error: any) {
    console.error("Error deleting CareLog group:", error);
    return { message: `An error occurred while deleting the group: ${error.message}`, error: true };
  }
}
