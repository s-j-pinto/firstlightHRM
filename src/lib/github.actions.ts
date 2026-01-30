
'use server';

// The full CaregiverProfile type is not imported to avoid passing complex objects from client to server.
// import type { CaregiverProfile } from './types';

// A plain object interface for just the data needed by this action.
interface TeletrackApplicantPayload {
  fullName: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  driversLicenseNumber?: string;
  email?: string;
}

export async function triggerTeletrackImport(caregiver: TeletrackApplicantPayload, teletrackPin: string) {
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GITHUB_TELETRACK_EXPIMP_API = process.env.GITHUB_TELETRACK_EXPIMP_API;

  if (!GITHUB_PAT || !GITHUB_TELETRACK_EXPIMP_API) {
    const errorMsg = 'GitHub PAT or TeleTrack API URL is not configured on the server.';
    console.error(`[GitHub Action Error] ${errorMsg}`);
    return { error: errorMsg };
  }

  const nameParts = caregiver.fullName.split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

  // This payload matches the `inputs` of the `workflow_dispatch` trigger.
  const payload = {
    ref: 'main', // Assuming 'main' is the default branch for the workflow
    inputs: {
      firstName: firstName,
      lastName: lastName,
      address: caregiver.address || '',
      city: caregiver.city || '',
      state: caregiver.state || '',
      dateOfBirth: '', // This field is not collected in the application form
      zipCode: caregiver.zip || '',
      phoneNumber: caregiver.phone || '',
      driversLicenseNo: caregiver.driversLicenseNumber || '',
      email: caregiver.email || '',
      gpsAppUserName: caregiver.email || '',
      ttId: teletrackPin || '',
    }
  };

  try {
    const response = await fetch(GITHUB_TELETRACK_EXPIMP_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const errorMsg = `GitHub API request failed with status ${response.status}: ${errorBody}`;
      console.error(`[GitHub Action Error] ${errorMsg}`);
      return { error: errorMsg };
    }

    console.log('[GitHub Action] Successfully triggered TeleTrack new applicant import workflow.');
    return { success: true };

  } catch (error: any) {
    const errorMsg = `An error occurred while triggering the GitHub Action: ${error.message}`;
    console.error(`[GitHub Action Error] ${errorMsg}`);
    return { error: errorMsg };
  }
}
