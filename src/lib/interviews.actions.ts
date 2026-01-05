

"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { CaregiverProfile, Interview } from './types';
import { Timestamp } from 'firebase-admin/firestore';
import { format, formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

interface SaveInterviewPayload {
  caregiverProfile: CaregiverProfile;
  eventDate: string; // Keep as string yyyy-MM-dd
  eventTime: string; // Keep as string HH:mm
  interviewId: string;
  aiInsight: string | null;
  interviewType: 'In-Person' | 'Google Meet' | 'Orientation';
  interviewNotes: string;
  candidateRating: string;
  pathway: 'separate' | 'combined';
  finalInterviewStatus?: 'Passed' | 'Failed' | 'Pending' | 'Pending reference checks' |'Rejected at Orientation';
  googleEventId?: string | null; // Add this to handle updates
  previousPathway?: 'separate' | 'combined' | null;
  includeReferenceForm?: boolean;
}

export async function saveInterviewAndSchedule(payload: SaveInterviewPayload) {
  const { 
    caregiverProfile, 
    eventDate,
    eventTime,
    interviewId, 
    aiInsight, 
    interviewType,
    interviewNotes,
    candidateRating,
    pathway,
    finalInterviewStatus,
    googleEventId,
    previousPathway,
    includeReferenceForm,
  } = payload;
  


  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    let calendarAuthUrl: string | null = null;
    let calendarErrorMessage: string | null = null;
    let conferenceLink: string | undefined = undefined;
    let newGoogleEventId: string | undefined = undefined;

    // --- Timezone and Date Construction ---
    const pacificTimeZone = 'America/Los_Angeles';
    
    const dateTimeString = `${eventDate}T${eventTime}`; // e.g., "2024-12-08T14:00"
    const startTime = fromZonedTime(dateTimeString, pacificTimeZone);
    
    // --- Determine Event Duration and Title ---
    let durationHours: number;
    let eventTitle: string;

    if (interviewType === 'Orientation') {
        durationHours = 1.5;
        eventTitle = `Orientation: ${caregiverProfile.fullName}`;
    } else if (pathway === 'combined') {
        durationHours = 3;
        eventTitle = `Interview + Orientation: ${caregiverProfile.fullName}`;
    } else { // separate final interview
        durationHours = 1;
        eventTitle = `Final Interview: ${caregiverProfile.fullName}`;
    }
    
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";
    const logoHtml = `<img src="${logoUrl}" alt="FirstLight Home Care Logo" style="width: 200px; height: auto; margin-bottom: 20px;" /><br><br>`;


    // --- Calendar Integration ---
    if (clientId && clientSecret && refreshToken) {
      const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
      oAuth2Client.setCredentials({ refresh_token: refreshToken });

      try {
        await oAuth2Client.getAccessToken(); // Validate token
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        
        const eventRequestBody: any = {
            summary: eventTitle,
            start: { dateTime: startTime.toISOString(), timeZone: pacificTimeZone },
            end: { dateTime: endTime.toISOString(), timeZone: pacificTimeZone },
            attendees: [{ email: 'care-rc@firstlighthomecare.com' }, { email: caregiverProfile.email }],
            reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 120 }] },
        };
        
        if (interviewType === 'Google Meet') {
          eventRequestBody.location = 'Google Meet';
          eventRequestBody.description = `${logoHtml}This is a confirmation for your video interview with FirstLight Homecare. Please join using the Google Meet link.`;
          eventRequestBody.conferenceData = { createRequest: { requestId: `interview-${interviewId}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
        } else {
          eventRequestBody.location = '9650 Business Center Drive, Suite #132, Bldg #17, Rancho Cucamonga, CA 92730, PH: 909-321-4466';
          eventRequestBody.description = `${logoHtml}Dear ${caregiverProfile.fullName},\nPlease bring the following documents to in-person Interview with FirstLight Homecare:\n- Driver's License,\n- Car insurance and registration,\n- Social Security card or US passport (to prove your work eligibility, If you are green card holder, bring Green card.)\n- Current negative TB-Test Copy,\n- HCA letter or number,\n- Live scan or Clearance letter if you have it,\n If you have not registered, please register on this link: https://guardian.dss.ca.gov/Applicant/ \n- CPR-First Aide proof card, Any other certification that you have.`;
        }

        let createdEvent;
        
        const pathwayChanged = previousPathway && previousPathway !== pathway;
        if (googleEventId && interviewType !== 'Orientation' && !pathwayChanged) {
            createdEvent = await calendar.events.update({
                calendarId: 'primary',
                eventId: googleEventId,
                requestBody: eventRequestBody,
                sendUpdates: 'all',
            });
        } else {
            createdEvent = await calendar.events.insert({ 
                calendarId: 'primary', 
                requestBody: eventRequestBody, 
                sendNotifications: true,
                conferenceDataVersion: 1,
            });
        }
        
        conferenceLink = createdEvent.data.hangoutLink || undefined;
        newGoogleEventId = createdEvent.data.id || undefined;

      } catch (calendarError: any) {
          console.error('Error sending calendar invite:', calendarError);
          calendarErrorMessage = `Failed to create/update calendar event: ${calendarError.message}`;
      }
    } else {
      calendarErrorMessage = "Calendar integration is not fully configured (missing client ID, secret, or refresh token).";
    }

    // --- Firestore Update ---
    const interviewRef = serverDb.collection('interviews').doc(interviewId);
    
    const updateData: { [key: string]: any } = {
        interviewNotes,
        candidateRating,
        phoneScreenPassed: "Yes",
        aiGeneratedInsight: aiInsight || '',
        interviewPathway: pathway,
    };

    if (newGoogleEventId) {
        updateData.googleEventId = newGoogleEventId;
    }

    if (interviewType === 'Orientation') {
        updateData.orientationScheduled = true;
        updateData.orientationDateTime = Timestamp.fromDate(startTime);
    } else {
        updateData.interviewDateTime = Timestamp.fromDate(startTime);
        updateData.interviewType = interviewType;
        updateData.googleMeetLink = conferenceLink || null;
        updateData.finalInterviewStatus = finalInterviewStatus || (pathway === 'combined' ? 'Passed' : 'Pending');
        updateData.orientationScheduled = pathway === 'combined';
        if (pathway === 'combined') {
            updateData.orientationDateTime = Timestamp.fromDate(startTime);
        }
    }
    
    if (includeReferenceForm) {
      updateData.finalInterviewStatus = 'Pending reference checks';
    }


    await interviewRef.update(updateData);

    // --- Confirmation Email ---

    const formattedDate = formatInTimeZone(startTime, pacificTimeZone, 'eeee, MMMM do');
    const formattedStartTime = formatInTimeZone(startTime, pacificTimeZone, 'h:mm a zzz');
    const formattedEndTime = formatInTimeZone(endTime, pacificTimeZone, 'h:mm a zzz');

    let emailHtml = '';
    const inPersonDuration = (interviewType === 'Orientation') ? 1.5 : (pathway === 'combined' ? 3 : 1);

    let referenceFormHtml = '';
    if (includeReferenceForm) {
      const referenceFormUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/hiring-reference%2FReferenceVerification.pdf?alt=media&token=c1c21387-45c1-4391-9aa9-3fd043b83de7";
      referenceFormHtml = `
        <hr>
        <p><strong>REFERENCE FORM:</strong><br>
        Here is a <a href="${referenceFormUrl}">reference form</a> to be completed and returned to me as soon as possible. Please complete at least 2 forms. Rate yourself and please make sure to sign and date the form. Upon receipt I will begin your employment verifications.
        </p>
      `;
    }

    const detailedInPersonEmail = `
        <p>${caregiverProfile.fullName},</p>
        <p>This is to confirm your in-person ${inPersonDuration} hour ${interviewType === 'Orientation' ? 'orientation' : 'interview'} for a HCA/Caregiver position. Pls accept the calendar invite from FirstLightHomeCare Office Administrator.</p>
        <p>Please call or text the office if you have questions, or need to cancel or reschedule your appointment.</p>
        ${referenceFormHtml}
        <br>
        <p><strong>Office address:</strong><br>
        FirstLight Home Care<br>
        9650 Business Center Drive, (South West corner of Archibald and Arrow)<br>
        Bld # 17, Suite #132 (Executive Suites sign out front)<br>
        Rancho Cucamonga, CA 91730<br>
        PH: 909-321-4466</p>
        <br>
        <p><strong>PLEASE BRING THE FOLLOWING DOCUMENTS</strong><br>
        (Bring what you can, you can text the remainder later.)</p>
        <ul>
            <li>Resume</li>
            <li>Driver’s License or State ID</li>
            <li>Car insurance and registration</li>
            <li>Social Security card or US passport (to prove your work eligibility, if you are green card holder, bring Green card,)</li>
            <li>Current negative TB-Test Copy</li>
            <li>HCA letter, number, or Credit Card so during your interview, we can apply and pay $35 fee to guardian.</li>
            <li>Live scan or Clearance letter if you have it,</li>
            <li>If you have not registered, please register on this link: https://guardian.dss.ca.gov/Applicant/ </li>
            <li>CPR-First Aide proof card, Any other certification that you have.</li>
        </ul>
        <p><strong>NEW OR RENEWAL OF HCA AND LIVE SCAN PRINTS</strong></p>
        <ol>
            <li><strong>Access the Guardian Applicant Portal:</strong> Please visit <a href="https://guardian.dss.ca.gov/Applicant">https://guardian.dss.ca.gov/Applicant</a></li>
            <li><strong>Create an Account:</strong> If you have not created an account before, please click “Register as a new user.” (Once hired we will request that you be assigned to FLHC.)</li>
            <li><strong>Login:</strong> Your username is your email address. A temporary password was sent to the email account you used to register.</li>
            <li><strong>Enter Application Information:</strong> Complete the application and enter the Agency Pin: <strong>R38XKSPE</strong> (the PIN for independent home care aides) when prompted. You will be required to pay a fee of $35.00 to register; payment can be made by debit or credit card. You will receive a confirmation number when the fee is paid and the application is complete.</li>
            <li>You will be prompted to print the live scan form. It will prefill the Live Scan form with your information and Per ID number. Take this form with you when you do the Live Scan Fingerprints - see locations with discounted costs below.</li>
        </ol>
        <p><strong>NOTE:</strong> If you have done Live Scan prints in the past, call Home Care Services Bureau 877-424-5778 to see if they have your live scan prints on file and can align them to your HCA registration. Then you do not have to do them again.</p>
        <p><strong>NOTE:</strong> You MUST first submit the application in Guardian, so Guardian will generate the live scan form. Then the application and fingerprints will be linked together for processing and approval. If that was not done in that order, then you will need to contact Guardian @ 888-422-5669.</p>
        <p>If applicable, await Agency confirmation.</p>
        <p>For questions regarding this notice, please visit <a href="https://www.guardian.ca.gov">https://www.guardian.ca.gov</a> or contact CBCB at 1-888-422-5669.</p>
        <p>Home care aide (HCA) is provided by the Department of Social Services, Home Care Services Bureau.</p>
        <hr>
        <p><strong>LOCATIONS: TB TEST, LIVE SCAN, CPR</strong></p>
        <p><strong>TB Test Location:</strong> Rancho San Antonio Medical Plaza Urgent Care<br>
        909.948.8100<br>
        7777 Milliken Ave., Rancho Cucamonga, CA. 91730<br>
        Walk-ins accepted<br>
        $30</p>
        <p><strong>LIVE SCAN FINGER PRINTS - Take form you printed from your HCA application</strong></p>
        <p>Rancho Cucamonga Police Dept (make appointment)<br>
        10510 Civic Center Dr, Rancho Cucamonga, CA 91730<br>
        (909) 477-2800 $42 -59</p>
        <p>357 W 2nd St Suite7, San Bernardino, CA 92401<br>
        (909) 885-2100<br>
        $66 - $77.50 Lisa</p>
        <p>Postal Perfect (for Livescan)<br>
        10808 Foothill Blvd. Suite #160<br>
        Rancho Cucamonga, CA 91730<br>
        (909) 484-1474<br>
        $64<br>
        9-5:30pm</p>
        <p><strong>CPR</strong><br>
        American Heart Association or Red Cross</p>
        <p><strong>LINKS FOR FREE OR REDUCED COST - TB TEST OR PHYSICAL:</strong></p>
        <p><a href="https://www.freeclinics.com/cit/ca-san_bernardino">https://www.freeclinics.com/cit/ca-san_bernardino</a><br>
        <a href="https://www.freeclinics.com/cit/ca-fontana">https://www.freeclinics.com/cit/ca-fontana</a><br>
        <a href="https://www.freeclinics.com/cit/ca-pomona">https://www.freeclinics.com/cit/ca-pomona</a><br>
        <a href="https://www.freeclinics.com/cit/ca-ontario">https://www.freeclinics.com/cit/ca-ontario</a></p>
        <br>
        <p>I look forward to meeting you in person.</p>
        <p>--<br>
        Jacqui Wilson<br>
        Care Coordinator<br>
        Office (909)-321-4466<br>
        Fax (909)-694-2474</p>
        <p>CALIFORNIA HCO LICENSE # 364700059</p>
        <p>9650 Business Center Drive, Suite #132 | Rancho Cucamonga, CA 91730</p>
        <p><a href="mailto:care-rc@firstlighthomecare.com">care-rc@firstlighthomecare.com</a><br>
        <a href="http://ranchocucamonga.firstlighthomecare.com">ranchocucamonga.firstlighthomecare.com</a></p>
        <p><a href="https://www.facebook.com/FirstLightHomeCareofRanchoCucamonga">https://www.facebook.com/FirstLightHomeCareofRanchoCucamonga</a></p>
        <br>
        <img src="${logoUrl}" alt="FirstLight Home Care Logo" style="width: 200px; height: auto;"/>
        <br>
        <p><small><strong>CONFIDENTIALITY NOTICE</strong><br>
        This email, including any attachments or files transmitted with it, is intended to be confidential and solely for the use of the individual or entity to whom it is addressed. If you received it in error, or if you are not the intended recipient(s), please notify the sender by reply e-mail and delete/destroy the original message and any attachments, and any copies. Any unauthorized review, use, disclosure or distribution of this e-mail or information is prohibited and may be a violation of applicable laws.</small></p>
    `;

    if (interviewType === 'Google Meet') {
        emailHtml = `${logoHtml}<p>${caregiverProfile.fullName},</p><p>This is to confirm your video interview session on ${formattedDate} at ${formattedStartTime}.</p><p><strong>Meeting Link:</strong><br><a href="${conferenceLink || '#'}">${conferenceLink || 'Meeting link will be in calendar invite.'}</a></p><p>Thank you,</p><p>FirstLight Home Care</p>`;
    } else if (interviewType === 'In-Person' || interviewType === 'Orientation') {
        emailHtml = detailedInPersonEmail;
    } else {
        emailHtml = `${logoHtml}<p>Your appointment with FirstLight Home Care on ${formattedDate} at ${formattedStartTime} is confirmed.</p>`;
    }


    const confirmationEmail = {
        to: [caregiverProfile.email],
        cc: ['care-rc@firstlighthomecare.com'],
        message: {
            subject: `Confirmation: ${eventTitle} with FirstLight Home Care`,
            html: emailHtml,
        },
    };
    await serverDb.collection("mail").add(confirmationEmail);
    
    revalidatePath('/admin/manage-interviews');
    
    if (calendarErrorMessage) {
        return { message: `Interview details saved and email sent, but calendar invite failed: ${calendarErrorMessage}`, error: true, authUrl: calendarAuthUrl };
    }
    
    return { message: `Next event scheduled and all notifications sent.` };

  } catch (error: any) {
    console.error("Critical error in saveInterviewAndSchedule:", error);
    return { message: `A critical server error occurred: ${error.message}`, error: true };
  }
}

export async function rejectCandidateAfterOrientation(payload: { interviewId: string, reason: string, notes: string, caregiverName: string, caregiverEmail: string }) {
    const { interviewId, reason, notes, caregiverName, caregiverEmail } = payload;
    if (!interviewId || !reason || !caregiverName || !caregiverEmail) {
        return { error: true, message: "Interview ID, reason, and caregiver details are required." };
    }
    
    try {
        const firestore = serverDb;
        const interviewRef = firestore.collection('interviews').doc(interviewId);
        await interviewRef.update({
            finalInterviewStatus: 'Rejected at Orientation',
            rejectionReason: reason,
            rejectionNotes: notes,
            rejectionDate: Timestamp.now(),
        });
        
        const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

        // Construct and send the rejection email
        const rejectionEmailHtml = `
            <p>${caregiverName},</p>
            <p>After careful consideration, we’ve decided not to move forward with your application at this time. This decision was made based on how each candidate aligned with the key qualifications and needs of the role.</p>
            <p>Best wishes on your employment search.</p>
            <p>--<br>
            Jacqui Wilson<br>
            Care Coordinator<br>
            Office (909)-321-4466<br>
            Fax (909)-694-2474</p>
            <p>CALIFORNIA HCO LICENSE # 364700059</p>
            <p>9650 Business Center Drive, Suite #132 | Rancho Cucamonga, CA 91730</p>
            <p><a href="mailto:care-rc@firstlighthomecare.com">care-rc@firstlighthomecare.com</a><br>
            <a href="http://ranchocucamonga.firstlighthomecare.com">ranchocucamonga.firstlighthomecare.com</a></p>
            <p><a href="https://www.facebook.com/FirstLightHomeCareofRanchoCucamonga">https://www.facebook.com/FirstLightHomeCareofRanchoCucamonga</a></p>
            <br>
            <img src="${logoUrl}" alt="FirstLight Home Care Logo" style="width: 200px; height: auto;"/>
            <br><br>
            <p><small><strong>CONFIDENTIALITY NOTICE</strong><br>
            This email, including any attachments or files transmitted with it, is intended to be confidential and solely for the use of the individual or entity to whom it is addressed. If you received it in error, or if you are not the intended recipient(s), please notify the sender by reply e-mail and delete/destroy the original message and any attachments, and any copies. Any unauthorized review, use, disclosure or distribution of this e-mail or information is prohibited and may be a violation of applicable laws.</small></p>
        `;

        await firestore.collection("mail").add({
            to: [caregiverEmail],
            cc: ['care-rc@firstlighthomecare.com'],
            message: {
                subject: `Update on Your Application with FirstLight Home Care`,
                html: `<body style="font-family: sans-serif;">${rejectionEmailHtml}</body>`,
            }
        });

        revalidatePath('/admin/manage-interviews');
        return { success: true, message: 'Candidate has been marked as rejected and an email has been sent.' };

    } catch (error: any) {
        console.error("Error rejecting candidate:", error);
        return { error: true, message: `An error occurred: ${error.message}` };
    }
}
    

    


    










    


