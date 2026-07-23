
'use server';

import { serverDb } from '@/firebase/server-init';
import { format, parseISO, isValid, parse } from 'date-fns';
import type { TeleTrackWeeklyShiftsInventory, TeleTrackCalloffWeeklyCaregiversList, ActiveCaregiver, ReplacementRecommendation } from './types';

interface GetRecommendationsPayload {
    shiftId: string;
    weekStart: string;
    clientName: string;
}

/**
 * Parses time strings like "7:00:00 AM" or "7:00 AM" into comparable minute-of-day integers.
 */
function timeToMinutes(timeStr: string): number {
    if (!timeStr) return -1;
    try {
        const cleaned = timeStr.trim().toUpperCase().replace(' TO ', '');
        const hasSeconds = (cleaned.match(/:/g) || []).length === 2;
        const formatStr = hasSeconds ? 'h:mm:ss a' : 'h:mm a';
        const date = parse(cleaned, formatStr, new Date());
        
        if (!isValid(date)) {
            // Fallback for missing spaces before AM/PM
            const normalized = cleaned.replace(/([AP]M)$/, ' $1');
            const dateFallback = parse(normalized, formatStr, new Date());
            if (isValid(dateFallback)) {
                return dateFallback.getHours() * 60 + dateFallback.getMinutes();
            }
            return -1;
        }

        return date.getHours() * 60 + date.getMinutes();
    } catch (e) {
        console.warn(`[timeToMinutes] Failed to parse time: "${timeStr}"`);
        return -1;
    }
}

/**
 * Rules Engine for ranking replacement caregivers.
 */
export async function getReplacementRecommendations(payload: GetRecommendationsPayload) {
    const { shiftId, weekStart, clientName } = payload;
    const firestore = serverDb;

    try {
        console.log(`[getReplacementRecommendations] Fetching inventory for shift: ${shiftId}, week: ${weekStart}`);
        
        // 1. Get the specific shift details
        const inventorySnap = await firestore.collection('teletrack_weekly_shifts_inventory')
            .where('weekStart', '==', weekStart)
            .orderBy('syncedAt', 'desc')
            .limit(1)
            .get();
        
        if (inventorySnap.empty) {
            console.warn(`[getReplacementRecommendations] No inventory found for ${weekStart}`);
            return { error: "Shift inventory not found. Please ensure the weekly sync has run successfully." };
        }
        
        const inventory = inventorySnap.docs[0].data() as TeleTrackWeeklyShiftsInventory;
        const shift = inventory.shifts.find(s => s.scheduleId === shiftId);
        if (!shift) {
            console.error(`[getReplacementRecommendations] Shift ID ${shiftId} not found in inventory.`);
            return { error: "Selected shift details not found in inventory." };
        }

        const dayName = format(parseISO(shift.date), 'eeee').toLowerCase();
        const shiftStartMins = timeToMinutes(shift.arrivalTime);
        const shiftEndMins = timeToMinutes(shift.departureTime);

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
                .filter(s => s.scheduleId !== shiftId && s.date === shift.date)
                .filter(s => {
                    const sStart = timeToMinutes(s.arrivalTime);
                    const sEnd = timeToMinutes(s.departureTime);
                    if (sStart === -1 || sEnd === -1) return false;
                    // Check for any overlap
                    return (shiftStartMins < sEnd && shiftEndMins > sStart);
                })
                .map(s => s.caregiver.name)
        );

        // 4. Fetch all active caregivers and score them
        const activeCaregiversSnap = await firestore.collection('caregivers_active')
            .where('status', '==', 'Active')
            .get();
        
        const recommendations: ReplacementRecommendation[] = [];

        for (const doc of activeCaregiversSnap.docs) {
            const caregiver = doc.data() as ActiveCaregiver;
            
            // Filter: No conflicts
            if (conflictingCaregivers.has(caregiver.Name)) continue;

            // Filter: Fetch availability
            const availDoc = await doc.ref.collection('availability').doc('current_week').get();
            if (!availDoc.exists) continue;

            const availability = availDoc.data();
            const dayAvail = availability?.[dayName];

            // Filter: Must have availability block
            if (!dayAvail || !dayAvail.hasAvailabilityBlock) continue;

            let score = 0;
            const reasons: string[] = [];

            // RULE 1: Continuity of Care (50 pts)
            const isPrior = priorCaregiverNames.includes(caregiver.Name);
            if (isPrior) {
                score += 50;
                reasons.push("Prior relationship: This caregiver has worked with the client before (+50 pts).");
            } else {
                reasons.push("No prior history found with this client.");
            }

            // RULE 2: Availability Match (30 pts)
            const availRegex = /(?:Available|Scheduled Availability)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/gi;
            let bestAvailScore = 0;
            let match;
            while ((match = availRegex.exec(dayAvail.schedule || "")) !== null) {
                const aStart = timeToMinutes(match[1]);
                const aEnd = timeToMinutes(match[2]);
                
                if (aStart !== -1 && aEnd !== -1) {
                    if (aStart <= shiftStartMins && aEnd >= shiftEndMins) {
                        bestAvailScore = 30; // Full match
                    } else if (aStart < shiftEndMins && aEnd > shiftStartMins) {
                        bestAvailScore = Math.max(bestAvailScore, 10); // Partial match
                    }
                }
            }
            score += bestAvailScore;
            reasons.push(bestAvailScore === 30 ? "Full Schedule Match: Shift fits perfectly in availability window (+30 pts)." : 
                         bestAvailScore === 10 ? "Partial Schedule Match: Caregiver available for part of the shift (+10 pts)." : 
                         "Availability overlap requires manual verification.");

            // RULE 3: Overtime Risk (20 pts)
            const otBuffer = dayAvail.nonOvertimeHours || 0;
            if (otBuffer >= shift.hours) {
                score += 20;
                reasons.push(`Workload Capacity: Can work entire shift (${shift.hours}h) without hitting daily overtime (${otBuffer}h buffer) (+20 pts).`);
            } else if (otBuffer > 0) {
                reasons.push(`Overtime Risk: Shift (${shift.hours}h) exceeds remaining regular hours (${otBuffer}h). Partial overtime required.`);
            } else {
                reasons.push("Overtime Risk: Caregiver is already at or near overtime capacity for today.");
            }

            recommendations.push({
                caregiverId: doc.id,
                caregiverName: caregiver.Name,
                score,
                reasons,
                isPriorCaregiver: isPrior,
                overtimeHoursAvailable: parseFloat(otBuffer.toFixed(2)),
                dailyAvailability: dayAvail.schedule || "Not specified",
            });
        }

        // 5. Sort by score descending
        return {
            recommendations: recommendations.sort((a, b) => b.score - a.score).slice(0, 10)
        };

    } catch (error: any) {
        console.error("[Rules Engine Error] getReplacementRecommendations:", error);
        return { error: `Failed to generate recommendations: ${error.message}` };
    }
}
