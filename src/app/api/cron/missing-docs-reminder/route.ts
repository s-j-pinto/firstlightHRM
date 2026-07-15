
import { NextRequest, NextResponse } from 'next/server';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { addDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import type { Interview, CaregiverProfile } from '@/lib/types';

/**
 * API route to handle a cron job for sending reminders about missing onboarding documents.
 * Targeted at candidates with orientations scheduled in the next 3 days.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const firestore = serverDb;
    const now = new Date();
    const threeDaysFromNow = addDays(now, 3);
    const interval = { start: startOfDay(now), end: endOfDay(threeDaysFromNow) };

    const adminEmail = "care-rc@firstlighthomecare.com";
    const ownerEmail = "lpinto@firstlighthomecare.com";
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

    const mandatoryDocs = [
        { id: "driversLicense", label: "DRIVERS LICENSE" },
        { id: "dmvRecord", label: "DMV RECORD" },
        { id: "carInsurance", label: "CAR INSURANCE" },
        { id: "carRegistration", label: "CAR REGISTRATION" },
        { id: "ssnCard", label: "SOCIAL SECURITY CARD" },
        { id: "hcaClearance", label: "HCA CLEARANCE LETTER" },
        { id: "liveScanLetter", label: "LIVE SCAN LETTER" },
        { id: "tbTestResults", label: "TB TEST RESULTS" },
    ];

    try {
        const interviewsSnap = await firestore.collection('interviews')
            .where('orientationScheduled', '==', true)
            .get();

        const pendingReminders = [];

        for (const doc of interviewsSnap.docs) {
            const interview = doc.data() as Interview;
            const orientDate = interview.orientationDateTime ? (interview.orientationDateTime as any).toDate() : null;

            if (orientDate && isWithinInterval(orientDate, interval)) {
                const profileDoc = await firestore.collection('caregiver_profiles').doc(interview.caregiverProfileId).get();
                if (!profileDoc.exists) continue;

                const profile = profileDoc.data() as CaregiverProfile;
                const missing = mandatoryDocs.filter(doc => !profile[`${doc.id}Received` as keyof CaregiverProfile]);

                if (missing.length > 0) {
                    pendingReminders.push({
                        name: profile.fullName,
                        phone: profile.phone,
                        orientDate: format(orientDate, 'PPp'),
                        missingList: missing.map(m => m.label)
                    });
                }
            }
        }

        if (pendingReminders.length === 0) {
            return NextResponse.json({ success: true, message: "No candidates with missing docs and upcoming orientation." });
        }

        for (const reminder of pendingReminders) {
            const emailHtml = `
                <body style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <img src="${logoUrl}" alt="FirstLight Home Care Logo" style="width: 180px; height: auto; margin-bottom: 20px;" />
                        <h2 style="color: #E07A5F;">Missing Documents Reminder</h2>
                        <p>Admin,</p>
                        <p>The candidate <strong>${reminder.name}</strong> with phone number <strong>${reminder.phone}</strong>, has not yet submitted the following documents to the FirstLight Homecare back office prior to their orientation on <strong>${reminder.orientDate}</strong>:</p>
                        <ul style="background: #f9f9f9; padding: 15px 30px; border-radius: 5px; list-style-type: square;">
                            ${reminder.missingList.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                        <p style="margin-top: 20px; font-weight: bold;">CareConnect System</p>
                    </div>
                </body>
            `;

            await firestore.collection('mail').add({
                to: [adminEmail, ownerEmail],
                message: {
                    subject: `Missing documents reminder for ${reminder.name} before Orientation on ${reminder.orientDate}`,
                    html: emailHtml,
                },
            });
        }

        return NextResponse.json({ success: true, count: pendingReminders.length });

    } catch (error: any) {
        console.error("[CRON] Missing Docs Reminder failed:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function format(date: Date, pattern: string): string {
    return date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}
