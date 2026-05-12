
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb, serverApp } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * API route to handle a weekly cron job for syncing TeleTrack calloff inventory data.
 * This job reads two JSON files from GCS and stores them as single documents in Firestore.
 */
export async function GET(request: NextRequest) {
  const logMessages: string[] = [`[SYNC-CALLOFF-INVENTORY] Job started at ${new Date().toISOString()}`];
  
  // 1. Secure the endpoint
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[CRON] Unauthorized access attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bucket = getStorage(serverApp).bucket('gs://firstlighthomecare-hrm.firebasestorage.app');
    const now = Timestamp.now();

    // --- Task 1: Sync Shifts Inventory ---
    logMessages.push("Fetching TeleTrack-calloff-weekly-shifts-inventory.json...");
    const inventoryFile = bucket.file('caregiver-scheduling/TeleTrack-calloff-weekly-shifts-inventory.json');
    const [inventoryContent] = await inventoryFile.download();
    const inventoryData = JSON.parse(inventoryContent.toString());
    
    logMessages.push(`Inventory data fetched for week: ${inventoryData.weekStart} to ${inventoryData.weekEnd}`);

    const inventoryRef = serverDb.collection('teletrack_weekly_shifts_inventory').doc();
    await inventoryRef.set({
        ...inventoryData,
        syncedAt: now,
    });
    logMessages.push(`Saved shift inventory as document: ${inventoryRef.id}`);

    // --- Task 2: Sync Caregivers List ---
    logMessages.push("Fetching TeleTrack-calloff-weekly-caregivers-list.json...");
    const caregiversFile = bucket.file('caregiver-scheduling/TeleTrack-calloff-weekly-caregivers-list.json');
    const [caregiversContent] = await caregiversFile.download();
    const caregiversData = JSON.parse(caregiversContent.toString());

    logMessages.push(`Caregivers list fetched. Total clients: ${caregiversData.totalClients}`);

    const caregiversListRef = serverDb.collection('teletrack_calloff_weekly_caregivers_list').doc();
    await caregiversListRef.set({
        ...caregiversData,
        syncedAt: now,
    });
    logMessages.push(`Saved caregivers list as document: ${caregiversListRef.id}`);

    // --- Save Log ---
    try {
        const logFile = bucket.file('caregiver-scheduling/sync-calloff-run.log');
        await logFile.save(logMessages.join('\n'), { contentType: 'text/plain' });
    } catch (logError) {
        console.error("Failed to save run.log:", logError);
    }

    console.log('[CRON] Sync Calloff Inventory successful.');
    return NextResponse.json({ 
        success: true, 
        message: "Inventory and Caregivers list synchronized successfully.",
        inventoryDocId: inventoryRef.id,
        caregiversDocId: caregiversListRef.id
    });

  } catch (error: any) {
    logMessages.push(`[ERROR] Job failed: ${error.message}`);
    console.error('[CRON-ERROR] /api/cron/sync-calloff-inventory:', error);
    
    // Attempt to save error log
    try {
        const bucket = getStorage(serverApp).bucket('gs://firstlighthomecare-hrm.firebasestorage.app');
        const logFile = bucket.file('caregiver-scheduling/sync-calloff-run.log');
        await logFile.save(logMessages.join('\n'), { contentType: 'text/plain' });
    } catch (logError) {}

    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
