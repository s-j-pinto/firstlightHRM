
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { subHours } from 'date-fns';
import { sendSms } from '@/lib/services/telnyx';
import type { InitialContact, CampaignTemplate } from '@/lib/types';

/**
 * API route to handle a cron job for sending scheduled SMS follow-ups to new leads.
 * It looks for an SMS template configured for a 1-hour interval.
 */
export async function GET(request: NextRequest) {
    // 1. Secure the endpoint
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firestore = serverDb;
    const now = new Date();
    const results = {
        leadsChecked: 0,
        smsSent: 0,
        errors: 0,
    };

    try {
        // Find the active 1-hour SMS template
        const smsTemplateQuery = await firestore.collection('campaign_templates')
            .where('type', '==', 'sms')
            .where('intervalHours', '==', 1)
            .limit(1)
            .get();

        if (smsTemplateQuery.empty) {
            console.log('[SMS Cron] No active 1-hour SMS template found. Job will not run.');
            return NextResponse.json({ success: true, message: "No 1-hour SMS template configured." });
        }
        const smsTemplate = smsTemplateQuery.docs[0].data() as CampaignTemplate;
        const templateId = smsTemplateQuery.docs[0].id;
        const smsMessageBody = smsTemplate.body;

        console.log(`[SMS Cron] Using template "${smsTemplate.name}" for 1-hour follow-up.`);

        // Look back 2 hours to ensure we don't miss leads if a cron job is delayed.
        const cutoffTime = subHours(now, 2);

        const contactsQuery = await firestore.collection('initial_contacts')
            .where('source', '==', 'Google Ads Lead Received')
            .where('createdAt', '>=', Timestamp.fromDate(cutoffTime))
            // We can't query for 'not in' followUpHistory, so we filter in memory.
            .get();

        if (contactsQuery.empty) {
            console.log('[SMS Cron] No recent Google Ads leads to process.');
            return NextResponse.json({ success: true, message: "No new leads to process.", ...results });
        }

        results.leadsChecked = contactsQuery.docs.length;

        for (const doc of contactsQuery.docs) {
            const contact = { id: doc.id, ...doc.data() } as InitialContact;
            const createdAt = (contact.createdAt as Timestamp).toDate();
            
            // Check if it's been more than 1 hour
            if (now.getTime() - createdAt.getTime() < 60 * 60 * 1000) {
                continue; // Skip if it's not yet 1 hour old
            }
            
            // Check if this specific template has already been sent
            const hasBeenSent = contact.followUpHistory?.some((entry: any) => entry.templateId === templateId);
            if(hasBeenSent) {
                continue;
            }

            const clientPhoneNumber = contact.clientPhone;
            const clientName = contact.clientName;

            if (!clientPhoneNumber || !clientName) {
                console.warn(`[SMS Cron] Skipping contact ${contact.id} due to missing phone number or name.`);
                continue;
            }

            const message = smsMessageBody.replace('{{clientName}}', clientName);
            
            const smsResult = await sendSms(clientPhoneNumber, message);
            
            if (smsResult.success) {
                // Update the follow-up history instead of a separate flag
                await doc.ref.update({
                    followUpHistory: FieldValue.arrayUnion({ templateId: templateId, sentAt: Timestamp.now() })
                });
                results.smsSent++;
            } else {
                results.errors++;
                console.error(`[SMS Cron] Failed to send SMS for contact ${contact.id}: ${smsResult.message}`);
            }
        }

        console.log('[SMS Cron] SMS follow-up job completed successfully.', results);
        return NextResponse.json({ success: true, ...results });

    } catch (error: any) {
        console.error('[SMS Cron] Cron job for SMS follow-up failed:', error);
        results.errors++;
        return NextResponse.json({ success: false, error: error.message, ...results }, { status: 500 });
    }
}
