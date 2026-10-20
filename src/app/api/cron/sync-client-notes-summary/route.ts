
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb, serverApp } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * API route to handle a weekly cron job for syncing AI-generated Client Notes Summaries.
 * Reads the latest JSON from GCS and stores it as a document in Firestore.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting Client Notes Summary sync job.');
    const firestore = serverDb;

    try {
        const bucket = getStorage(serverApp).bucket('gs://firstlighthomecare-hrm.firebasestorage.app');
        const file = bucket.file('client-notes-summary/Weekly_Notes_Summary_ai-output.json');
        
        const [contents] = await file.download();
        const data = JSON.parse(contents.toString());

        if (!data || !data.reportDate) {
            throw new Error("Invalid JSON structure: Missing reportDate.");
        }

        // We store the report using the reportDate to avoid duplicates for the same run
        const docId = data.reportDate.split('T')[0]; // Use YYYY-MM-DD as ID part
        const reportRef = firestore.collection('client_notes_summaries').doc(docId);
        
        await reportRef.set({
            ...data,
            syncedAt: Timestamp.now(),
        });

        console.log(`[CRON] Successfully synced report for date: ${data.reportDate}`);
        return NextResponse.json({ 
            success: true, 
            docId: reportRef.id,
            reportDate: data.reportDate 
        });

    } catch (error: any) {
        console.error('[CRON ERROR] sync-client-notes-summary failed:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
}
