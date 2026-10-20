
'use server';

import { serverDb } from '@/firebase/server-init';
import type { ClientNotesSummary } from './types';

export async function sendWeeklySummaryEmail(summary: ClientNotesSummary) {
    const ownerEmail = "Lpinto@firstlighthomecare.com";
    
    // 1. Calculate Aggregates for Section A
    const clientCount = summary.clients.length;
    let totalVisits = 0;
    let ownerFollowUpCount = 0;
    let totalConcerns = 0;

    summary.clients.forEach(c => {
        totalVisits += c.response.summary.totalVisitsDocumented || 0;
        const needsFollowUp = c.response.agencyOwnerReview.recommendedFollowUp.length > 0 || 
                            c.response.careConcernsAndFollowUp.some(con => con.requiresOwnerReview);
        if (needsFollowUp) ownerFollowUpCount++;
        totalConcerns += c.response.careConcernsAndFollowUp.length;
    });

    const overallStatus = ownerFollowUpCount > 0 ? "Action Required" : "Stable";

    // 2. Consolidate Section B (Priority Items)
    const priorityItems: string[] = [];
    summary.clients.forEach(c => {
        c.response.careConcernsAndFollowUp.forEach(item => {
            if (item.requiresOwnerReview || item.requiresClinicalReview || item.severity.toLowerCase() === 'high' || item.severity.toLowerCase() === 'medium') {
                const badge = item.requiresOwnerReview ? "OWNER REVIEW" : (item.requiresClinicalReview ? "CLINICAL REVIEW" : "HIGH SEVERITY");
                priorityItems.push(`
                    <div style="margin-bottom: 15px; padding: 12px; border-left: 4px solid #ef4444; background: #fef2f2; border-radius: 4px;">
                        <strong style="color: #b91c1c; font-size: 14px;">[${badge}] ${c.clientName} (ID: ${c.clientId})</strong><br/>
                        <div style="margin-top: 5px; font-size: 13px;">
                            <strong>Concern:</strong> ${item.concern} (${item.sourceDate})<br/>
                            <strong>Description:</strong> ${item.description}<br/>
                            <div style="margin-top: 5px; padding: 8px; background: white; border: 1px solid #fee2e2; border-radius: 4px;">
                                <strong style="color: #E07A5F;">Action:</strong> ${item.recommendedAction}
                            </div>
                        </div>
                    </div>
                `);
            }
        });
    });

    // 3. Section C (Client Summaries)
    const clientSummariesHtml = summary.clients.map(c => `
        <div style="margin-bottom: 30px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background: #f9fafb; padding: 12px 15px; border-bottom: 1px solid #e5e7eb;">
                <h3 style="margin: 0; color: #111827; font-size: 16px;">${c.clientName} (ID: ${c.clientId})</h3>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    Period: ${c.response.reportPeriod.startDate} to ${c.response.reportPeriod.endDate} | Visits: ${c.response.summary.totalVisitsDocumented}
                </div>
            </div>
            <div style="padding: 15px; font-size: 13px;">
                <p><strong>Overview:</strong> ${c.response.summary.overview}</p>
                
                <div style="margin-top: 10px;">
                    <strong>Care Activity Highlights:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        ${c.response.agencyOwnerReview.completedCareHighlights.map(h => `<li>${h}</li>`).join('')}
                    </ul>
                </div>

                ${c.response.healthAndSafetyObservations.medicalConcernsReported.length > 0 ? `
                    <div style="margin-top: 10px; color: #b91c1c;">
                        <strong>Medical Concerns Noted:</strong>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            ${c.response.healthAndSafetyObservations.medicalConcernsReported.map(cc => `<li>${cc}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}

                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #eee;">
                    <strong>Status:</strong> <span style="font-weight: bold; color: ${c.response.agencyOwnerReview.overallStatus.toLowerCase().includes('stable') ? '#059669' : '#d97706'};">${c.response.agencyOwnerReview.overallStatus}</span>
                </div>
            </div>
        </div>
    `).join('');

    // 4. Section D (Owner Action Checklist)
    const checklistItems: string[] = [];
    summary.clients.forEach(c => {
        const clientActions = new Set([
            ...c.response.agencyOwnerReview.recommendedFollowUp,
            ...c.response.careConcernsAndFollowUp.map(item => item.recommendedAction)
        ]);
        clientActions.forEach(action => {
            if (action && action.toLowerCase() !== 'no specific follow-up action indicated by caregiver.') {
                checklistItems.push(`<li><strong>${c.clientName}:</strong> ${action}</li>`);
            }
        });
    });

    // 5. Section E (Documentation Gaps)
    const gapsItems: string[] = [];
    summary.clients.forEach(c => {
        const clientGaps = new Set([
            ...c.response.agencyOwnerReview.documentationGaps,
            ...c.response.healthAndSafetyObservations.notDocumented,
            ...c.response.documentationMetadata.dataLimitations
        ]);
        clientGaps.forEach(gap => {
            if (gap) {
                gapsItems.push(`<li><strong>${c.clientName}:</strong> ${gap}</li>`);
            }
        });
    });

    // Final Assembly
    const emailHtml = `
        <body style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: auto; padding: 20px;">
            <div style="border-bottom: 2px solid #E07A5F; padding-bottom: 10px; margin-bottom: 20px;">
                <h1 style="color: #111827; margin: 0; font-size: 24px;">Weekly Client Notes Summary</h1>
                <p style="color: #6b7280; margin: 5px 0;">Status: <strong>${overallStatus}</strong></p>
            </div>

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee; padding-bottom: 5px; font-size: 18px;">Section A: Executive Summary</h2>
            <p><strong>Reporting Period:</strong> ${summary.clients[0]?.response.reportPeriod.startDate} to ${summary.clients[0]?.response.reportPeriod.endDate}</p>
            <ul style="padding-left: 20px;">
                <li>Clients Reviewed: ${clientCount}</li>
                <li>Total Documented Visits: ${totalVisits}</li>
                <li>Clients Requiring Follow-Up: ${ownerFollowUpCount}</li>
                <li>Total Care Concerns: ${totalConcerns}</li>
            </ul>

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px; font-size: 18px;">Section B: Priority Items (Owner/Clinical Review)</h2>
            ${priorityItems.length > 0 ? priorityItems.join('') : '<p style="color: #6b7280; font-style: italic;">No high-priority concerns requiring immediate review.</p>'}

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px; font-size: 18px;">Section C: Weekly Client Detail</h2>
            ${clientSummariesHtml}

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px; font-size: 18px;">Section D: Follow-Up Checklist</h2>
            ${checklistItems.length > 0 ? `<ul style="padding-left: 20px; font-size: 13px;">${checklistItems.join('')}</ul>` : '<p style="color: #6b7280; font-style: italic;">No specific follow-up actions identified.</p>'}

            <h2 style="color: #E07A5F; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 30px; font-size: 18px;">Section E: Documentation Gaps</h2>
            ${gapsItems.length > 0 ? `<ul style="padding-left: 20px; font-size: 13px; color: #6b7280;">${gapsItems.join('')}</ul>` : '<p style="color: #6b7280; font-style: italic;">No significant documentation gaps identified this week.</p>'}
            
            <p style="margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
                This report is generated from documented caregiver notes.<br/>
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
