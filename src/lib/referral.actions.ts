'use server';

import { serverDb } from '@/firebase/server-init';

interface ReferralInvitePayload {
    friendName: string;
    friendEmail: string;
    referrerName: string;
    referralCode: string;
    personalMessage?: string;
}

export async function sendReferralInvite(payload: ReferralInvitePayload) {
    const { friendName, friendEmail, referrerName, referralCode, personalMessage } = payload;
    const firestore = serverDb;

    try {
        const referralLink = `${process.env.NEXT_PUBLIC_BASE_URL}/?ref=${referralCode}`;
        
        let messageHtml = `
            <p>Hello ${friendName},</p>
            <p>Your friend, ${referrerName}, thought you might be interested in the services provided by FirstLight Home Care.</p>
        `;

        if (personalMessage) {
            messageHtml += `<p>They also included a personal message for you:</p><blockquote style="border-left: 2px solid #ccc; padding-left: 1em; margin-left: 1em; font-style: italic;">${personalMessage}</blockquote>`;
        }

        messageHtml += `
            <p>Learn more about our services by visiting our website. When you contact us, be sure to mention the referral code <strong>${referralCode}</strong> to help ${referrerName} earn a reward!</p>
            <p><a href="${referralLink}">Visit FirstLight Home Care</a></p>
            <p>Thank you,<br/>The FirstLight Home Care Team</p>
        `;

        const email = {
            to: [friendEmail],
            message: {
                subject: `${referrerName} has referred you to FirstLight Home Care`,
                html: `<body style="font-family: sans-serif; line-height: 1.6;">${messageHtml}</body>`
            }
        };

        await firestore.collection('mail').add(email);

        return { message: `Invitation sent successfully to ${friendName}.` };
    } catch (error: any) {
        console.error("Error sending referral invite:", error);
        return { message: "Failed to send invitation. Please try again later.", error: true };
    }
}
