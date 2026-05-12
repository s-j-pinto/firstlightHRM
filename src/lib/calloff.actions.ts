
'use server';

import { serverDb } from '@/firebase/server-init';
import { format, parseISO, isValid } from 'date-fns';
import { recommendReplacementCaregivers } from '@/ai/flows/recommend-replacement-caregiver-flow';
import type { TeleTrackWeeklyShiftsInventory, TeleTrackCalloffWeeklyCaregiversList, ActiveCaregiver } from './types';

interface GetRecommendationsPayload {
    shiftId: string;
    weekStart: string;
    clientName: string;
}

export async function getReplacementRecommendations(payload: GetRecommendationsPayload) {
    const { shiftId, weekStart, clientName } = payload;
    const firestore = serverDb;

    try {
        // 1. Get the specific shift details
        const inventorySnap = await firestore.collection('teletrack_weekly_shifts_inventory')
            .where('weekStart', '==', weekStart)
            .limit(1)
            .get();
        
        if (inventorySnap.empty) return { error: "Shift inventory not found." };
        const inventory = inventorySnap.docs[0].data() as TeleTrackWeeklyShiftsInventory;
        const shift = inventory.shifts.find(s => s.scheduleId === shiftId);
        if (!shift) return { error: "Selected shift details not found." };

        const dayName = format(parseISO(shift.date), 'eeee').toLowerCase();

        // 2. Get prior caregivers for this client
        const calloffListSnap = await firestore.collection('teletrack_calloff_weekly_caregivers_list')
            .orderBy('syncedAt', 'desc')
            .limit(1)
            .get();
        
        let priorCaregiverNames: string[] = [];
        if (!calloffListSnap.empty) {
            const list = calloffListSnap.docs[0].data() as TeleTrackCalloffWeeklyCaregiversList;
            const clientEntry = list.clients.find(c => c.clientName === clientName);
            if (clientEntry) {
                priorCaregiverNames = clientEntry.caregivers.map(cg => cg.caregiverName);
            }
        }

        // 3. Find caregivers already working during this time range
        const conflictingCaregivers = new Set(
            inventory.shifts
                .filter(s => s.scheduleId !== shiftId && s.date === shift.date) // Same day, different shift
                .filter(s => {
                    // Simple overlap check (could be more robust with full Date objects)
                    return s.arrivalTime === shift.arrivalTime || s.departureTime === shift.departureTime;
                })
                .map(s => s.caregiver.name)
        );

        // 4. Fetch all active caregivers and their availability
        const activeCaregiversSnap = await firestore.collection('caregivers_active')
            .where('status', '==', 'Active')
            .get();
        
        const candidates: any[] = [];

        for (const doc of activeCaregiversSnap.docs) {
            const caregiver = doc.data() as ActiveCaregiver;
            
            // Skip if they are already working during this time
            if (conflictingCaregivers.has(caregiver.Name)) continue;

            // Fetch availability subcollection
            const availDoc = await doc.ref.collection('availability').doc('current_week').get();
            if (!availDoc.exists) continue;

            const availability = availDoc.data();
            const dayAvail = availability?.[dayName];

            if (dayAvail && dayAvail.hasAvailabilityBlock) {
                candidates.push({
                    id: doc.id,
                    name: caregiver.Name,
                    isPriorCaregiver: priorCaregiverNames.includes(caregiver.Name),
                    availabilityText: dayAvail.schedule || '',
                    nonOvertimeHours: dayAvail.nonOvertimeHours || 0,
                });
            }
        }

        if (candidates.length === 0) {
            return { error: "No active caregivers found with availability for this day." };
        }

        // 5. Run the Genkit Flow
        const result = await recommendReplacementCaregivers({
            clientName,
            shiftDate: shift.date,
            shiftTime: `${shift.arrivalTime} to ${shift.departureTime}`,
            shiftHours: shift.hours,
            candidates
        });

        return result;

    } catch (error: any) {
        console.error("[Action Error] getReplacementRecommendations:", error);
        return { error: `Failed to generate recommendations: ${error.message}` };
    }
}
