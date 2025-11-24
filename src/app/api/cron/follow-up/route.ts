
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { InitialContact, CampaignTemplate } from '@/lib/types';
import { subDays, isBefore, startOfDay } from 'date-fns';

// Helper to safely convert Firestore Timestamps or serialized strings to Date objects
const safeToDate = (value: any): Date | null => {
    if (!value) return null;
    // Check for Firestore Timestamp which has a toDate method
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    // Handle ISO date strings or numbers (milliseconds)
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }
    console.warn(`[CRON] Could not parse date value:`, value);
    return null;
};


/**
 * API route to handle a cron job for sending scheduled email follow-ups.
 */
export async function GET(request: NextRequest) {
    // 1. Secure the endpoint
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error('[CRON] Unauthorized access attempt.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting daily follow-up job.');
    const firestore = serverDb;
    const now = new Date();
    const results = {
        contactsChecked: 0,
        emailsSent: 0,
        errors: 0,
    };

    try {
        // Find all active campaign templates (excluding immediate-send ones)
        const templatesSnap = await firestore.collection('campaign_templates')
            .where('intervalDays', '>', 0)
            .get();

        if (templatesSnap.empty) {
            console.log('[CRON] No active follow-up templates found. Job finished.');
            return NextResponse.json({ success: true, message: "No templates to process." });
        }
        
        const templates = templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignTemplate & { id: string }));
        console.log(`[CRON] Found ${templates.length} active campaign templates.`);

        // Get a list of all contact IDs that have been converted to a full signup
        const signupsSnap = await firestore.collection('client_signups').select('initialContactId').get();
        const convertedContactIds = new Set(signupsSnap.docs.map(doc => doc.data().initialContactId).filter(Boolean));
        console.log(`[CRON] Found ${convertedContactIds.size} converted client signups to exclude.`);
        
        // Fetch all contacts eligible for campaigns in one go to avoid complex queries.
        const contactsQuery = await firestore.collection('initial_contacts')
            .where('sendFollowUpCampaigns', '==', true)
            .get();

        const eligibleContacts = contactsQuery.docs.map(doc => ({ id: doc.id, ...doc.data() } as InitialContact));
        console.log(`[CRON] Found ${eligibleContacts.length} total contacts eligible for campaigns to check.`);

        for (const template of templates) {
            const interval = template.intervalDays;
            console.log(`[CRON] Processing template "${template.name}" with interval: ${interval} days.`);
            
            // The date on or before which a contact is eligible for this template.
            const targetDate = startOfDay(subDays(now, interval));

            for (const contact of eligibleContacts) {
                results.contactsChecked++;
                
                const createdAt = safeToDate(contact.createdAt);

                if (!createdAt) {
                    console.warn(`[CRON] Skipping contact ${contact.id}: Invalid or missing createdAt date.`);
                    continue;
                }

                // Skip if the contact is too new for this template
                if (isBefore(targetDate, createdAt)) {
                    continue;
                }
                
                // Skip if the contact has already started the full signup process
                if (convertedContactIds.has(contact.id)) {
                    continue;
                }

                // Check if this specific template has already been sent
                const hasBeenSent = contact.followUpHistory?.some((entry: any) => entry.templateId === template.id);
                if (hasBeenSent) {
                    continue;
                }
                
                const assessmentLink = `${process.env.NEXT_PUBLIC_BASE_URL}/lead-intake?id=${contact.id}`;
                let emailHtml = template.body.replace(/{{clientName}}/g, contact.clientName);
                emailHtml = emailHtml.replace(/{{assessmentLink}}/g, assessmentLink);

                console.log(`[CRON] QUEUING email for contact ${contact.id} using template "${template.name}".`);

                await firestore.collection('mail').add({
                    to: [contact.clientEmail],
                    message: {
                        subject: template.subject,
                        html: emailHtml,
                    },
                });

                await firestore.collection('initial_contacts').doc(contact.id).update({
                    followUpHistory: FieldValue.arrayUnion({ templateId: template.id, sentAt: Timestamp.now() })
                });

                results.emailsSent++;
            }
        }

        console.log('[CRON] Daily follow-up job completed successfully.', results);
        return NextResponse.json({ success: true, ...results });

    } catch (error: any) {
        console.error(`[CRON] Cron job failed:`, error);
        results.errors++;
        return NextResponse.json({ success: false, error: error.message, ...results }, { status: 500 });
    }
}
