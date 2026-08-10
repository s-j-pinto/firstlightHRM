
'use server';

import { serverDb } from '@/firebase/server-init';
import { format, parseISO, isValid, parse } from 'date-fns';
import type { TeleTrackWeeklyUnassignedShiftsInventory, TeleTrackUnassignedWeeklyCaregiversList, ActiveCaregiver } from './types';
import { getDistance } from './services/google-maps';

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
            const normalized = cleaned.replace(/([AP]M)$/, ' $1');
            date = parse(normalized, formatStr, new Date());
        }

        return isValid(date) ? date.getHours() * 60 + date.getMinutes() : -1;
    } catch (e) {
        return -1;
    }
}

/**
 * Core matching logic that ranks caregivers for a specific shift.
 * This is exported so it can be called by both the cron job (for pre-calculation)
 * and potentially the UI/Server Actions for real-time refreshes.
 */
export async function calculateUnassignedRecommendations(params: {
    shift: any;
    priorCaregiverNames: string[];
    deniedCaregiverNames: string[];
    activeCaregivers: any[];
    clientAddress: string | null;
}) {
    const { shift, priorCaregiverNames, deniedCaregiverNames, activeCaregivers, clientAddress } = params;
    
    const dayName = format(parseISO(shift.date), 'eeee').toLowerCase();
    const shiftStartMins = timeToMinutes(shift.arrivalTime);
    const shiftEndMins = timeToMinutes(shift.departureTime);

    const recommendations = [];

    for (const caregiverDoc of activeCaregivers) {
        const caregiver = caregiverDoc.data;
        const caregiverNameNormalized = caregiver.Name.trim().toLowerCase();
        
        const dayAvail = caregiver.availability?.[dayName];
        if (!dayAvail || !dayAvail.hasAvailabilityBlock) continue;

        let score = 0;
        const reasons: string[] = [];

        // RULE: Denied Filter (Hard Reject)
        const isDenied = deniedCaregiverNames.includes(caregiverNameNormalized);
        if (isDenied) {
            recommendations.push({
                caregiverId: caregiverDoc.id,
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
        const isPrior = priorCaregiverNames.includes(caregiverNameNormalized);
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
            reasons.push(`Safe Workload: Sufficient regular hours available today (+15 pts).`);
        } else if (buffer > 0) {
            reasons.push(`Overtime Risk: Shift (${shift.hours}h) will incur ~${(shift.hours - buffer).toFixed(1)}h of daily overtime.`);
        }

        recommendations.push({
            caregiverId: caregiverDoc.id,
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

    const sortedRecommendations = recommendations.sort((a, b) => {
        if (a.isDenied !== b.isDenied) return a.isDenied ? 1 : -1;
        if (a.isPriorCaregiver !== b.isPriorCaregiver) return a.isPriorCaregiver ? -1 : 1;
        return b.score - a.score;
    });

    return sortedRecommendations.slice(0, 10);
}

export async function getUnassignedRecommendations(payload: GetRecommendationsPayload) {
    // This server action is now a fallback/proxy to retrieve pre-calculated data 
    // or run a manual refresh if needed. For now, we'll keep it as a proxy for the UI.
    const { shiftIndex, weekStart } = payload;
    const firestore = serverDb;

    try {
        const inventoryQuery = await firestore.collection('teletrack_weekly_unassigned_shifts_inventory')
            .where('weekStart', '==', weekStart)
            .get();
        
        if (inventoryQuery.empty) return { error: "Inventory not found." };
        
        const inventoryDocs = inventoryQuery.docs;
        inventoryDocs.sort((a, b) => b.data().syncedAt.toMillis() - a.data().syncedAt.toMillis());
        const inventory = inventoryDocs[0].data() as TeleTrackWeeklyUnassignedShiftsInventory;
        const shift = inventory.shifts[shiftIndex];
        
        if (!shift) return { error: "Shift not found." };

        // Return the pre-calculated recommendations stored in the shift
        return { recommendations: (shift as any).recommendations || [] };

    } catch (error: any) {
        return { error: `Retrieval Error: ${error.message}` };
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
        <div style="margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-left: 4px solid ${rec.isDenied ? '#ef4444' : '#E07A5F'}; opacity: ${rec.isDenied ? '0.7' : '1'};">
            <h4 style="margin: 0; color: #333;">${i+1}. ${rec.caregiverName} ${rec.isDenied ? '<span style="color:#ef4444; font-weight:bold;">(DENIED)</span>' : ''} ${rec.isPriorCaregiver ? '<span style="color:#22c55e; font-weight:bold;">(PRIOR)</span>' : ''}</h4>
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
            subject: `CareConnect Unassigned Shift Recommendations for ${payload.clientName}, ${payload.shiftDate}, ${payload.shiftTime} (${payload.shiftHours} hrs)`,
            html: `
                <body style="font-family: sans-serif; line-height: 1.6;">
                    <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #333;">Unassigned Shift Match Results</h2>
                        <p>The CareConnect rules engine has identified the following top matches for an open shift:</p>
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Client:</strong> ${payload.clientName}</p>
                            <p><strong>Date:</strong> ${payload.shiftDate}</p>
                            <p><strong>Time:</strong> ${payload.shiftTime}</p>
                            <p><strong>Duration:</strong> ${payload.shiftHours} hours</p>
                        </div>
                        <h3>Ranked Caregivers</h3>
                        ${recsHtml}
                        <div style="text-align: center; margin-top: 30px;">
                            <a href="${process.env.NEXT_PUBLIC_BASE_URL}/staffing-admin/manage-unassigned-shifts" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                View Details on Dashboard
                            </a>
                        </div>
                    </div>
                </body>
            `,
        }
    };

    try {
        await firestore.collection('mail').add(email);
        return { success: true, message: "Recommendations email sent successfully." };
    } catch (e: any) {
        return { error: `Failed to send email: ${e.message}` };
    }
}
