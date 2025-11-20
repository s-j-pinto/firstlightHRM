
"use server";

import telnyx from 'telnyx';

const apiKey = process.env.TELNYX_API_KEY;
const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
let telnyxApi: ReturnType<typeof telnyx> | null = null;

if (apiKey) {
    telnyxApi = telnyx(apiKey);
} else {
    console.warn("[Telnyx Service] TELNYX_API_KEY is not set. SMS sending will be disabled.");
}

/**
 * Sends an SMS message using the Telnyx API.
 * @param to The recipient's phone number in E.164 format (e.g., +15551234567).
 * @param from The Telnyx messaging profile ID or a Telnyx phone number.
 * @param text The content of the SMS message.
 */
export async function sendSms(to: string, text: string): Promise<{ success: boolean; message: string }> {
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
        return { success: true, message: "SMS sent." };
    } catch (error: any) {
        console.error(`[Telnyx Service] Error sending SMS to ${to}:`, error.raw);
        return { success: false, message: `Failed to send SMS: ${error.raw?.errors?.[0]?.detail || error.message}` };
    }
}
