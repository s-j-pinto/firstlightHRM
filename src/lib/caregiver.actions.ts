
"use server";

import { revalidatePath } from "next/cache";
import { serverDb } from "@/firebase/server-init";
import { z } from "zod";
import { generalInfoSchema, type CaregiverProfile, type Interview, type Appointment, type CaregiverEmployee } from "./types";
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
 * Resolves the true status of a candidate by checking related documents.
 */
function resolveTrueStatus(profile: any, interview?: any, employee?: any, appointment?: any): string {
    if (employee) return 'Hired';

    if (interview) {
        if (interview.rejectionReason) return interview.rejectionReason;
        if (interview.phoneScreenPassed === 'No') return 'Phone Screen Failed';
        if (interview.finalInterviewStatus === 'Rejected at Orientation') return 'Rejected at Orientation';
        if (interview.finalInterviewStatus === 'No Show') return 'No Show';
        if (interview.finalInterviewStatus === 'Process Terminated') return 'Process Terminated';
        if (interview.orientationScheduled) return 'Orientation Scheduled';
        if (interview.finalInterviewStatus === 'Passed') return 'Final Interview Passed';
        if (interview.finalInterviewStatus === 'Failed') return 'Final Interview Failed';
        if (interview.finalInterviewStatus === 'Pending reference checks') return 'Pending reference checks';
        return 'Final Interview Pending';
    }

    if (appointment) {
        return (appointment.inviteSent || profile.hiringStatus === 'Phonescreen Scheduled') ? 'Phonescreen Scheduled' : 'Phonescreen Invite Needed';
    }

    if (profile.hiringStatus) {
        return profile.hiringStatus;
    }

    return 'Applied';
}

/**
 * Optimized server-side search for candidates using Admin SDK field projection.
 */
export async function searchCandidatesAction(params: SearchParams) {
    let query = serverDb.collection('caregiver_profiles') as FirebaseFirestore.Query;

    if (params.namePrefix && params.namePrefix.trim() !== '') {
        const term = params.namePrefix.trim();
        const prefix = term.toLowerCase();

        if (term.includes('@')) {
            query = query.where('email', '==', prefix).orderBy('createdAt', 'desc');
        } else {
            query = query.where('fullNameLowercase', '>=', prefix)
                         .where('fullNameLowercase', '<=', prefix + '\uf8ff')
                         .orderBy('fullNameLowercase', 'asc');
        }
    } else {
        query = query.orderBy('createdAt', 'desc');
    }

    if (params.hiringStatus && params.hiringStatus !== 'any') {
        query = query.where('hiringStatus', '==', params.hiringStatus);
    }

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

    if (params.lastDocId) {
        const lastDoc = await serverDb.collection('caregiver_profiles').doc(params.lastDocId).get();
        if (lastDoc.exists) {
            query = query.startAfter(lastDoc);
        }
    }

    const pageSize = params.limit || 10;
    query = query.limit(pageSize);

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
        'newHireChecklistComplete',
        'availability',
        'canChangeBrief',
        'canTransfer',
        'canPrepareMeals',
        'canDoBedBath',
        'canUseHoyerLift',
        'canGiveMedication',
        'canTakeBloodPressure',
        'hasDementiaExperience',
        'hasHospiceExperience',
        'hca',
        'hha'
    ];
    
    try {
        const snapshot = await query.select(...selectFields).get();
        const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (profiles.length === 0) {
            return { results: [], hasMore: false, lastDocId: null };
        }

        const candidateIds = profiles.map(p => p.id);

        const [interviewsSnap, employeesSnap, appointmentsSnap] = await Promise.all([
            serverDb.collection('interviews').where('caregiverProfileId', 'in', candidateIds).get(),
            serverDb.collection('caregiver_employees').where('caregiverProfileId', 'in', candidateIds).get(),
            serverDb.collection('appointments').where('caregiverId', 'in', candidateIds).get(),
        ]);

        const interviewsMap = new Map(interviewsSnap.docs.map(doc => [doc.data().caregiverProfileId, doc.data()]));
        const employeesMap = new Map(employeesSnap.docs.map(doc => [doc.data().caregiverProfileId, doc.data()]));
        const appointmentsMap = new Map();
        appointmentsSnap.forEach(doc => {
            const data = doc.data();
            if (data.appointmentStatus !== 'cancelled') {
                appointmentsMap.set(data.caregiverId, data);
            }
        });

        const results = profiles.map(profile => {
            const interview = interviewsMap.get(profile.id);
            const employee = employeesMap.get(profile.id);
            const appointment = appointmentsMap.get(profile.id);

            return {
                id: profile.id,
                fullName: profile.fullName || 'Unknown',
                email: profile.email || '',
                phone: profile.phone || '',
                city: profile.city || '',
                hiringStatus: resolveTrueStatus(profile, interview, employee, appointment),
                docsStatus: profile.docsStatus || 'not-notified',
                nextStepText: profile.nextStepText || 'Needs Phone Screen',
                createdAt: profile.createdAt ? profile.createdAt.toDate().toISOString() : null,
                nextStepTime: profile.nextStepTime ? profile.nextStepTime.toDate().toISOString() : null,
                master360Saved: !!profile.master360Saved,
                newHireChecklistComplete: !!profile.newHireChecklistComplete,
                availability: profile.availability || null,
                canChangeBrief: !!profile.canChangeBrief,
                canTransfer: !!profile.canTransfer,
                canPrepareMeals: !!profile.canPrepareMeals,
                canDoBedBath: !!profile.canDoBedBath,
                canUseHoyerLift: !!profile.canUseHoyerLift,
                canGiveMedication: !!profile.canGiveMedication,
                canTakeBloodPressure: !!profile.canTakeBloodPressure,
                hasDementiaExperience: !!profile.hasDementiaExperience,
                hasHospiceExperience: !!profile.hasHospiceExperience,
                hca: !!profile.hca,
                hha: !!profile.hha
            };
        });

        return {
            results,
            lastDocId: results.length > 0 ? results[results.length - 1].id : null,
            hasMore: results.length === pageSize
        };
    } catch (error: any) {
        console.error("[searchCandidatesAction] Firestore Error:", error.message);
        return { results: [], hasMore: false, error: error.message || "An unexpected database error occurred." };
    }
}

/**
 * Server action to fetch paginated data for the Candidate Status Report.
 */
export async function getCandidateStatusReportAction(params: {
    searchTerm?: string;
    lastDocId?: string;
    limit?: number;
}) {
    let query = serverDb.collection('caregiver_profiles') as FirebaseFirestore.Query;

    if (params.searchTerm && params.searchTerm.trim() !== '') {
        const term = params.searchTerm.trim().toLowerCase();
        query = query.where('fullNameLowercase', '>=', term)
                     .where('fullNameLowercase', '<=', term + '\uf8ff')
                     .orderBy('fullNameLowercase', 'asc');
    } else {
        query = query.orderBy('createdAt', 'desc');
    }

    if (params.lastDocId) {
        const lastDoc = await serverDb.collection('caregiver_profiles').doc(params.lastDocId).get();
        if (lastDoc.exists) {
            query = query.startAfter(lastDoc);
        }
    }

    const pageSize = params.limit || 20;
    query = query.limit(pageSize);

    try {
        const snapshot = await query.get();
        const profiles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (profiles.length === 0) {
            return { results: [], hasMore: false, lastDocId: null };
        }

        const candidateIds = profiles.map(p => p.id);

        const [interviewsSnap, employeesSnap, appointmentsSnap] = await Promise.all([
            serverDb.collection('interviews').where('caregiverProfileId', 'in', candidateIds).get(),
            serverDb.collection('caregiver_employees').where('caregiverProfileId', 'in', candidateIds).get(),
            serverDb.collection('appointments').where('caregiverId', 'in', candidateIds).get(),
        ]);

        const interviewsMap = new Map(interviewsSnap.docs.map(doc => [doc.data().caregiverProfileId, doc.data()]));
        const employeesMap = new Map(employeesSnap.docs.map(doc => [doc.data().caregiverProfileId, doc.data()]));
        const appointmentsMap = new Map();
        appointmentsSnap.forEach(doc => {
            const data = doc.data();
            if (data.appointmentStatus !== 'cancelled') {
                appointmentsMap.set(data.caregiverId, data);
            }
        });

        const results = profiles.map(profile => {
            const interview = interviewsMap.get(profile.id);
            const employee = employeesMap.get(profile.id);
            const appointment = appointmentsMap.get(profile.id);

            return {
                id: profile.id,
                fullName: profile.fullName,
                email: profile.email,
                phone: profile.phone,
                status: resolveTrueStatus(profile, interview, employee, appointment),
                interview: interview ? JSON.parse(JSON.stringify(interview)) : null,
                employee: employee ? JSON.parse(JSON.stringify(employee)) : null,
                appointment: appointment ? JSON.parse(JSON.stringify(appointment)) : null,
                createdAt: profile.createdAt ? profile.createdAt.toDate().toISOString() : null,
            };
        });

        return {
            results,
            lastDocId: results.length > 0 ? results[results.length - 1].id : null,
            hasMore: results.length === pageSize
        };
    } catch (error: any) {
        console.error("[getCandidateStatusReportAction] Error:", error);
        return { error: error.message, results: [], hasMore: false };
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
