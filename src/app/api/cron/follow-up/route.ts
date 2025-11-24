
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
        console.log(`[CRON] Found ${templates.length} active campaign templates.`);

        // Get a list of all contact IDs that have been converted to a full signup
        const signupsSnap = await firestore.collection('client_signups').select('initialContactId').get();
        const convertedContactIds = new Set(signupsSnap.docs.map(doc => doc.data().initialContactId).filter(Boolean));
        console.log(`[CRON] Found ${convertedContactIds.size} converted client signups to exclude.`);

        for (const template of templates) {
            const interval = template.intervalDays;
            console.log(`[CRON] Processing template "${template.name}" with interval: ${interval} days.`);

            // Query for contacts created in a broader window to avoid complex queries.
            // We will filter more precisely in the code.
            const queryStartDate = subDays(now, interval + 2); // Adding buffer
            
            // SIMPLIFIED QUERY: Only filter by date to avoid composite index requirement.
            const contactsQuery = await firestore.collection('initial_contacts')
                .where('createdAt', '>=', Timestamp.fromDate(queryStartDate))
                .get();

            if (contactsQuery.empty) {
                console.log(`[CRON] No recent contacts found for template "${template.name}".`);
                continue;
            }
            
            console.log(`[CRON] Found ${contactsQuery.docs.length} recent contacts to check for template "${template.name}".`);

            for (const doc of contactsQuery.docs) {
                const contact = { id: doc.id, ...doc.data() } as InitialContact;
                results.contactsChecked++;

                // In-memory filter for sendFollowUpCampaigns
                if (contact.sendFollowUpCampaigns !== true) {
                    continue;
                }

                const contactCreatedAt = (contact.createdAt as Timestamp)?.toDate();
                if (!contactCreatedAt) {
                    console.log(`[CRON] Skipping contact ${contact.id}: Missing or invalid createdAt field.`);
                    continue;
                }

                // Check if the contact was created within the 24-hour window of the target date.
                const isTargetDay = isWithinInterval(contactCreatedAt, {
                    start: subDays(now, interval + 1),
                    end: subDays(now, interval),
                });
                
                if (!isTargetDay) {
                    // This is expected, so we don't log every skip unless debugging verbosely.
                    continue;
                }
                
                console.log(`[CRON] Contact ${contact.id} matches target day for template "${template.name}". Checking other criteria...`);

                // Skip if the contact has already started the full signup process
                if (convertedContactIds.has(contact.id)) {
                    console.log(`[CRON] Skipping contact ${contact.id}: Already converted to client signup.`);
                    continue;
                }

                // Check if this specific template has already been sent
                const hasBeenSent = contact.followUpHistory?.some((entry: any) => entry.templateId === template.id);
                if (hasBeenSent) {
                    console.log(`[CRON] Skipping contact ${contact.id}: Template "${template.name}" already sent.`);
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
