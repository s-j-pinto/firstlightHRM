'use server';

import { serverDb } from '@/firebase/server-init';
import { format, parseISO, isValid, parse } from 'date-fns';
import type { TeleTrackWeeklyUnassignedShiftsInventory, TeleTrackUnassignedWeeklyCaregiversList, ActiveCaregiver } from './types';
import { getDistance } from './services/google-maps';

interface GetRecommendationsPayload {
    shiftIndex: number;
    weekStart: string;
}

/**
 * Robust time parser for TeleTrack formats like "9:00:00 am" or "10:00 am".
 */
function timeToMinutes(timeStr: string): number {
    if (!timeStr) return -1;
    try {
        const cleaned = timeStr.trim().toUpperCase();
        const hasSeconds = (cleaned.match(/:/g) || []).length === 2;
        const formatStr = hasSeconds ? 'h:mm:ss a' : 'h:mm a';
        
        let date = parse(cleaned, formatStr, new Date());
        
        if (!isValid(date)) {
            // Fallback for missing spaces before AM/PM
            const normalized = cleaned.replace(/([AP]M)$/, ' $1');
            date = parse(normalized, formatStr, new Date());
        }

        return isValid(date) ? date.getHours() * 60 + date.getMinutes() : -1;
    } catch (e) {
        return -1;
    }
}

/**
 * Rules Engine for unassigned shift recommendations.
 * Bypasses Firestore indexes by fetching relevant docs and sorting in-memory.
 */
export async function getUnassignedRecommendations(payload: GetRecommendationsPayload) {
    const { shiftIndex, weekStart } = payload;
    const firestore = serverDb;

    try {
        // 1. Get shift details (Memory-safe fetch to avoid index errors)
        const inventoryQuery = await firestore.collection('teletrack_weekly_unassigned_shifts_inventory')
            .where('weekStart', '==', weekStart)
            .get();
        
        if (inventoryQuery.empty) {
            return { error: "Unassigned shift inventory not found for this week." };
        }
        
        const inventoryDocs = inventoryQuery.docs;
        inventoryDocs.sort((a, b) => b.data().syncedAt.toMillis() - a.data().syncedAt.toMillis());
        const inventory = inventoryDocs[0].data() as TeleTrackWeeklyUnassignedShiftsInventory;
        const shift = inventory.shifts[shiftIndex];
        
        if (!shift) return { error: "Specific shift details not found." };

        const clientName = shift.client.name;
        const dayName = format(parseISO(shift.date), 'eeee').toLowerCase();
        const shiftStartMins = timeToMinutes(shift.arrivalTime);
        const shiftEndMins = timeToMinutes(shift.departureTime);

        // 2. Get client preferences
        const listQuery = await firestore.collection('teletrack_unassigned_weekly_caregivers_list').get();
        const listDocs = listQuery.docs;
        listDocs.sort((a, b) => b.data().syncedAt.toMillis() - a.data().syncedAt.toMillis());
        
        let priorCaregiverNames: string[] = [];
        let deniedCaregiverNames: string[] = [];
        
        if (listDocs.length > 0) {
            const list = listDocs[0].data() as TeleTrackUnassignedWeeklyCaregiversList;
            const clientEntry = list.clients.find(c => c.clientName === clientName);
            if (clientEntry) {
                priorCaregiverNames = clientEntry.caregivers.map(cg => cg.caregiverName.trim());
                deniedCaregiverNames = clientEntry.deniedCaregivers
                    .map(cg => cg.caregiverName.trim())
                    .filter(name => name !== "There are no denied caregivers.");
            }
        }

        // 3. Fetch client address for distance
        const clientQuery = await firestore.collection('Clients').where('Client Name', '==', clientName).limit(1).get();
        const clientAddress = clientQuery.empty ? null : `${clientQuery.docs[0].data().Address}, ${clientQuery.docs[0].data().City}`;

        // 4. Fetch and Score All Active Caregivers
        const activeCaregiversSnap = await firestore.collection('caregivers_active').where('status', '==', 'Active').get();
        const recommendations = [];

        for (const doc of activeCaregiversSnap.docs) {
            const caregiver = doc.data() as ActiveCaregiver;
            
            // Availability Filter
            const availDoc = await doc.ref.collection('availability').doc('current_week').get();
            if (!availDoc.exists) continue;

            const dayAvail = availDoc.data()?.[dayName];
            if (!dayAvail || !dayAvail.hasAvailabilityBlock) continue;

            let score = 0;
            const reasons: string[] = [];

            // RULE: Denied Filter (Hard Reject)
            const isDenied = deniedCaregiverNames.includes(caregiver.Name);
            if (isDenied) {
                recommendations.push({
                    caregiverId: doc.id,
                    caregiverName: caregiver.Name,
                    score: 0,
                    reasons: ["CAREGIVER IS EXPLICITLY DENIED FOR THIS CLIENT"],
                    isPriorCaregiver: false,
                    isDenied: true,
                    overtimeHoursAvailable: 0,
                    dailyAvailability: "N/A",
                });
                continue;
            }

            // RULE 1: Continuity (40 pts)
            const isPrior = priorCaregiverNames.includes(caregiver.Name);
            if (isPrior) {
                score += 40;
                reasons.push("Prior Relationship: Caregiver has serviced this client in the last 30 days (+40 pts).");
            }

            // RULE 2: Availability Match (30 pts)
            const availRegex = /(?:Available|Scheduled Availability)\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)\s*To\s*(\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M)/gi;
            let bestAvailScore = 0;
            let match;
            while ((match = availRegex.exec(dayAvail.schedule || "")) !== null) {
                const aStart = timeToMinutes(match[1]);
                const aEnd = timeToMinutes(match[2]);
                if (aStart !== -1 && aEnd !== -1) {
                    if (aStart <= shiftStartMins && aEnd >= shiftEndMins) bestAvailScore = 30;
                    else if (aStart < shiftEndMins && aEnd > shiftStartMins) bestAvailScore = Math.max(bestAvailScore, 10);
                }
            }
            score += bestAvailScore;
            if (bestAvailScore > 0) reasons.push(`${bestAvailScore === 30 ? "Perfect" : "Partial"} Schedule Match (+${bestAvailScore} pts).`);

            // RULE 3: Proximity (15 pts)
            let distanceText = "";
            if (clientAddress && caregiver.Address && caregiver.City) {
                const dist = await getDistance(clientAddress, `${caregiver.Address}, ${caregiver.City}`);
                if (dist) {
                    distanceText = dist.distanceText;
                    const miles = dist.distanceValue / 1609.34;
                    const pPts = miles < 5 ? 15 : (miles < 15 ? 10 : 5);
                    score += pPts;
                    reasons.push(`Proximity: Caregiver is ${dist.distanceText} away (+${pPts} pts).`);
                }
            }

            // RULE 4: Workload (15 pts)
            const buffer = dayAvail.nonOvertimeHours || 0;
            if (buffer >= shift.hours) {
                score += 15;
                reasons.push(`Safe Workload: Sufficient regular hours available (+15 pts).`);
            } else if (buffer > 0) {
                reasons.push(`Overtime Risk: Shift will incur ~${(shift.hours - buffer).toFixed(1)}h of daily overtime.`);
            }

            recommendations.push({
                caregiverId: doc.id,
                caregiverName: caregiver.Name,
                score,
                reasons,
                isPriorCaregiver: isPrior,
                isDenied: false,
                overtimeHoursAvailable: parseFloat(buffer.toFixed(2)),
                dailyAvailability: dayAvail.schedule || "Not specified",
                distance: distanceText,
            });
        }

        // Sort by Prior Relationship first, then Denied status (at bottom), then Score
        const sortedRecommendations = recommendations.sort((a, b) => {
            // 1. Prior relationship (True first)
            if (a.isPriorCaregiver !== b.isPriorCaregiver) {
                return a.isPriorCaregiver ? -1 : 1;
            }
            // 2. Denied (False first - put denied at bottom of their priority level)
            if (a.isDenied !== b.isDenied) {
                return a.isDenied ? 1 : -1;
            }
            // 3. Score (Descending)
            return b.score - a.score;
        });

        return { 
            recommendations: sortedRecommendations.slice(0, 10) 
        };

    } catch (error: any) {
        console.error("[getUnassignedRecommendations] Error:", error);
        return { error: `Engine Error: ${error.message}` };
    }
}

export async function sendUnassignedRecommendationsEmail(payload: {
    clientName: string;
    shiftDate: string;
    shiftTime: string;
    shiftHours: number;
    recommendations: any[];
}) {
    const firestore = serverDb;
    const adminEmail = "admin-rc@firstlighthomecare.com";
    const ownerEmail = "lpinto@firstlighthomecare.com";

    const recsHtml = payload.recommendations.map((rec, i) => `
        <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-left: 4px solid ${rec.isDenied ? '#ef4444' : '#E07A5F'};">
            <h4 style="margin: 0; color: #333;">${i+1}. ${rec.caregiverName} ${rec.isDenied ? '<span style="color:red;">(DENIED)</span>' : ''} ${rec.isPriorCaregiver ? '<span style="color:green;">(PRIOR)</span>' : ''}</h4>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Match Score:</strong> ${rec.score}/100</p>
            ${rec.distance ? `<p style="margin: 5px 0; font-size: 13px;"><strong>Distance:</strong> ${rec.distance}</p>` : ''}
            <ul style="margin: 5px 0; font-size: 13px; color: #666;">
                ${rec.reasons.map((r:string) => `<li>${r}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    const email = {
        to: [adminEmail, ownerEmail],
        message: {
            subject: `CareConnect Unassigned Shift Recommendations for ${payload.clientName}, ${payload.shiftDate}, ${payload.shiftTime} and ${payload.shiftHours} hrs`,
            html: `
                <body style="font-family: sans-serif; line-height: 1.6;">
                    <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #333;">Unassigned Shift Alert</h2>
                        <p>Our matching rules engine has identified the best caregivers for the following unassigned shift:</p>
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Client:</strong> ${payload.clientName}</p>
                            <p><strong>Date:</strong> ${payload.shiftDate}</p>
                            <p><strong>Time:</strong> ${payload.shiftTime}</p>
                            <p><strong>Duration:</strong> ${payload.shiftHours} hours</p>
                        </div>
                        <h3>Top Ranked Matches</h3>
                        ${recsHtml}
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/staffing-admin/manage-unassigned-shifts" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                View on Dashboard
                            </a>
                        </div>
                    </div>
                </body>
            `,
        }
    };

    try {
        await firestore.collection('mail').add(email);
        return { success: true, message: "Recommendations email sent to management." };
    } catch (e: any) {
        return { error: `Failed to send email: ${e.message}` };
    }
}
