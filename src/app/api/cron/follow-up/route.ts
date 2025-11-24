
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { InitialContact, CampaignTemplate } from '@/lib/types';
import { subDays, startOfDay, isBefore } from 'date-fns';

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

        for (const template of templates) {
            const interval = template.intervalDays;
            console.log(`[CRON] Processing template "${template.name}" with interval: ${interval} days.`);

            // The date before which a contact is eligible for this template.
            const targetDate = startOfDay(subDays(now, interval));

            // Query for all contacts that are eligible for campaigns and were created before the target date.
            const contactsQuery = await firestore.collection('initial_contacts')
                .where('sendFollowUpCampaigns', '==', true)
                .where('createdAt', '<=', Timestamp.fromDate(targetDate))
                .get();

            if (contactsQuery.empty) {
                console.log(`[CRON] No contacts found matching criteria for template "${template.name}".`);
                continue;
            }
            
            console.log(`[CRON] Found ${contactsQuery.docs.length} contacts to check for template "${template.name}".`);

            for (const doc of contactsQuery.docs) {
                const contact = { id: doc.id, ...doc.data() } as InitialContact;
                results.contactsChecked++;
                
                // Skip if the contact has already started the full signup process
                if (convertedContactIds.has(contact.id)) {
                    console.log(`[CRON] Skipping contact ${contact.id}: Already converted to client signup.`);
                    continue;
                }

                // Check if this specific template has already been sent
                const hasBeenSent = contact.followUpHistory?.some((entry: any) => entry.templateId === template.id);
                if (hasBeenSent) {
                    // This is expected for contacts older than the interval, so we don't log it to avoid noise.
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

                await doc.ref.update({
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
