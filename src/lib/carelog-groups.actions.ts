

"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { vaTaskTemplateSchema } from './types';

interface CareLogGroupPayload {
  groupId?: string;
  clientId: string;
  caregiverEmails: string[];
  careLogTemplateId?: string;
  clientAccessEnabled?: boolean;
  vaClientId?: string;
  vaLast4SSN?: string;
  vaReferralNumber?: string;
}

async function updateVaClientsJson(clientInfo: { firestoreClientId: string; vaClientId?: string; clientName?: string }, action: 'add-or-update' | 'remove') {
    const bucket = getStorage().bucket('gs://firstlighthomecare-hrm.firebasestorage.app');
    const file = bucket.file('CareLogs/VA_CareLogs/VA-Clients.json');
    let clientsJson: { clients: Array<{ firestoreClientId: string; clientId: string; clientName: string }> } = { clients: [] };

    try {
        const [contents] = await file.download();
        clientsJson = JSON.parse(contents.toString());
    } catch (error: any) {
        if (error.code !== 404) {
            console.error("Error downloading VA-Clients.json:", error);
            throw new Error("Could not read the VA Clients JSON file from storage.");
        }
        console.log("VA-Clients.json not found, will create a new one.");
    }
    
    if (!Array.isArray(clientsJson.clients)) {
        clientsJson.clients = [];
    }

    clientsJson.clients = clientsJson.clients.filter(c => c.firestoreClientId !== clientInfo.firestoreClientId);

    if (action === 'add-or-update' && 'vaClientId' in clientInfo && clientInfo.vaClientId && clientInfo.clientName) {
        clientsJson.clients.push({
            firestoreClientId: clientInfo.firestoreClientId,
            clientId: clientInfo.vaClientId,
            clientName: clientInfo.clientName
        });
    }

    await file.save(Buffer.from(JSON.stringify(clientsJson, null, 2)), {
        contentType: 'application/json',
    });
}


export async function saveCareLogGroup(payload: CareLogGroupPayload) {
  const { groupId, clientId, caregiverEmails, careLogTemplateId, clientAccessEnabled, vaClientId, vaLast4SSN, vaReferralNumber } = payload;

  if (!clientId) {
    return { message: "Client must be selected.", error: true };
  }
  if (!caregiverEmails || caregiverEmails.length === 0) {
    return { message: "At least one caregiver must be selected.", error: true };
  }

  const firestore = serverDb;

  try {
    const isVaTemplate = careLogTemplateId ? (await firestore.collection('va_task_templates').doc(careLogTemplateId).get()).exists : false;

    const clientDoc = await firestore.collection('Clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return { message: "Selected client not found.", error: true };
    }
    const clientName = clientDoc.data()?.['Client Name'] || 'Unknown Client';

    const groupData: { [key: string]: any } = {
      clientId,
      clientName,
      caregiverEmails,
      clientAccessEnabled: !!clientAccessEnabled,
      status: 'Active',
      lastUpdatedAt: Timestamp.now(),
      vaLast4SSN: vaLast4SSN || null,
      vaReferralNumber: vaReferralNumber || null,
    };
    
    if (isVaTemplate) {
        if (!vaClientId) {
            return { message: "VA Client ID is required for VA templates.", error: true };
        }
        groupData.vaClientId = vaClientId;
    } else {
        groupData.vaClientId = null;
    }


    if (careLogTemplateId && careLogTemplateId !== 'none') {
        groupData.careLogTemplateId = careLogTemplateId;
    } else {
        groupData.careLogTemplateId = null;
    }

    let docId = groupId;
    let wasVaGroup = false;

    if (docId) {
      const existingDoc = await firestore.collection('carelog_groups').doc(docId).get();
      if (existingDoc.exists) {
          wasVaGroup = !!existingDoc.data()?.vaClientId;
      }
      await firestore.collection('carelog_groups').doc(docId).update(groupData);
    } else {
      const groupRef = firestore.collection('carelog_groups').doc();
      docId = groupRef.id;
      await groupRef.set({ ...groupData, createdAt: Timestamp.now() });
    }

    if (isVaTemplate) {
        await updateVaClientsJson({ firestoreClientId: docId!, vaClientId: vaClientId!, clientName }, 'add-or-update');
    } else if (wasVaGroup) {
        await updateVaClientsJson({ firestoreClientId: docId! }, 'remove');
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
    const groupDoc = await groupRef.get();
    
    if (groupDoc.exists) {
        const groupData = groupDoc.data()!;
        if (groupData.vaClientId) {
            await updateVaClientsJson({ firestoreClientId: groupId }, 'remove');
        }
    }

    await groupRef.update({
        status: 'Inactive',
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
    
    const groupDoc = await groupRef.get();
    if (groupDoc.exists) {
        const groupData = groupDoc.data()!;
        if (groupData.vaClientId) {
            await updateVaClientsJson({ 
                firestoreClientId: groupId, 
                vaClientId: groupData.vaClientId, 
                clientName: groupData.clientName 
            }, 'add-or-update');
        }
    }
    
    await groupRef.update({
        status: 'Active',
        lastUpdatedAt: Timestamp.now(),
    });

    revalidatePath('/staffing-admin');
    return { message: "CareLog group has been reactivated successfully." };
  } catch (error: any) {
    console.error("Error reactivating CareLog group:", error);
    return { message: `An error occurred while reactivating the group: ${error.message}`, error: true };
  }
}

export async function saveCareLogTemplate(template: any) {
    const { id, ...data } = template;
    const firestore = serverDb;
    const now = Timestamp.now();
    try {
        if (id) {
            const docRef = firestore.collection('carelog_templates').doc(id);
            await docRef.update({ ...data, lastUpdatedAt: now });
        } else {
            const docRef = firestore.collection('carelog_templates').doc();
            await docRef.set({ ...data, createdAt: now, lastUpdatedAt: now });
        }
        revalidatePath('/staffing-admin');
        return { message: 'Template saved successfully.' };
    } catch (e: any) {
        return { message: `Error saving template: ${e.message}`, error: true };
    }
}

export async function deleteCareLogTemplate(id: string) {
    const firestore = serverDb;
    try {
        await firestore.collection('carelog_templates').doc(id).delete();
        revalidatePath('/staffing-admin');
        return { message: 'Template deleted successfully.' };
    } catch (e: any) {
        return { message: `Error deleting template: ${e.message}`, error: true };
    }
}

export async function saveVATaskTemplate(template: any) {
    const { id, ...data } = template;
    const validation = vaTaskTemplateSchema.safeParse(data);

    if (!validation.success) {
        console.error("VA Template Validation Error:", validation.error.flatten());
        return { message: "Invalid template data.", error: true };
    }

    const firestore = serverDb;
    const now = Timestamp.now();
    try {
        if (id) {
            const docRef = firestore.collection('va_task_templates').doc(id);
            await docRef.update({ ...validation.data, lastUpdatedAt: now });
        } else {
            const docRef = firestore.collection('va_task_templates').doc();
            await docRef.set({ ...validation.data, createdAt: now, lastUpdatedAt: now });
        }
        revalidatePath('/staffing-admin');
        return { message: 'VA Task Template saved successfully.' };
    } catch (e: any) {
        return { message: `Error saving VA template: ${e.message}`, error: true };
    }
}

export async function deleteVATaskTemplate(id: string) {
    const firestore = serverDb;
    try {
        await firestore.collection('va_task_templates').doc(id).delete();
        revalidatePath('/staffing-admin');
        return { message: 'VA Task Template deleted successfully.' };
    } catch (e: any) {
        return { message: `Error deleting VA template: ${e.message}`, error: true };
    }
}
