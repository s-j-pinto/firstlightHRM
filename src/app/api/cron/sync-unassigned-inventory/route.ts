
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb, serverApp } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { calculateUnassignedRecommendations } from '@/lib/unassigned-shifts.actions';
import type { TeleTrackWeeklyUnassignedShiftsInventory, TeleTrackUnassignedWeeklyCaregiversList, ActiveCaregiver } from '@/lib/types';

/**
 * API route to handle a weekly cron job for syncing TeleTrack unassigned inventory data.
 * This job reads two JSON files from GCS, pre-calculates caregiver recommendations for 
 * each shift using the rules engine, and stores everything as single documents in Firestore.
 */
export async function GET(request: NextRequest) {
  const logMessages: string[] = [`[SYNC-UNASSIGNED-INVENTORY] Job started at ${new Date().toISOString()}`];
  
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[CRON] Unauthorized access attempt.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bucket = getStorage(serverApp).bucket('gs://firstlighthomecare-hrm.firebasestorage.app');
    const now = Timestamp.now();

    // 1. Fetch Inventory JSON
    logMessages.push("Fetching TeleTrack-unassigned-weekly-shifts-inventory.json...");
    const inventoryFile = bucket.file('caregiver-scheduling/TeleTrack-unassigned-weekly-shifts-inventory.json');
    const [inventoryContent] = await inventoryFile.download();
    const inventoryData = JSON.parse(inventoryContent.toString()) as TeleTrackWeeklyUnassignedShiftsInventory;
    logMessages.push(`Inventory data fetched for week: ${inventoryData.weekStart} to ${inventoryData.weekEnd}`);

    // 2. Fetch Caregivers List JSON (Prior/Denied)
    logMessages.push("Fetching TeleTrack-unassigned-shifts-caregivers-list.json...");
    const caregiversListFile = bucket.file('caregiver-scheduling/TeleTrack-unassigned-shifts-caregivers-list.json');
    const [caregiversListContent] = await caregiversListFile.download();
    const caregiversListData = JSON.parse(caregiversListContent.toString()) as TeleTrackUnassignedWeeklyCaregiversList;
    logMessages.push(`Unassigned caregivers list fetched. Total clients: ${caregiversListData.totalClients}`);

    // 3. Prepare Bulk Data for Rules Engine
    logMessages.push("Fetching master data for pre-calculation...");
    
    // Fetch all active caregivers and their availability in bulk
    const activeCaregiversSnap = await serverDb.collection('caregivers_active').where('status', '==', 'Active').get();
    const activeCaregiversPool = [];
    for (const doc of activeCaregiversSnap.docs) {
        const availDoc = await doc.ref.collection('availability').doc('current_week').get();
        activeCaregiversPool.push({
            id: doc.id,
            data: {
                ...doc.data(),
                availability: availDoc.exists ? availDoc.data() : null
            }
        });
    }

    // Fetch all clients to get their addresses for distance checks
    const clientsSnap = await serverDb.collection('Clients').get();
    const clientsMap = new Map();
    clientsSnap.forEach(doc => {
        const d = doc.data();
        clientsMap.set(d['Client Name']?.trim().toLowerCase(), d);
    });

    logMessages.push(`Processing recommendations for ${inventoryData.shifts.length} unassigned shifts...`);

    // 4. Run Rules Engine for each shift
    const enrichedShifts = [];
    for (const shift of inventoryData.shifts) {
        const clientNameNormalized = shift.client.name.trim().toLowerCase();
        
        // Get Prior/Denied lists for this specific client
        const clientListEntry = caregiversListData.clients.find(c => c.clientName.trim().toLowerCase() === clientNameNormalized);
        const priorCaregiverNames = clientListEntry ? clientListEntry.caregivers.map(cg => cg.caregiverName.trim().toLowerCase()) : [];
        const deniedCaregiverNames = clientListEntry ? clientListEntry.deniedCaregivers.map(cg => cg.caregiverName.trim().toLowerCase()).filter(n => n !== "there are no denied caregivers.") : [];

        // Get Client Address for proximity
        const clientDoc = clientsMap.get(clientNameNormalized);
        const clientAddress = clientDoc ? `${clientDoc.Address}, ${clientDoc.City}` : null;

        const recs = await calculateUnassignedRecommendations({
            shift,
            priorCaregiverNames,
            deniedCaregiverNames,
            activeCaregivers: activeCaregiversPool,
            clientAddress
        });

        enrichedShifts.push({
            ...shift,
            recommendations: recs
        });
    }

    // 5. Purge and Save Inventory
    logMessages.push("Purging old inventory and saving pre-calculated recommendations...");
    const existingInventorySnap = await serverDb.collection('teletrack_weekly_unassigned_shifts_inventory').get();
    if (!existingInventorySnap.empty) {
        const batch = serverDb.batch();
        existingInventorySnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        logMessages.push(`Deleted ${existingInventorySnap.size} existing inventory documents.`);
    }

    const inventoryRef = serverDb.collection('teletrack_weekly_unassigned_shifts_inventory').doc();
    await inventoryRef.set({
        ...inventoryData,
        shifts: enrichedShifts,
        syncedAt: now,
    });
    logMessages.push(`Saved unassigned inventory with recommendations: ${inventoryRef.id}`);

    // 6. Purge and Save Caregivers List
    const existingListSnap = await serverDb.collection('teletrack_unassigned_weekly_caregivers_list').get();
    if (!existingListSnap.empty) {
        const batch = serverDb.batch();
        existingListSnap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }

    const caregiversListRef = serverDb.collection('teletrack_unassigned_weekly_caregivers_list').doc();
    await caregiversListRef.set({
        ...caregiversListData,
        syncedAt: now,
    });

    // 7. Finalize Log
    try {
        const logFile = bucket.file('caregiver-scheduling/sync-unassigned-run.log');
        await logFile.save(logMessages.join('\n'), { contentType: 'text/plain' });
    } catch (logError) {}

    return NextResponse.json({ 
        success: true, 
        message: "Inventory synced and recommendations pre-calculated successfully.",
        inventoryDocId: inventoryRef.id
    });

  } catch (error: any) {
    logMessages.push(`[ERROR] Job failed: ${error.message}`);
    console.error('[CRON-ERROR] /api/cron/sync-unassigned-inventory:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
