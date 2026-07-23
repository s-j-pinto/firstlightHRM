
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
 * Parses time strings like "7:00:00 AM" or "7:00 AM" into comparable minute-of-day integers.
 */
function timeToMinutes(timeStr: string): number {
    if (!timeStr) return -1;
    try {
        const cleaned = timeStr.trim().toUpperCase();
        // Support both "h:mm:ss a" and "h:mm a" formats
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

export async function getUnassignedRecommendations(payload: GetRecommendationsPayload) {
    const { shiftIndex, weekStart } = payload;
    const firestore = serverDb;

    try {
        console.log(`[getUnassignedRecommendations] Fetching inventory for week: ${weekStart}, index: ${shiftIndex}`);
        
        // 1. Get shift details
        const inventorySnap = await firestore.collection('teletrack_weekly_unassigned_shifts_inventory')
            .where('weekStart', '==', weekStart)
            .orderBy('syncedAt', 'desc')
            .limit(1)
            .get();
        
        if (inventorySnap.empty) {
            console.warn(`[getUnassignedRecommendations] No inventory found for ${weekStart}`);
            return { error: "Unassigned shift inventory not found for this week. Please ensure the weekly sync has run successfully." };
        }
        
        const inventory = inventorySnap.docs[0].data() as TeleTrackWeeklyUnassignedShiftsInventory;
        const shift = inventory.shifts[shiftIndex];
        
        if (!shift) {
            console.error(`[getUnassignedRecommendations] Shift index ${shiftIndex} not found in inventory.`);
            return { error: "Specific shift details not found in inventory." };
        }

        const clientName = shift.client.name;
        const dayName = format(parseISO(shift.date), 'eeee').toLowerCase();
        const shiftStartMins = timeToMinutes(shift.arrivalTime);
        const shiftEndMins = timeToMinutes(shift.departureTime);

        // 2. Get client preferences (prior/denied) from the sync list
        const caregiversListSnap = await firestore.collection('teletrack_unassigned_weekly_caregivers_list')
            .orderBy('syncedAt', 'desc')
            .limit(1)
            .get();
        
        let priorCaregiverNames: string[] = [];
        let deniedCaregiverNames: string[] = [];
        if (!caregiversListSnap.empty) {
            const list = caregiversListSnap.docs[0].data() as TeleTrackUnassignedWeeklyCaregiversList;
            const clientEntry = list.clients.find(c => c.clientName === clientName);
            if (clientEntry) {
                priorCaregiverNames = clientEntry.caregivers.map(cg => cg.caregiverName);
                deniedCaregiverNames = clientEntry.deniedCaregivers.map(cg => cg.caregiverName);
            }
        }

        // 3. Fetch client address to calculate distance
        const clientQuery = await firestore.collection('Clients').where('Client Name', '==', clientName).limit(1).get();
        const clientAddress = clientQuery.empty ? null : `${clientQuery.docs[0].data().Address}, ${clientQuery.docs[0].data().City}`;

        // 4. Fetch all active caregivers and score them
        const activeCaregiversSnap = await firestore.collection('caregivers_active')
            .where('status', '==', 'Active')
            .get();
        
        const recommendations = [];

        for (const doc of activeCaregiversSnap.docs) {
            const caregiver = doc.data() as ActiveCaregiver;
            
            // Check availability for the day of the shift
            const availDoc = await doc.ref.collection('availability').doc('current_week').get();
            if (!availDoc.exists) continue;

            const availability = availDoc.data();
            const dayAvail = availability?.[dayName];

            // Filter: Only suggest if they have availability marked
            if (!dayAvail || !dayAvail.hasAvailabilityBlock) continue;

            let score = 0;
            const reasons: string[] = [];

            // RULE: Denied Filter
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
                    if (aStart <= shiftStartMins && aEnd >= shiftEndMins) {
                        bestAvailScore = 30; // Perfect match
                    } else if (aStart < shiftEndMins && aEnd > shiftStartMins) {
                        bestAvailScore = Math.max(bestAvailScore, 10); // Partial match
                    }
                }
            }
            score += bestAvailScore;
            if (bestAvailScore > 0) {
                reasons.push(`${bestAvailScore === 30 ? "Perfect" : "Partial"} Schedule Match: Availability window aligns with shift (+${bestAvailScore} pts).`);
            }

            // RULE 3: Proximity (15 pts)
            let distanceText = "";
            if (clientAddress && caregiver.Address && caregiver.City) {
                const dist = await getDistance(clientAddress, `${caregiver.Address}, ${caregiver.City}`);
                if (dist) {
                    distanceText = dist.distanceText;
                    const miles = dist.distanceValue / 1609.34;
                    if (miles < 5) {
                        score += 15;
                        reasons.push(`Close Proximity: Caregiver is within 5 miles (${dist.distanceText}) (+15 pts).`);
                    } else if (miles < 15) {
                        score += 10;
                        reasons.push(`Commutable: Caregiver is within 15 miles (${dist.distanceText}) (+10 pts).`);
                    } else {
                        score += 5;
                        reasons.push(`Long Distance: Caregiver is ${dist.distanceText} away (+5 pts).`);
                    }
                }
            }

            // RULE 4: Workload (15 pts)
            const buffer = dayAvail.nonOvertimeHours || 0;
            if (buffer >= shift.hours) {
                score += 15;
                reasons.push(`Safe Workload: Has sufficient regular hours (${buffer}h) for this ${shift.hours}h shift (+15 pts).`);
            } else if (buffer > 0) {
                reasons.push(`Overtime Risk: Shift will result in ${ (shift.hours - buffer).toFixed(1) }h of daily overtime.`);
            } else {
                reasons.push("Overtime Alert: Caregiver is already at or above daily overtime capacity.");
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

        return { 
            recommendations: recommendations.sort((a, b) => b.score - a.score).slice(0, 15) 
        };

    } catch (error: any) {
        console.error("[getUnassignedRecommendations] Critical Error:", error);
        return { error: `Failed to generate recommendations: ${error.message}` };
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
            <h4 style="margin: 0; color: #333;">${i+1}. ${rec.caregiverName} ${rec.isDenied ? '<span style="color:red;">(DENIED)</span>' : ''}</h4>
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
                            <a href="https://care-connect-360--firstlighthomecare-hrm.us-central1.hosted.app/staffing-admin/manage-unassigned-shifts" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                Manage Shift on Dashboard
                            </a>
                        </div>
                    </div>
                </body>
            `,
        }
    };

    try {
        await firestore.collection('mail').add(email);
        return { success: true, message: "Recommendations email sent to administration." };
    } catch (e: any) {
        return { error: `Failed to send email: ${e.message}` };
    }
}
