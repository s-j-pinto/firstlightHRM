
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { serverDb, serverApp } from '@/firebase/server-init';

/**
 * API route to handle a weekly cron job for sending certification renewal reminders.
 * This job reads a JSON file from GCS, matches caregivers to their emails,
 * and sends a formatted notification via the 'mail' collection.
 */
export async function GET(request: NextRequest) {
    // 1. Secure the endpoint
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.error('[CRON] Unauthorized access attempt to certifications-reminder.');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting weekly certifications reminder job.');
    const firestore = serverDb;
    const results = {
        totalRecords: 0,
        emailsSent: 0,
        skippedNotFound: 0,
        errors: 0,
    };

    try {
        // 2. Fetch the expiring certifications JSON from Google Cloud Storage
        const bucket = getStorage(serverApp).bucket('gs://firstlighthomecare-hrm.firebasestorage.app');
        const file = bucket.file('caregiver-expiring-certifications/caregiver-expiring-certifications.json');
        
        const [contents] = await file.download();
        const data = JSON.parse(contents.toString());
        const records = data.records || [];
        results.totalRecords = records.length;

        if (records.length === 0) {
            console.log('[CRON] No expiring certifications found in JSON. Job finished.');
            return NextResponse.json({ success: true, message: "No records to process." });
        }

        // 3. Build a Name -> Email map from active caregivers to resolve recipients
        const caregiversSnap = await firestore.collection('caregivers_active').get();
        const nameToEmailMap = new Map<string, string>();
        
        caregiversSnap.forEach(doc => {
            const cg = doc.data();
            if (cg.Name && cg.Email) {
                const normalizedEmail = cg.Email.trim().toLowerCase();
                // Standard match
                nameToEmailMap.set(cg.Name.trim().toLowerCase(), normalizedEmail);
                
                // Also handle "Last, First" -> "First Last" matching just in case
                if (cg.Name.includes(',')) {
                    const parts = cg.Name.split(',').map(p => p.trim());
                    if (parts.length === 2) {
                        nameToEmailMap.set(`${parts[1]} ${parts[0]}`.toLowerCase(), normalizedEmail);
                    }
                }
            }
        });

        // 4. Configuration
        const ccList = [
            "hr_assist@firstlighthomecare.com",
            "admin-rc@firstlighthomecare.com",
            "lpinto@firstlighthomecare.com"
        ];
        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

        // 5. Process records and send emails
        for (const record of records) {
            const caregiverName = record.Caregiver;
            if (!caregiverName) continue;

            const caregiverEmail = nameToEmailMap.get(caregiverName.trim().toLowerCase());

            if (!caregiverEmail) {
                console.warn(`[CRON] Could not resolve email for caregiver: ${caregiverName}. Skipping.`);
                results.skippedNotFound++;
                continue;
            }

            const emailHtml = `
                <div style="font-family: sans-serif; color: #333; line-height: 1.6; max-width: 650px;">
                    <p style="font-size: 16px;">${caregiverName},</p>
                    <p>Your certifications as listed below has either expired or is expiring within the next 30 days. Please renew the listed certifications and send picture of certificate in text message to front office number <strong>(909) 321 4466</strong> as soon as possible.</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; border: 1px solid #eee;">
                        <thead>
                            <tr style="background-color: #f2f2f2;">
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">License #</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">DL Exp</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">HCA Registration</th>
                                <th style="border: 1px solid #ddd; padding: 10px; text-align: left;">TB-Test</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="border: 1px solid #ddd; padding: 10px;">${record["License #"] || '-'}</td>
                                <td style="border: 1px solid #ddd; padding: 10px;">${record["DL Exp"] || '-'}</td>
                                <td style="border: 1px solid #ddd; padding: 10px;">${record["HCA Registration"] || '-'}</td>
                                <td style="border: 1px solid #ddd; padding: 10px;">${record["TB-Test"] || '-'}</td>
                            </tr>
                        </tbody>
                    </table>

                    <p style="margin-top: 30px; font-weight: bold;">Administrator,</p>
                    <img src="${logoUrl}" alt="FirstLight Home Care Logo" style="width: 200px; height: auto;" />
                </div>
            `;

            await firestore.collection('mail').add({
                to: [caregiverEmail],
                cc: ccList,
                message: {
                    subject: `Certification Renewal for ${caregiverName} - Action Needed`,
                    html: emailHtml,
                },
            });

            results.emailsSent++;
        }

        console.log('[CRON] Weekly certifications reminder job completed.', results);
        return NextResponse.json({ success: true, ...results });

    } catch (error: any) {
        console.error('[CRON ERROR] certifications-reminder failed:', error);
        return NextResponse.json({ 
            success: false, 
            error: error.message,
            ...results 
        }, { status: 500 });
    }
}
