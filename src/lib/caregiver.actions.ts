
"use server";

import { revalidatePath } from "next/cache";
import { serverDb } from "@/firebase/server-init";
import { z } from "zod";
import { generalInfoSchema, type CaregiverProfile } from "./types";
import { WriteBatch, Timestamp } from "firebase-admin/firestore";
import { parse, isValid } from 'date-fns';

interface SearchParams {
    namePrefix?: string;
    hiringStatus?: string;
    dateFrom?: string;
    dateTo?: string;
    lastDocId?: string;
    limit?: number;
}

/**
 * Optimized server-side search for candidates using Admin SDK field projection.
 */
export async function searchCandidatesAction(params: SearchParams) {
    console.log("[searchCandidatesAction] Parameters:", JSON.stringify(params));
    let query = serverDb.collection('caregiver_profiles') as FirebaseFirestore.Query;

    // 1. Prefix Matching for Name or Email
    if (params.namePrefix && params.namePrefix.trim() !== '') {
        const term = params.namePrefix.trim();
        const prefix = term.toLowerCase();

        // Simple check: if it looks like an email, do an equality check
        if (term.includes('@')) {
            query = query.where('email', '==', prefix).orderBy('createdAt', 'desc');
        } else {
            // Standard Firestore prefix range query
            query = query.where('fullNameLowercase', '>=', prefix)
                         .where('fullNameLowercase', '<=', prefix + '\uf8ff')
                         .orderBy('fullNameLowercase', 'asc');
        }
    } else {
        // Default order to newest first if not searching by name
        query = query.orderBy('createdAt', 'desc');
    }

    // 2. Equality filter for status
    if (params.hiringStatus && params.hiringStatus !== 'any') {
        query = query.where('hiringStatus', '==', params.hiringStatus);
    }

    // 3. Date Filters
    if (params.dateFrom) {
        try {
            const fromDate = parse(params.dateFrom, 'MM/dd/yyyy', new Date());
            if (isValid(fromDate)) {
                query = query.where('createdAt', '>=', Timestamp.fromDate(fromDate));
            }
        } catch (e) {}
    }

    if (params.dateTo) {
        try {
            const toDate = parse(params.dateTo, 'MM/dd/yyyy', new Date());
            if (isValid(toDate)) {
                toDate.setHours(23, 59, 59, 999);
                query = query.where('createdAt', '<=', Timestamp.fromDate(toDate));
            }
        } catch (e) {}
    }

    // 4. Pagination
    if (params.lastDocId) {
        const lastDoc = await serverDb.collection('caregiver_profiles').doc(params.lastDocId).get();
        if (lastDoc.exists) {
            query = query.startAfter(lastDoc);
        }
    }

    const pageSize = params.limit || 10;
    query = query.limit(pageSize);

    // 5. Field Projection
    const selectFields = [
        'fullName', 
        'fullNameLowercase',
        'email', 
        'phone', 
        'city', 
        'createdAt', 
        'hiringStatus', 
        'docsStatus', 
        'nextStepText', 
        'nextStepTime',
        'master360Saved',
        'newHireChecklistComplete'
    ];
    
    try {
        const snapshot = await query.select(...selectFields).get();

        const results = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                fullName: data.fullName || 'Unknown',
                email: data.email || '',
                phone: data.phone || '',
                city: data.city || '',
                hiringStatus: data.hiringStatus || 'Applied',
                docsStatus: data.docsStatus || 'not-notified',
                nextStepText: data.nextStepText || 'Needs Phone Screen',
                createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
                nextStepTime: data.nextStepTime ? data.nextStepTime.toDate().toISOString() : null,
                master360Saved: !!data.master360Saved,
                newHireChecklistComplete: !!data.newHireChecklistComplete,
            };
        });

        console.log(`[searchCandidatesAction] Found ${results.length} results.`);

        return {
            results,
            lastDocId: results.length > 0 ? results[results.length - 1].id : null,
            hasMore: results.length === pageSize
        };
    } catch (error: any) {
        console.error("[searchCandidatesAction] Error:", error.message);
        if (error.message?.includes('FAILED_PRECONDITION')) {
            return { results: [], hasMore: false, error: error.message };
        }
        throw error;
    }
}

export async function updateCaregiverProfile(
  profileId: string,
  data: z.infer<typeof generalInfoSchema>
) {
  const validatedFields = generalInfoSchema.safeParse(data);

  if (!validatedFields.success) {
    return { message: "Invalid data provided.", error: true };
  }

  try {
    const firestore = serverDb;
    const profileRef = firestore.collection("caregiver_profiles").doc(profileId);

    const updateData = {
        ...validatedFields.data,
        fullNameLowercase: (validatedFields.data.fullName || '').toLowerCase(),
        lastUpdatedAt: Timestamp.now(),
    };

    await profileRef.set(updateData, { merge: true });

    revalidatePath("/admin/manage-applications");
    revalidatePath("/admin");

    return { message: "Caregiver profile updated successfully." };
  } catch (error) {
    console.error("Error updating caregiver profile:", error);
    return { message: "Failed to update profile.", error: true };
  }
}

async function findAndBatchDelete(
  batch: WriteBatch,
  collectionName: string,
  field: string,
  value: string
) {
  const snapshot = await serverDb.collection(collectionName).where(field, "==", value).get();
  snapshot.forEach(doc => batch.delete(doc.ref));
}

export async function deleteCaregiverProfile(profileId: string) {
  if (!profileId) {
    return { message: "Caregiver Profile ID is required.", error: true };
  }

  try {
    const batch = serverDb.batch();
    const profileRef = serverDb.collection("caregiver_profiles").doc(profileId);
    batch.delete(profileRef);
    await findAndBatchDelete(batch, "interviews", "caregiverProfileId", profileId);
    await findAndBatchDelete(batch, "appointments", "caregiverId", profileId);
    const employeeRef = serverDb.collection("caregiver_employees").doc(profileId);
    batch.delete(employeeRef);
    await batch.commit();

    revalidatePath("/admin/manage-applications");
    revalidatePath("/admin");
    return { message: "Caregiver profile and all related records deleted successfully." };
  } catch (error: any) {
    console.error("Error deleting caregiver profile:", error);
    return { message: `Failed to delete profile: ${error.message}`, error: true };
  }
}

export async function resetCaregiverInterview(profileId: string) {
  if (!profileId) {
    return { message: "Caregiver Profile ID is required.", error: true };
  }

  try {
    const batch = serverDb.batch();
    await findAndBatchDelete(batch, "interviews", "caregiverProfileId", profileId);
    const employeeRef = serverDb.collection("caregiver_employees").doc(profileId);
    batch.delete(employeeRef);

    batch.update(serverDb.collection("caregiver_profiles").doc(profileId), {
        hiringStatus: 'Applied',
        docsStatus: 'not-notified',
        nextStepText: 'Needs Phone Screen',
        nextStepTime: null,
        lastUpdatedAt: Timestamp.now(),
    });

    await batch.commit();

    revalidatePath("/admin/manage-applications");
    revalidatePath("/admin");
    return { message: "Caregiver interview and employment records have been reset." };
  } catch (error: any) {
    console.error("Error resetting caregiver interview:", error);
    return { message: `Failed to reset interview: ${error.message}`, error: true };
  }
}
