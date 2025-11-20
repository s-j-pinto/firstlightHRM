
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { subMinutes } from 'date-fns';
import { sendSms } from '@/lib/services/telnyx';
import type { InitialContact } from '@/lib/types';

const SMS_MESSAGE_BODY = `Hi {{clientName}}, this is FirstLight Home Care. Thank you for your interest! A care coordinator will call you shortly to discuss your needs. If you have immediate questions, you can reach our office at (909) 321-4466.`;

/**
 * API route to handle a cron job for sending 1-hour SMS follow-ups to new Google Ads leads.
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
    
    // We look back 75 mins to ensure we don't miss leads if a cron job is delayed.
    const cutoffTime = subMinutes(now, 75);

    try {
        console.log('[SMS Cron] Starting SMS follow-up job.');
        const contactsQuery = await firestore.collection('initial_contacts')
            .where('source', '==', 'Google Ads Lead Received')
            .where('createdAt', '>=', Timestamp.fromDate(cutoffTime))
            .where('smsFollowUpSent', '!=', true)
            .get();

        if (contactsQuery.empty) {
            console.log('[SMS Cron] No new Google Ads leads to process.');
            return NextResponse.json({ success: true, message: "No new leads to process.", ...results });
        }

        results.leadsChecked = contactsQuery.docs.length;

        for (const doc of contactsQuery.docs) {
            const contact = { id: doc.id, ...doc.data() } as InitialContact;
            const createdAt = (contact.createdAt as Timestamp).toDate();
            
            // Filter to only send to leads older than 60 minutes
            if (now.getTime() - createdAt.getTime() < 60 * 60 * 1000) {
                continue; // Skip if it's not yet 1 hour old
            }
            
            const clientPhoneNumber = contact.clientPhone;
            const clientName = contact.clientName;

            if (!clientPhoneNumber || !clientName) {
                console.warn(`[SMS Cron] Skipping contact ${contact.id} due to missing phone number or name.`);
                continue;
            }

            const message = SMS_MESSAGE_BODY.replace('{{clientName}}', clientName);
            
            const smsResult = await sendSms(clientPhoneNumber, message);
            
            if (smsResult.success) {
                await doc.ref.update({ smsFollowUpSent: true });
                results.smsSent++;
            } else {
                results.errors++;
                console.error(`[SMS Cron] Failed to send SMS for contact ${contact.id}: ${smsResult.message}`);
                // Optional: You could add more robust error handling here, like retries.
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
