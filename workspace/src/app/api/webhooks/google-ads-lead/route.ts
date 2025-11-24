

import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { CampaignTemplate } from '@/lib/types';

/**
 * API route to handle incoming webhook requests from Google Ads Lead Form extensions.
 * This endpoint receives lead data, validates it, and creates a new document
 * in the 'initial_contacts' Firestore collection. It will also trigger an immediate
 * follow-up email if a template is configured for it.
 */
export async function POST(request: NextRequest) {
  // 1. Security Validation: Check the secret key from Google Ads
  const googleKey = request.nextUrl.searchParams.get('key');
  const expectedKey = process.env.GOOGLE_ADS_WEBHOOK_SECRET;

  if (!expectedKey) {
    console.error('[Google Ads Webhook] Server error: GOOGLE_ADS_WEBHOOK_SECRET is not set in environment variables.');
    return NextResponse.json({ success: false, error: 'Configuration error.' }, { status: 500 });
  }

  if (googleKey !== expectedKey) {
    console.warn(`[Google Ads Webhook] Unauthorized attempt with invalid key: ${googleKey}`);
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const now = Timestamp.now();

    if (payload.is_test) {
        console.log('[Google Ads Webhook] Received a test lead from Google Ads.');
    }

    const userData: { [key: string]: string } = {};
    if (Array.isArray(payload.user_column_data)) {
      for (const column of payload.user_column_data) {
        if (column.column_id === 'FULL_NAME' || column.column_id === 'full_name') {
          userData.clientName = column.string_value;
        } else if (column.column_id === 'EMAIL' || column.column_id === 'email') {
          userData.clientEmail = column.string_value;
        } else if (column.column_id === 'PHONE_NUMBER' || column.column_id === 'phone_number') {
          userData.clientPhone = column.string_value;
        } else {
            userData[column.column_id] = column.string_value;
        }
      }
    }
    
    if (!userData.clientName || !userData.clientEmail || !userData.clientPhone) {
        console.error('[Google Ads Webhook] Payload missing required fields (Name, Email, or Phone).', payload);
        return NextResponse.json({ success: false, error: 'Incomplete lead data.' }, { status: 400 });
    }

    const leadSource = "Google Ads Lead Received";
    const contactData: any = {
      clientName: userData.clientName,
      clientEmail: userData.clientEmail,
      clientPhone: userData.clientPhone,
      clientAddress: userData.address || '',
      city: userData.city || '',
      zip: userData.zip || '',
      mainContact: userData.clientName,
      contactPhone: userData.clientPhone,
      promptedCall: "Google Ads Lead",
      source: leadSource,
      status: "New", // Correctly set the initial status to "New"
      createdAt: now,
      lastUpdatedAt: now,
      googleAdsLeadId: payload.lead_id || null,
      googleAdsCampaignId: payload.campaign_id || null,
      followUpHistory: [], // Initialize history
      ...userData
    };

    const contactRef = await serverDb.collection('initial_contacts').add(contactData);
    console.log(`[Google Ads Webhook] Successfully created initial contact ${contactRef.id} for lead: ${payload.lead_id}`);

    // --- Immediate Follow-up Logic to Client ---
    const templatesSnap = await serverDb.collection('campaign_templates')
        .where('intervalDays', '==', 0)
        .where('sendImmediatelyFor', 'array-contains', leadSource)
        .limit(1)
        .get();

    if (!templatesSnap.empty) {
        const template = templatesSnap.docs[0].data() as CampaignTemplate;
        const templateId = templatesSnap.docs[0].id;

        const assessmentLink = `${process.env.NEXT_PUBLIC_BASE_URL}/lead-intake?id=${contactRef.id}`;
        
        let emailHtml = template.body.replace(/{{clientName}}/g, contactData.clientName);
        emailHtml = emailHtml.replace(/{{assessmentLink}}/g, assessmentLink);

        await serverDb.collection('mail').add({
            to: [contactData.clientEmail],
            message: {
                subject: template.subject,
                html: emailHtml,
            },
        });

        await contactRef.update({
            followUpHistory: FieldValue.arrayUnion({ templateId: templateId, sentAt: now })
        });
        console.log(`[Google Ads Webhook] Queued immediate follow-up email using template ${templateId} for contact ${contactRef.id}.`);
    } else {
        console.log(`[Google Ads Webhook] No immediate follow-up template found for status "${leadSource}".`);
    }

    // --- NEW: Internal Notification Logic ---
    const ownerEmail = process.env.OWNER_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;
    const internalRecipients = [ownerEmail, adminEmail].filter(Boolean) as string[];

    if (internalRecipients.length > 0) {
        const internalEmail = {
            to: internalRecipients,
            message: {
                subject: `New Google Ads Lead Received: ${contactData.clientName}`,
                html: `
                    <p>A new lead has been received from Google Ads.</p>
                    <ul>
                        <li><strong>Client Name:</strong> ${contactData.clientName}</li>
                        <li><strong>Phone Number:</strong> ${contactData.clientPhone}</li>
                        <li><strong>Email Address:</strong> ${contactData.clientEmail}</li>
                    </ul>
                    <p>Please log in to the FirstLightHRM app to follow up.</p>
                `
            }
        };
        await serverDb.collection('mail').add(internalEmail);
        console.log(`[Google Ads Webhook] Queued internal notification for lead ${contactRef.id} to ${internalRecipients.join(', ')}.`);
    } else {
        console.warn('[Google Ads Webhook] OWNER_EMAIL or ADMIN_EMAIL not set. Skipping internal notification.');
    }


    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Google Ads Webhook] Error processing webhook:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
