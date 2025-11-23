
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import telnyx from 'telnyx';

// Disable the default body parser to access the raw body for signature verification
export const config = {
    api: {
        bodyParser: false,
    },
};

const apiKey = process.env.TELNYX_API_KEY;
const publicKey = process.env.TELNYX_PUBLIC_KEY;
let telnyxApi: ReturnType<typeof telnyx> | null = null;

if (apiKey) {
    telnyxApi = telnyx(apiKey);
}

export async function POST(request: NextRequest) {
    if (!telnyxApi) {
        console.error('[Telnyx Webhook] Telnyx API not configured.');
        return NextResponse.json({ success: false, error: 'Configuration error.' }, { status: 500 });
    }
    if (!publicKey) {
        console.error('[Telnyx Webhook] Telnyx Public Key not configured.');
        return NextResponse.json({ success: false, error: 'Configuration error.' }, { status: 500 });
    }

    try {
        const rawBody = await request.text();
        const signature = request.headers.get('telnyx-signature-ed25519');
        const timestamp = request.headers.get('telnyx-timestamp');

        if (!signature || !timestamp) {
            console.warn('[Telnyx Webhook] Missing signature or timestamp headers.');
            return NextResponse.json({ success: false, error: 'Missing required headers.' }, { status: 400 });
        }
        
        // Verify the webhook signature
        const event = telnyxApi.webhooks.constructEvent(rawBody, signature, timestamp, publicKey);
        
        console.log('[Telnyx Webhook] Received verified payload:', JSON.stringify(event, null, 2));

        const eventType = event.data?.event_type;
        if (eventType !== 'message.received') {
            console.log(`[Telnyx Webhook] Ignoring event type: ${eventType}`);
            return NextResponse.json({ success: true, message: "Event ignored." });
        }

        const message = event.data.payload;
        const fromNumber = message.from?.phone_number;
        const text = message.text;

        if (!fromNumber || !text) {
            console.warn('[Telnyx Webhook] Incomplete message data. Missing "from" or "text".');
            return NextResponse.json({ success: false, error: 'Incomplete message data.' }, { status: 400 });
        }

        // Find the contact associated with the incoming phone number
        const contactsRef = serverDb.collection('initial_contacts');
        // Note: Firestore does not support directly querying parts of a string. 
        // This requires phone numbers to be stored in a consistent E.164 format.
        const query = contactsRef.where('clientPhone', '==', fromNumber).limit(1);
        const snapshot = await query.get();

        if (snapshot.empty) {
            console.warn(`[Telnyx Webhook] No contact found with phone number: ${fromNumber}`);
            // Still return 200 OK to Telnyx to prevent retries for unknown numbers.
            return NextResponse.json({ success: true, message: 'No matching contact found.' });
        }

        const contactDoc = snapshot.docs[0];
        const contactId = contactDoc.id;
        
        // Add the inbound message to the subcollection
        await contactDoc.ref.collection('sms_history').add({
            text: text,
            direction: 'inbound',
            timestamp: Timestamp.now(),
        });
        
        console.log(`[Telnyx Webhook] Saved inbound SMS from ${fromNumber} to contact ${contactId}.`);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        if (error.type === 'TelnyxSignatureVerificationError') {
            console.warn('[Telnyx Webhook] Invalid signature.', error.message);
            return NextResponse.json({ success: false, error: 'Invalid signature.' }, { status: 400 });
        }
        console.error('[Telnyx Webhook] Error processing webhook:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
