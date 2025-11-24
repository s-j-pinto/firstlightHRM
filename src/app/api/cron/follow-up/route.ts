
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { InitialContact, CampaignTemplate } from '@/lib/types';
import { subDays, isWithinInterval } from 'date-fns';

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

        // Get a list of all contact IDs that have been converted to a full signup
        const signupsSnap = await firestore.collection('client_signups').select('initialContactId').get();
        const convertedContactIds = new Set(signupsSnap.docs.map(doc => doc.data().initialContactId).filter(Boolean));

        for (const template of templates) {
            const interval = template.intervalDays;
            // Target date is `interval` days ago. We'll look for contacts created around that day.
            const targetDate = subDays(now, interval);
            // To avoid complex range queries, fetch contacts from the last (interval + 1) days and filter in code.
            const queryStartDate = subDays(now, interval + 1);

            const contactsQuery = await firestore.collection('initial_contacts')
                .where('sendFollowUpCampaigns', '==', true)
                .where('createdAt', '>=', Timestamp.fromDate(queryStartDate))
                .get();

            if (contactsQuery.empty) {
                console.log(`[CRON] No recent contacts found for template "${template.name}" (interval: ${interval} days).`);
                continue;
            }
            
            results.contactsChecked += contactsQuery.docs.length;

            for (const doc of contactsQuery.docs) {
                const contact = { id: doc.id, ...doc.data() } as InitialContact;
                const contactCreatedAt = (contact.createdAt as Timestamp)?.toDate();

                if (!contactCreatedAt) continue;

                // Check if the contact was created within the 24-hour window of the target date.
                const isTargetDay = isWithinInterval(contactCreatedAt, {
                    start: subDays(now, interval + 1),
                    end: subDays(now, interval),
                });
                
                if (!isTargetDay) continue;

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
                console.log(`[CRON] Queued email using template "${template.name}" for contact ${contact.id}.`);
            }
        }

        console.log('[CRON] Daily follow-up job completed successfully.', results);
        return NextResponse.json({ success: true, ...results });

    } catch (error: any) {
        console.error('[CRON] Cron job failed:', error);
        results.errors++;
        return NextResponse.json({ success: false, error: error.message, ...results }, { status: 500 });
    }
}
