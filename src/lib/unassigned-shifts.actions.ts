
'use server';

import { serverDb } from '@/firebase/server-init';
import { format, parseISO, isValid, parse } from 'date-fns';
import type { TeleTrackWeeklyUnassignedShiftsInventory, TeleTrackUnassignedWeeklyCaregiversList, ActiveCaregiver, ReplacementRecommendation } from './types';
import { recommendUnassignedCaregivers } from '@/ai/flows/recommend-unassigned-caregiver-flow';
import { getDistance } from './services/google-maps';

interface GetRecommendationsPayload {
    shiftIndex: number;
    weekStart: string;
}

function timeToMinutes(timeStr: string): number {
    try {
        const cleaned = timeStr.trim().toUpperCase();
        const date = parse(cleaned, 'h:mm:ss a', new Date());
        return date.getHours() * 60 + date.getMinutes();
    } catch (e) {
        return -1;
    }
}

export async function getUnassignedRecommendations(payload: GetRecommendationsPayload) {
    const { shiftIndex, weekStart } = payload;
    const firestore = serverDb;

    try {
        // 1. Get shift details
        const inventorySnap = await firestore.collection('teletrack_weekly_unassigned_shifts_inventory')
            .where('weekStart', '==', weekStart)
            .orderBy('syncedAt', 'desc')
            .limit(1)
            .get();
        
        if (inventorySnap.empty) return { error: "Unassigned shift inventory not found." };
        const inventory = inventorySnap.docs[0].data() as TeleTrackWeeklyUnassignedShiftsInventory;
        const shift = inventory.shifts[shiftIndex];
        if (!shift) return { error: "Shift details not found." };

        const clientName = shift.client.name;
        const dayName = format(parseISO(shift.date), 'eeee').toLowerCase();
        const shiftStartMins = timeToMinutes(shift.arrivalTime);
        const shiftEndMins = timeToMinutes(shift.departureTime);

        // 2. Get client preferences (prior/denied)
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

        // 3. Fetch client address
        const clientQuery = await firestore.collection('Clients').where('Client Name', '==', clientName).limit(1).get();
        const clientAddress = clientQuery.empty ? null : `${clientQuery.docs[0].data().Address}, ${clientQuery.docs[0].data().City}`;

        // 4. Fetch all active caregivers and process
        const activeCaregiversSnap = await firestore.collection('caregivers_active')
            .where('status', '==', 'Active')
            .get();
        
        const candidatePool = [];

        for (const doc of activeCaregiversSnap.docs) {
            const caregiver = doc.data() as ActiveCaregiver;
            
            // Check availability
            const availDoc = await doc.ref.collection('availability').doc('current_week').get();
            if (!availDoc.exists) continue;

            const availability = availDoc.data();
            const dayAvail = availability?.[dayName];
            if (!dayAvail || !dayAvail.hasAvailabilityBlock) continue;

            // Check distance
            let distanceText = "";
            if (clientAddress && caregiver.Address && caregiver.City) {
                const dist = await getDistance(clientAddress, `${caregiver.Address}, ${caregiver.City}`);
                distanceText = dist?.distanceText || "";
            }

            candidatePool.push({
                id: doc.id,
                name: caregiver.Name,
                isPriorCaregiver: priorCaregiverNames.includes(caregiver.Name),
                isDenied: deniedCaregiverNames.includes(caregiver.Name),
                availabilityText: dayAvail.schedule || "",
                nonOvertimeHours: dayAvail.nonOvertimeHours || 0,
                distanceText,
            });
        }

        // 5. Call AI Flow
        const recommendations = await recommendUnassignedCaregivers({
            clientName,
            shiftDate: shift.date,
            shiftTime: `${shift.arrivalTime} - ${shift.departureTime}`,
            shiftHours: shift.hours,
            candidates: candidatePool,
        });

        return { recommendations: recommendations.recommendations };

    } catch (error: any) {
        console.error("[Unassigned Action Error]:", error);
        return { error: `Recommendation failed: ${error.message}` };
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
                        <p>AI-powered recommendations are ready for the following unassigned shift:</p>
                        
                        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Client:</strong> ${payload.clientName}</p>
                            <p><strong>Date:</strong> ${payload.shiftDate}</p>
                            <p><strong>Time:</strong> ${payload.shiftTime}</p>
                            <p><strong>Duration:</strong> ${payload.shiftHours} hours</p>
                        </div>

                        <h3>Top Recommendations</h3>
                        ${recsHtml}

                        <div style="text-align: center; margin-top: 30px;">
                            <a href="https://care-connect-360--firstlighthomecare-hrm.us-central1.hosted.app/staffing-admin/manage-unassigned-shifts" style="background-color: #E07A5F; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
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
        return { success: true, message: "Recommendations email sent to administration." };
    } catch (e: any) {
        return { error: `Failed to send email: ${e.message}` };
    }
}
