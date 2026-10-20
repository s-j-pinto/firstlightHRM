
'use server';

import { serverDb } from '@/firebase/server-init';
import type { ClientNotesSummary } from './types';
import { format } from 'date-fns';

export async function sendWeeklySummaryEmail(summary: ClientNotesSummary) {
    const ownerEmail = "Lpinto@firstlighthomecare.com";
    
    // 1. Calculate Aggregates for Section A
    const clientCount = summary.clients.length;
    let totalVisits = 0;
    let ownerFollowUpCount = 0;
    let concernCount = 0;
    const operationalIssues: string[] = [];

    summary.clients.forEach(c => {
        totalVisits += c.response.documentationMetadata.totalVisits || 0;
        if (c.response.agencyOwnerReview.recommendedFollowUp.length > 0) ownerFollowUpCount++;
        if (c.response.careConcernsAndFollowUp.length > 0) concernCount++;
        operationalIssues.push(...(c.response.agencyOwnerReview.operationalRisks || []));
    });

    const uniqueOpIssues = Array.from(new Set(operationalIssues));
    const overallStatus = ownerFollowUpCount > 0 ? "Owner Review Required" : (concernCount > 0 ? "Concerns Identified" : "Stable");

    // 2. Consolidate Section B (Priority Items)
    const priorityItems: string[] = [];
    summary.clients.forEach(c => {
        c.response.careConcernsAndFollowUp.forEach(item => {
            const priorityLabel = item.requiresOwnerReview ? "OWNER REVIEW" : (item.requiresClinicalReview ? "CLINICAL REVIEW" : "HIGH SEVERITY");
            if (item.requiresOwnerReview || item.requiresClinicalReview || item.severity === 'High') {
                priorityItems.push(`
                    <div style="margin-bottom: 10px; padding: 10px; border-left: 4px solid #ef4444; background: #fef2f2;">
                        <strong style="color: #b91c1c;">[${priorityLabel}] ${c.clientName} (${c.clientId})</strong><br/>
                        <strong>Concern (${item.date}):</strong> ${item.concern}<br/>
                        <strong>Description:</strong> ${item.description}<br/>
                        <strong>Recommended Action:</strong> ${item.recommendedAction}
                    </div>
                `);
            }
        });
    });

    // 3. Section C (Client Summaries)
    const clientSummariesHtml = summary.clients.map(c => `
        <div style="margin-bottom: 25px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background: #f9fafb; padding: 10px 15px; border-bottom: 1px solid #e5e7eb;">
                <h3 style="margin: 0; color: #111827;">${c.clientName} (ID: ${c.clientId})</h3>
                <span style="font-size: 12px; color: #6b7280;">Period: ${c.response.reportPeriod.startDate} to ${c.response.reportPeriod.endDate} | Visits: ${c.response.documentationMetadata.totalVisits}</span>
            </div>
            <div style="padding: 15px; font-size: 14px;">
                <p><strong>Weekly Summary:</strong> ${c.response.summary}</p>
                
                <div style="margin-top: 10px;">
                    <strong>Care Highlights:</strong>
                    <ul style="margin: 5px 0;">
                        ${c.response.careActivities.highlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                </div>

                ${c.response.healthAndSafetyObservations.positives.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <strong style="color: #059669;">Positive Observations:</strong>
                        <ul style="margin: 5px 0;">
                            ${c.response.healthAndSafetyObservations.positives.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${c.response.healthAndSafetyObservations.concerns.length > 0 ? `
                    <div style="margin-top: 10px;">
                        <strong style="color: #dc2626;">Health/Safety Concerns:</strong>
                        <ul style="margin: 5px 0;">
                            ${c.response.healthAndSafetyObservations.concerns.map(cc => `<li>${c}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #eee;">
                    <strong>Overall Status:</strong> <span style="font-weight: bold; color: ${c.response.agencyOwnerReview.overallStatus === 'Stable' ? '#059669' : '#d97706'};">${c.response.agencyOwnerReview.overallStatus}</span>
                </div>
            </div>
        </div>
    `).join('');

    // 4. Section D (Owner Action Checklist)
    const actionsMap = new Map<string, string[]>();
    summary.clients.forEach(c => {
        const clientActions = new Set([
            ...c.response.agencyOwnerReview.recommendedFollowUp,
            ...c.response.careConcernsAndFollowUp.map(item => item.recommendedAction)
        ]);
        if (clientActions.size > 0) {
            actionsMap.set(`${c.clientName} (${c.clientId})`, Array.from(clientActions));
        }
    });

    const checklistHtml = Array.from(actionsMap.entries()).map(([client, actions]) => `
        <div style="margin-bottom: 10px;">
            <strong>${client}:</strong>
            <ul style="margin: 5px 0;">
                ${actions.map(a => `<li>${a}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    // 5. Section E (Documentation Gaps)
    const gapsMap = new Map<string, string[]>();
    summary.clients.forEach(c => {
        const clientGaps = new Set([
            ...c.response.agencyOwnerReview.documentationGaps,
            ...c.response.healthAndSafetyObservations.notDocumented,
            ...c.response.documentationMetadata.dataLimitations
        ]);
        if (clientGaps.size > 0) {
            gapsMap.set(`${c.clientName} (${c.clientId})`, Array.from(clientGaps));
        }
    });

    const gapsHtml = Array.from(gapsMap.entries()).map(([client, gaps]) => `
        <div style="margin-bottom: 10px;">
            <strong>${client}:</strong>
            <ul style="margin: 5px 0;">
                ${gaps.map(g => `<li>${g}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    // Final Assembly
    const emailHtml = `
        <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: auto; padding: 20px;">
            <div style="border-bottom: 2px solid #E07A5F; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="color: #111827; margin: 0;">Weekly Care Report</h1>
                <p style="color: #6b7280; margin: 5px 0;">Status: <strong>${overallStatus}</strong></p>
            </div>

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee;">Section A: Weekly Executive Summary</h2>
            <p><strong>Reporting Period:</strong> ${summary.clients[0]?.response.reportPeriod.startDate} to ${summary.clients[0]?.response.reportPeriod.endDate}</p>
            <ul>
                <li>Clients Reviewed: ${clientCount}</li>
                <li>Total Documented Visits: ${totalVisits}</li>
                <li>Clients Requiring Owner Follow-Up: ${ownerFollowUpCount}</li>
                <li>Clients with Care Concerns: ${concernCount}</li>
            </ul>
            ${uniqueOpIssues.length > 0 ? `
                <p><strong>Key Operational Issues:</strong></p>
                <ul>${uniqueOpIssues.map(i => `<li>${i}</li>`).join('')}</ul>
            ` : ''}

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee;">Section B: Priority Items Requiring Follow-Up</h2>
            ${priorityItems.length > 0 ? priorityItems.join('') : '<p>No high-priority concerns requiring immediate review.</p>'}

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee;">Section C: Weekly Client Summaries</h2>
            ${clientSummariesHtml}

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee;">Section D: Owner Action Checklist</h2>
            ${checklistHtml || '<p>No specific follow-up actions identified.</p>'}

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee;">Section E: Documentation Gaps</h2>
            ${gapsHtml || '<p>No significant documentation gaps identified this week.</p>'}
            
            <p style="margin-top: 40px; font-size: 12px; color: #9ca3af; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
                This report is generated deterministically from documented caregiver notes.<br/>
                FirstLight Home Care of Rancho Cucamonga
            </p>
        </body>
    `;

    const reportStart = summary.clients[0]?.response.reportPeriod.startDate;
    const reportEnd = summary.clients[0]?.response.reportPeriod.endDate;

    try {
        await serverDb.collection("mail").add({
            to: [ownerEmail],
            message: {
                subject: `Weekly Care Report – ${reportStart} to ${reportEnd} – ${clientCount} Clients – ${overallStatus}`,
                html: emailHtml,
            },
        });
        return { success: true, message: `Weekly report email sent to ${ownerEmail}.` };
    } catch (error: any) {
        return { error: `Failed to send report email: ${error.message}` };
    }
}
