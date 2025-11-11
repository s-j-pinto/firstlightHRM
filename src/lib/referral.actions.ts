
'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';

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
        const referralUrl = new URL(`${process.env.NEXT_PUBLIC_BASE_URL}/new-referral-client`);
        referralUrl.searchParams.set('ref', referralCode);
        referralUrl.searchParams.set('referrer', referrerName);
        const referralLink = referralUrl.toString();
        
        let messageHtml = `
            <p>Hello ${friendName},</p>
            <p>Your friend, ${referrerName}, thought you might be interested in the services provided by FirstLight Home Care.</p>
        `;

        if (personalMessage) {
            messageHtml += `<p>They also included a personal message for you:</p><blockquote style="border-left: 2px solid #ccc; padding-left: 1em; margin-left: 1em; font-style: italic;">${personalMessage}</blockquote>`;
        }

        messageHtml += `
            <p>To learn more and request information, please click the link below. Your referral information will be automatically included.</p>
            <p><a href="${referralLink}">Request Care Information</a></p>
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


interface UpdateReferralPayload {
    referralId: string;
    newStatus: 'Pending' | 'Converted' | 'Rewarded';
    issueReward?: boolean;
    rewardDetails?: {
        rewardType: 'Discount' | 'Free Hours';
        amount: number;
        description: string;
    };
    referrerClientId?: string;
}

export async function updateReferralStatusAndCreateReward(payload: UpdateReferralPayload) {
    const { referralId, newStatus, issueReward, rewardDetails, referrerClientId } = payload;
    const firestore = serverDb;

    if (!referralId) {
        return { error: 'Referral ID is required.' };
    }

    try {
        const referralRef = firestore.collection('referrals').doc(referralId);
        const batch = firestore.batch();

        batch.update(referralRef, { status: newStatus });

        if (issueReward && rewardDetails && referrerClientId) {
            const rewardRef = firestore.collection('rewards').doc();
            const newReward = {
                clientId: referrerClientId,
                referralId: referralId,
                status: 'Available',
                createdAt: Timestamp.now(),
                ...rewardDetails
            };
            batch.set(rewardRef, newReward);
            // Also update the referral to link it to the reward
            batch.update(referralRef, { rewardId: rewardRef.id });
        }

        await batch.commit();
        
        revalidatePath('/owner/referral-management');
        revalidatePath('/client/referrals');

        return { success: true, message: 'Referral updated successfully.' };
    } catch (error: any) {
        console.error("Error updating referral status:", error);
        return { error: `An error occurred: ${error.message}` };
    }
}

export async function generateReferralCode({ clientId, clientName }: { clientId: string, clientName: string }) {
    if (!clientId || !clientName) {
        return { error: 'Client ID and Name are required.' };
    }

    const firestore = serverDb;
    try {
        const existingProfileQuery = await firestore.collection('referral_profiles').where('clientId', '==', clientId).get();
        if (!existingProfileQuery.empty) {
            return { error: 'This client already has an active referral code.' };
        }

        const namePart = clientName.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
        const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
        const referralCode = `FLHC-${namePart}-${randomPart}`;

        await firestore.collection('referral_profiles').add({
            clientId,
            referralCode,
            status: 'active',
            createdAt: Timestamp.now(),
        });
        
        revalidatePath('/owner/referral-management');

        return { success: true, message: `Referral code ${referralCode} generated for ${clientName}.` };
    } catch (error: any) {
        console.error("Error generating referral code:", error);
        return { error: `An error occurred: ${error.message}` };
    }
}
