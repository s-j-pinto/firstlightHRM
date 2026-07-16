
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { subMonths } from 'date-fns';

/**
 * API route to handle a monthly housekeeping job.
 * Deletes old non-hired candidates and associated records, and old mail logs.
 */
export async function GET(request: NextRequest) {
    // 1. Secure the endpoint
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[HOUSEKEEPING] Starting monthly maintenance job.');
    const firestore = serverDb;
    const now = new Date();
    const threeMonthsAgo = subMonths(now, 3);
    const cutoffTimestamp = Timestamp.fromDate(threeMonthsAgo);

    const stats = {
        candidatesDeleted: 0,
        interviewsDeleted: 0,
        appointmentsDeleted: 0,
        mailDeleted: 0,
        errors: 0,
    };

    try {
        // --- 1. Clean up Caregiver Profiles ---
        // We query by date and filter status in memory to avoid needing complex composite indexes
        const profilesSnap = await firestore.collection('caregiver_profiles')
            .where('createdAt', '<', cutoffTimestamp)
            .get();

        if (!profilesSnap.empty) {
            console.log(`[HOUSEKEEPING] Found ${profilesSnap.size} potentially old profiles to evaluate.`);
            
            let batch = firestore.batch();
            let batchCount = 0;

            for (const profileDoc of profilesSnap.docs) {
                const profileData = profileDoc.data();
                const profileId = profileDoc.id;

                // Skip if the candidate was hired
                if (profileData.hiringStatus === 'Hired') continue;

                // Mark profile for deletion
                batch.delete(profileDoc.ref);
                batchCount++;
                stats.candidatesDeleted++;

                // Delete 'signatures/onboarding_main' subcollection doc
                const sigRef = profileDoc.ref.collection('signatures').doc('onboarding_main');
                batch.delete(sigRef);
                batchCount++;

                // Find and delete associated interviews
                const interviewsQuery = await firestore.collection('interviews')
                    .where('caregiverProfileId', '==', profileId)
                    .get();
                interviewsQuery.forEach(doc => {
                    batch.delete(doc.ref);
                    batchCount++;
                    stats.interviewsDeleted++;
                });

                // Find and delete associated appointments
                const appointmentsQuery = await firestore.collection('appointments')
                    .where('caregiverId', '==', profileId)
                    .get();
                appointmentsQuery.forEach(doc => {
                    batch.delete(doc.ref);
                    batchCount++;
                    stats.appointmentsDeleted++;
                });

                // Check batch limit (Firestore limit is 500)
                if (batchCount >= 400) {
                    await batch.commit();
                    batch = firestore.batch();
                    batchCount = 0;
                }
            }
            if (batchCount > 0) await batch.commit();
        }

        // --- 2. Clean up Mail logs ---
        const mailSnap = await firestore.collection('mail')
            .where('delivery.startTime', '<', cutoffTimestamp)
            .get();

        if (!mailSnap.empty) {
            console.log(`[HOUSEKEEPING] Found ${mailSnap.size} old mail logs to delete.`);
            let mailBatch = firestore.batch();
            let mailBatchCount = 0;

            for (const mailDoc of mailSnap.docs) {
                mailBatch.delete(mailDoc.ref);
                mailBatchCount++;
                stats.mailDeleted++;

                if (mailBatchCount >= 450) {
                    await mailBatch.commit();
                    mailBatch = firestore.batch();
                    mailBatchCount = 0;
                }
            }
            if (mailBatchCount > 0) await mailBatch.commit();
        }

        console.log('[HOUSEKEEPING] Job completed successfully.', stats);
        return NextResponse.json({ success: true, ...stats });

    } catch (error: any) {
        console.error('[HOUSEKEEPING] Error during maintenance:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
