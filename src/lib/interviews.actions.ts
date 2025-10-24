
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import type { CaregiverProfile } from './types';
import { Timestamp } from 'firebase-admin/firestore';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

interface SaveInterviewPayload {
  caregiverProfile: CaregiverProfile;
  eventDateTime: Date;
  interviewId: string;
  aiInsight: string | null;
  interviewType: 'In-Person' | 'Google Meet' | 'Orientation';
  interviewNotes: string;
  candidateRating: number;
  pathway: 'separate' | 'combined';
  finalInterviewStatus?: 'Passed' | 'Failed' | 'Pending';
}

export async function saveInterviewAndSchedule(payload: SaveInterviewPayload) {
  const { 
    caregiverProfile, 
    eventDateTime, 
    interviewId, 
    aiInsight, 
    interviewType,
    interviewNotes,
    candidateRating,
    pathway,
    finalInterviewStatus
  } = payload;
  
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:9002/admin/settings';

    let calendarAuthUrl: string | null = null;
    let calendarErrorMessage: string | null = null;
    let conferenceLink: string | undefined = undefined;

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
    
    const startTime = eventDateTime;
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);

    // --- Calendar Integration ---
    if (clientId && clientSecret && refreshToken) {
      const oAuth2Client = new OAuth2Client(clientId, clientSecret, redirectUri);
      oAuth2Client.setCredentials({ refresh_token: refreshToken });

      try {
        await oAuth2Client.getAccessToken(); // Validate token
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        
        const eventRequestBody: any = {
            summary: eventTitle,
            start: { dateTime: startTime.toISOString(), timeZone: 'America/Los_Angeles' },
            end: { dateTime: endTime.toISOString(), timeZone: 'America/Los_Angeles' },
            attendees: [{ email: 'care-rc@firstlighthomecare.com' }, { email: caregiverProfile.email }],
            reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 24 * 60 }, { method: 'popup', minutes: 120 }] },
        };
        
        if (interviewType === 'Google Meet') {
          eventRequestBody.location = 'Google Meet';
          eventRequestBody.description = `This is a confirmation for your video interview. Please join using the Google Meet link.`;
          eventRequestBody.conferenceData = { createRequest: { requestId: `interview-${interviewId}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } };
        } else {
          eventRequestBody.location = '9650 Business Center Drive, Suite #132, Bldg #17, Rancho Cucamonga, CA 92730, PH: 909-321-4466';
          eventRequestBody.description = `Dear ${caregiverProfile.fullName},\nPlease bring the following documents to in-person Interview:\n- Driver's License,\n- Car insurance and registration,\n- Social Security card or US passport (to prove your work eligibility, If you are green card holder, bring Green card.)\n- Current negative TB-Test Copy,\n- HCA letter or number,\n- Live scan or Clearance letter if you have it,\n If you have not registered, please register on this link: https://guardian.dss.ca.gov/Applicant/ \n- CPR-First Aide proof card, Any other certification that you have.`;
        }

        const createdEvent = await calendar.events.insert({ 
            calendarId: 'primary', 
            requestBody: eventRequestBody, 
            sendNotifications: true,
            conferenceDataVersion: 1,
        });
        conferenceLink = createdEvent.data.hangoutLink;
      } catch (calendarError: any) {
          console.error('Error sending calendar invite:', calendarError);
          // Don't crash, just log and set an error message to return
          calendarErrorMessage = `Failed to create calendar event: ${calendarError.message}`;
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

    if (interviewType === 'Orientation') {
        updateData.orientationScheduled = true;
        updateData.orientationDateTime = Timestamp.fromDate(eventDateTime);
    } else {
        updateData.interviewDateTime = Timestamp.fromDate(eventDateTime);
        updateData.interviewType = interviewType;
        updateData.googleMeetLink = conferenceLink || null;
        updateData.finalInterviewStatus = finalInterviewStatus || (pathway === 'combined' ? 'Passed' : 'Pending');
        updateData.orientationScheduled = pathway === 'combined';
        if (pathway === 'combined') {
            updateData.orientationDateTime = Timestamp.fromDate(eventDateTime);
        }
    }


    await interviewRef.update(updateData);

    // --- Confirmation Email ---
    const pacificTimeZone = 'America/Los_Angeles';
    const zonedStartTime = toZonedTime(startTime, pacificTimeZone);
    const zonedEndTime = toZonedTime(endTime, pacificTimeZone);
    const logoUrl = "https://firebasestorage.googleapis.com/v0/b/firstlighthomecare-hrm.firebasestorage.app/o/FirstlightLogo_transparent.png?alt=media&token=9d4d3205-17ec-4bb5-a7cc-571a47db9fcc";

    const formattedDate = formatInTimeZone(zonedStartTime, pacificTimeZone, 'eeee, MMMM do');
    const formattedStartTime = formatInTimeZone(zonedStartTime, pacificTimeZone, 'h:mm a');
    const formattedEndTime = formatInTimeZone(zonedEndTime, pacificTimeZone, 'h:mm a');

    let emailHtml = '';
    const inPersonDuration = interviewType === 'Orientation' ? 1.5 : 3;

    if (interviewType === 'Google Meet') {
        emailHtml = `<p>${caregiverProfile.fullName},</p><p>This is to confirm your video interview session on ${formattedDate} at ${formattedStartTime}.</p><p><strong>Meeting Link:</strong><br><a href="${conferenceLink || '#'}">${conferenceLink || 'Meeting link will be in calendar invite.'}</a></p><p>Thank you,</p><p>FirstLight Home Care</p>`;
    } else {
        // Use the detailed template for In-Person meetings (Combined or Orientation)
        emailHtml = `
            <p>${caregiverProfile.fullName},</p>
            <p>This is to confirm your in-person ${inPersonDuration} hour interview for a HCA/Caregiver position on ${formattedDate} @ ${formattedStartTime} to ${formattedEndTime}.</p>
            <p>Please call or text the office if you have questions, or need to cancel or reschedule your appointment.</p>
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
                <li>HCA letter, number, or Credit Card so during your interview, we can apply and pay $35 fee to guardian.</li>
                <li>Covid Vaccine and Booster card or exemption letter</li>
                <li>Current TB-Test or Chest X-Ray documentation</li>
                <li>Employment history with dates and contact numbers.</li>
                <li>DMV Driver’s Record Request Report. You can get a Driver’s Record Request online: <a href="https://www.dmv.ca.gov/portal">https://www.dmv.ca.gov/portal</a> $2 online or $5 at DMV office.</li>
                <li>Physical Test (HHA only)</li>
                <li>Optional: CPR-First Aid proof card (The Heart Association or American Red Cross have classes)</li>
                <li>Optional: any other health related certifications you may have.</li>
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
    
    // --- Final Response ---
    if (calendarErrorMessage) {
        return { message: `Interview details saved and email sent, but calendar invite failed: ${calendarErrorMessage}`, error: true, authUrl: calendarAuthUrl };
    }
    
    return { message: `Next event scheduled and all notifications sent.` };

  } catch (error: any) {
    console.error("Critical error in saveInterviewAndSchedule:", error);
    return { message: `A critical server error occurred: ${error.message}`, error: true };
  }
}

    