
"use server";

import telnyx from 'telnyx';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

const apiKey = process.env.TELNYX_API_KEY;
const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
let telnyxApi: ReturnType<typeof telnyx> | null = null;

if (apiKey) {
    telnyxApi = telnyx(apiKey);
} else {
    console.warn("[Telnyx Service] TELNYX_API_KEY is not set. SMS sending will be disabled.");
}

/**
 * Sends an SMS message using the Telnyx API and records it in the database.
 * @param to The recipient's phone number in E.164 format (e.g., +15551234567).
 * @param text The content of the SMS message.
 * @param contactId The ID of the initial_contacts document to record the message against.
 */
export async function sendSms(to: string, text: string, contactId?: string): Promise<{ success: boolean; message: string }> {
    if (!telnyxApi) {
        const errorMsg = "Telnyx API is not configured. Cannot send SMS.";
        console.error(`[Telnyx Service] ${errorMsg}`);
        return { success: false, message: errorMsg };
    }

    if (!messagingProfileId) {
        const errorMsg = "Telnyx Messaging Profile ID is not configured. Cannot send SMS.";
        console.error(`[Telnyx Service] ${errorMsg}`);
        return { success: false, message: errorMsg };
    }

    try {
        await telnyxApi.messages.create({
            from: messagingProfileId,
            to: to,
            text: text,
        });
        
        console.log(`[Telnyx Service] SMS sent successfully to ${to}.`);

        // If a contactId is provided, save the outbound message to its history.
        if (contactId) {
            await serverDb
                .collection('initial_contacts')
                .doc(contactId)
                .collection('sms_history')
                .add({
                    text: text,
                    direction: 'outbound',
                    timestamp: Timestamp.now(),
                });
            console.log(`[Telnyx Service] Outbound SMS for contact ${contactId} saved to history.`);
        }

        return { success: true, message: "SMS sent." };
    } catch (error: any) {
        console.error(`[Telnyx Service] Error sending SMS to ${to}:`, error.raw);
        return { success: false, message: `Failed to send SMS: ${error.raw?.errors?.[0]?.detail || error.message}` };
    }
}
