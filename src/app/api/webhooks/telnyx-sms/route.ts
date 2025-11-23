
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json();
        console.log('[Telnyx Webhook] Received payload:', JSON.stringify(payload, null, 2));

        const eventType = payload.data?.event_type;
        if (eventType !== 'message.received') {
            console.log(`[Telnyx Webhook] Ignoring event type: ${eventType}`);
            return NextResponse.json({ success: true, message: "Event ignored." });
        }

        const message = payload.data.payload;
        const fromNumber = message.from?.phone_number;
        const text = message.text;

        if (!fromNumber || !text) {
            console.warn('[Telnyx Webhook] Incomplete message data. Missing "from" or "text".');
            return NextResponse.json({ success: false, error: 'Incomplete message data.' }, { status: 400 });
        }

        // Find the contact associated with the incoming phone number
        const contactsRef = serverDb.collection('initial_contacts');
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
        console.error('[Telnyx Webhook] Error processing webhook:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
