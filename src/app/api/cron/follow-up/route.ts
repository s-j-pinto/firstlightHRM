
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { subDays, isBefore, startOfDay } from 'date-fns';
import type { CampaignTemplate, InitialContact } from '@/lib/types';

// --- CONFIGURATION FOR PENDING SIGNATURE REMINDER ---
const PENDING_SIGNATURE_REMINDER_SUBJECT = 'Reminder: Please Sign Your FirstLight Home Care Agreement';

function getPendingSignatureReminderBody(clientName: string, signingLink: string): string {
  // You can edit the HTML content of the reminder email here.
  return `
    <p>Hello ${clientName},</p>
    <p>This is a friendly reminder to complete your onboarding with FirstLight Home Care. Your service agreement is awaiting your signature.</p>
    <p>Please click the link below to securely log in and sign your documents:</p>
    <p><a href="${signingLink}">Complete Your Signature</a></p>
    <p>Thank you,</p>
    <p>The FirstLight Home Care Team</p>
  `;
}
// --- END OF CONFIGURATION ---


/**
 * API route to handle scheduled cron jobs for sending follow-up messages.
 * This job handles two types of follow-ups:
 * 1. Nurture campaigns for new leads.
 * 2. Signature reminders for clients with pending documents.
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
    newLeadsProcessed: 0,
    newLeadEmailsSent: 0,
    pendingSignaturesProcessed: 0,
    signatureRemindersSent: 0,
    errors: 0,
  };

  try {
    // --- Task 1: Process New Lead Follow-up Campaigns ---
    await processNewLeadCampaigns(firestore, now, results);

    // --- Task 2: Process Pending Signature Follow-ups ---
    await processPendingSignatureReminders(firestore, now, results);

    console.log('[Cron] Follow-up job completed successfully.', results);
    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error('Cron job for follow-up failed:', error);
    results.errors++;
    return NextResponse.json({ success: false, error: error.message, ...results }, { status: 500 });
  }
}

async function processNewLeadCampaigns(firestore: FirebaseFirestore.Firestore, now: Date, results: any) {
    const templatesSnap = await firestore.collection('campaign_templates').where('type', '==', 'email').get();
    if (templatesSnap.empty) {
        console.log('[Cron] No active email templates found for new leads.');
        return;
    }
    const templates = templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampaignTemplate));

    const contactsSnap = await firestore.collection('initial_contacts')
        .where('sendFollowUpCampaigns', '==', true)
        .where('status', '==', 'New')
        .get();

    if (contactsSnap.empty) {
        console.log('[Cron] No eligible new leads to process.');
        return;
    }
    
    const signupsSnap = await firestore.collection('client_signups').get();
    const convertedContactIds = new Set(signupsSnap.docs.map(doc => doc.data().initialContactId));

    const eligibleContacts = contactsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as InitialContact))
        .filter(contact => !convertedContactIds.has(contact.id));
    
    results.newLeadsProcessed = eligibleContacts.length;

    for (const template of templates) {
        if (template.intervalDays === 0) continue;

        const intervalDays = template.intervalDays;
        const followUpDate = startOfDay(subDays(now, intervalDays));

        for (const contact of eligibleContacts) {
            const createdAt = (contact.createdAt as Timestamp).toDate();
            const followUpHistory = contact.followUpHistory || [];
            const hasBeenSent = followUpHistory.some((entry: any) => entry.templateId === template.id);
            
            if (!contact.clientEmail) {
                console.warn(`[Cron] Skipping contact ${contact.id} due to missing email.`);
                continue;
            }

            if (isBefore(createdAt, followUpDate) && !hasBeenSent) {
                const assessmentLink = `${process.env.NEXT_PUBLIC_BASE_URL}/lead-intake?id=${contact.id}`;
                let emailHtml = template.body.replace(/{{clientName}}/g, contact.clientName);
                emailHtml = emailHtml.replace(/{{assessmentLink}}/g, assessmentLink);

                await firestore.collection('mail').add({
                    to: [contact.clientEmail],
                    message: { subject: template.subject, html: emailHtml },
                });

                followUpHistory.push({ templateId: template.id, sentAt: Timestamp.now() });
                await firestore.collection('initial_contacts').doc(contact.id).update({ followUpHistory });
                
                results.newLeadEmailsSent++;
            }
        }
    }
}

async function processPendingSignatureReminders(firestore: FirebaseFirestore.Firestore, now: Date, results: any) {
    const pendingSignupsSnap = await firestore.collection('client_signups')
        .where('status', '==', 'Pending Client Signatures')
        .where('signatureReminderSent', '!=', true)
        .get();

    if (pendingSignupsSnap.empty) {
        console.log('[Cron] No pending signatures found needing a reminder.');
        return;
    }
    
    results.pendingSignaturesProcessed = pendingSignupsSnap.docs.length;
    const reminderCutoff = subDays(now, 1);

    for (const doc of pendingSignupsSnap.docs) {
        const signupData = doc.data();
        const lastUpdated = (signupData.lastUpdatedAt as Timestamp).toDate();

        if (isBefore(lastUpdated, reminderCutoff)) {
            const clientEmail = signupData.clientEmail;
            if (!clientEmail) {
                 console.warn(`[Cron] Skipping signature reminder for signup ID ${doc.id} due to missing email.`);
                 continue;
            }

            const clientName = signupData.formData?.clientName || 'Valued Client';
            const signupId = doc.id;
            const redirectPath = `/client-sign/${signupId}`;
            const loginUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/new-client-login`);
            loginUrl.searchParams.set('redirect', redirectPath);
            const signingLink = loginUrl.toString();

            const emailHtml = getPendingSignatureReminderBody(clientName, signingLink);
            
            await firestore.collection('mail').add({
                to: [clientEmail],
                message: {
                    subject: PENDING_SIGNATURE_REMINDER_SUBJECT,
                    html: `<body style="font-family: sans-serif; line-height: 1.6;">${emailHtml}</body>`
                },
            });
            
            // Mark that the reminder has been sent to prevent duplicates
            await doc.ref.update({ signatureReminderSent: true });
            results.signatureRemindersSent++;
            console.log(`[Cron] Sent signature reminder to ${clientEmail} for signup ID ${signupId}.`);
        }
    }
}
