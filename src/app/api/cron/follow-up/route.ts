
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { subDays, isBefore, startOfDay } from 'date-fns';
import type { CampaignTemplate, InitialContact } from '@/lib/types';

/**
 * API route to handle scheduled cron jobs for sending follow-up emails based on dynamic templates.
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
    processed: 0,
    emailsSent: 0,
    errors: 0,
  };

  try {
    // 2. Fetch all active email campaign templates
    const templatesSnap = await firestore.collection('campaign_templates').where('type', '==', 'email').get();
    if (templatesSnap.empty) {
        return NextResponse.json({ message: 'No active email templates found.' });
    }
    const templates = templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignTemplate));

    // 3. Get all initial contacts that are still in a follow-up state
    const contactsSnap = await firestore.collection('initial_contacts')
        .where('status', 'in', ['Initial Phone Contact Completed', 'App Referral Received'])
        .get();

    if (contactsSnap.empty) {
        return NextResponse.json({ message: 'No eligible contacts to process.' });
    }
    
    // Get all client_signups to filter out converted contacts
    const signupsSnap = await firestore.collection('client_signups').get();
    const convertedContactIds = new Set(signupsSnap.docs.map(doc => doc.data().initialContactId));

    const eligibleContacts = contactsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as InitialContact))
        .filter(contact => !convertedContactIds.has(contact.id));
    
    results.processed = eligibleContacts.length;

    // 4. Process each template against all eligible contacts
    for (const template of templates) {
        const intervalDays = template.intervalDays;
        const followUpDate = startOfDay(subDays(now, intervalDays));

        for (const contact of eligibleContacts) {
            const createdAt = (contact.createdAt as Timestamp).toDate();
            const followUpHistory = contact.followUpHistory || [];

            const hasBeenSent = followUpHistory.some((entry: any) => entry.templateId === template.id || entry.days === intervalDays); // Check legacy 'days' field too
            
            // Check if contact is old enough AND this template hasn't been sent
            if (isBefore(createdAt, followUpDate) && !hasBeenSent) {
                
                // Send Email
                const emailHtml = template.body.replace(/{{clientName}}/g, contact.clientName);

                await firestore.collection('mail').add({
                    to: [contact.clientEmail],
                    message: {
                        subject: template.subject,
                        html: emailHtml,
                    },
                });

                // Update history with template ID for precise tracking
                followUpHistory.push({ templateId: template.id, sentAt: Timestamp.now() });
                await firestore.collection('initial_contacts').doc(contact.id).update({
                    followUpHistory: followUpHistory,
                });
                
                results.emailsSent++;
            }
        }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error('Cron job for follow-up failed:', error);
    results.errors++;
    return NextResponse.json({ success: false, error: error.message, ...results }, { status: 500 });
  }
}
