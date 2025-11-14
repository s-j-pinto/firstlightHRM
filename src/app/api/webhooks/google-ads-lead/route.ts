
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * API route to handle incoming webhook requests from Google Ads Lead Form extensions.
 * This endpoint receives lead data, validates it, and creates a new document
 * in the 'initial_contacts' Firestore collection.
 */
export async function POST(request: NextRequest) {
  // 1. Security Validation: Check the secret key from Google Ads
  const googleKey = request.nextUrl.searchParams.get('key');
  const expectedKey = process.env.GOOGLE_ADS_WEBHOOK_SECRET;

  if (!expectedKey) {
    console.error('[Google Ads Webhook] Server error: GOOGLE_ADS_WEBHOOK_SECRET is not set in environment variables.');
    // Return a generic error to avoid leaking information
    return NextResponse.json({ success: false, error: 'Configuration error.' }, { status: 500 });
  }

  if (googleKey !== expectedKey) {
    console.warn(`[Google Ads Webhook] Unauthorized attempt with invalid key: ${googleKey}`);
    return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    // 2. Parse the incoming JSON payload from Google Ads
    const payload = await request.json();

    // Log if this is a test lead from Google
    if (payload.is_test) {
        console.log('[Google Ads Webhook] Received a test lead from Google Ads.');
    }

    // 3. Extract user data from the payload
    const userData: { [key: string]: string } = {};
    if (Array.isArray(payload.user_column_data)) {
      for (const column of payload.user_column_data) {
        // Map common column IDs to our schema fields
        if (column.column_id === 'FULL_NAME' || column.column_id === 'full_name') {
          userData.clientName = column.string_value;
        } else if (column.column_id === 'EMAIL' || column.column_id === 'email') {
          userData.clientEmail = column.string_value;
        } else if (column.column_id === 'PHONE_NUMBER' || column.column_id === 'phone_number') {
          userData.clientPhone = column.string_value;
        } else {
            // Store any other fields dynamically
            userData[column.column_id] = column.string_value;
        }
      }
    }
    
    if (!userData.clientName || !userData.clientEmail || !userData.clientPhone) {
        console.error('[Google Ads Webhook] Payload missing required fields (Name, Email, or Phone).', payload);
        return NextResponse.json({ success: false, error: 'Incomplete lead data.' }, { status: 400 });
    }

    // 4. Create a new 'initial_contacts' document
    const contactData = {
      clientName: userData.clientName,
      clientEmail: userData.clientEmail,
      clientPhone: userData.clientPhone,
      clientAddress: userData.address || '', // Assuming 'address' might be a field
      city: userData.city || '',
      zip: userData.zip || '',
      mainContact: userData.clientName, // Default main contact to client
      contactPhone: userData.clientPhone,
      promptedCall: "Google Ads Lead", // Set the lead source
      status: "Initial Phone Contact Completed", // Set initial status
      createdAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
      // Add any other fields from userData you want to save
      ...userData
    };

    await serverDb.collection('initial_contacts').add(contactData);
    console.log(`[Google Ads Webhook] Successfully created initial contact for lead: ${payload.lead_id}`);

    // 5. Respond to Google with a success status
    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[Google Ads Webhook] Error processing webhook:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
