
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { subDays, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

// Define the intervals for follow-ups in days
const FOLLOW_UP_INTERVALS = [3, 7, 14];

/**
 * API route to handle scheduled cron jobs for sending follow-up emails.
 *
 * This route is protected by a secret token that must be passed in the
 * Authorization header as a Bearer token.
 *
 * It performs the following actions:
 * 1. Queries for initial contacts that have not yet been converted.
 * 2. Checks if their creation date matches a follow-up interval (e.g., 3, 7, 14 days ago).
 * 3. Verifies that a follow-up for that specific interval hasn't already been sent.
 * 4. Queues a templated follow-up email using the firestore-send-email extension.
 * 5. Updates the contact's record to prevent duplicate follow-ups.
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
    alreadyFollowedUp: 0,
    errors: 0,
  };

  try {
    // 2. Get all initial contacts that are still in a follow-up state
    const contactsSnap = await firestore.collection('initial_contacts')
        .where('status', 'in', ['Initial Phone Contact Completed', 'App Referral Received'])
        .get();

    if (contactsSnap.empty) {
        return NextResponse.json({ message: 'No eligible contacts to process.' });
    }
    
    // Get all client_signups to filter out converted contacts
    const signupsSnap = await firestore.collection('client_signups').get();
    const convertedContactIds = new Set(signupsSnap.docs.map(doc => doc.data().initialContactId));

    const eligibleContacts = contactsSnap.docs.filter(doc => !convertedContactIds.has(doc.id));
    results.processed = eligibleContacts.length;

    // 3. Process each eligible contact
    for (const contactDoc of eligibleContacts) {
        const contact = contactDoc.data();
        const contactId = contactDoc.id;
        const createdAt = (contact.createdAt as Timestamp).toDate();

        for (const days of FOLLOW_UP_INTERVALS) {
            const targetDate = subDays(now, days);
            
            // Check if the contact was created within the 24-hour window of the target date
            if (isWithinInterval(createdAt, { start: startOfDay(targetDate), end: endOfDay(targetDate) })) {
                
                const followUpHistory = contact.followUpHistory || [];
                const hasBeenSent = followUpHistory.some((entry: any) => entry.days === days);

                if (!hasBeenSent) {
                    // 4. Send Email
                    const emailContent = getEmailTemplate(days, contact.clientName);
                    
                    await firestore.collection('mail').add({
                        to: [contact.clientEmail],
                        message: {
                            subject: emailContent.subject,
                            html: emailContent.html,
                        },
                    });

                    // 5. Update history
                    followUpHistory.push({ days, sentAt: Timestamp.now() });
                    await firestore.collection('initial_contacts').doc(contactId).update({
                        followUpHistory: followUpHistory,
                    });
                    
                    results.emailsSent++;
                    // Break from intervals loop since we found the right one for today
                    break; 
                } else {
                    results.alreadyFollowedUp++;
                }
            }
        }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error('Cron job for follow-up failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


/**
 * Generates email content based on the follow-up interval.
 */
function getEmailTemplate(days: number, clientName: string) {
  const assessmentLink = `${process.env.NEXT_PUBLIC_BASE_URL}/owner/initial-contact`;
  const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

  let subject = "";
  let body = "";

  if (days === 3) {
    subject = "Following Up from FirstLight Home Care";
    body = `<p>We hope you're having a good week. It's been a few days since we last spoke, and we wanted to gently follow up.</p>
            <p>If you have any questions or are ready to take the next step, we'd be happy to schedule a free, no-obligation assessment with you. You can learn more by contacting our office at (909) 321-4466.</p>`;
  } else if (days === 7) {
    subject = "A Quick Check-in from FirstLight Home Care";
    body = `<p>We're just checking in to see how you're doing. We understand that making decisions about care can take time, and we're here to help whenever you're ready.</p>
            <p>We're happy to answer any questions you might have. Feel free to reply to this email or call us at (909) 321-4466.</p>`;
  } else { // 14 days or other
    subject = "Thinking of You - FirstLight Home Care";
    body = `<p>We wanted to reach out one more time to see if there's anything we can do to help you and your family. We pride ourselves on being a resource for our community, even if you don't need our services right now.</p>
            <p>Please don't hesitate to get in touch if your needs change in the future.</p>`;
  }

  const html = `
    <body style="font-family: sans-serif; line-height: 1.6;">
      <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <p>Hello ${clientName},</p>
        ${body}
        <p>Warmly,<br>The Team at FirstLight Home Care of Rancho Cucamonga</p>
        <div style="margin-top: 30px; text-align: center;">
          <img src="${logoUrl}" alt="FirstLight Home Care Logo" width="200" />
        </div>
      </div>
    </body>
  `;

  return { subject, html };
}
