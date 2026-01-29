'use server';

import type { CaregiverProfile } from './types';

interface TeletrackPayload {
  'First Name': string;
  'Last Name': string;
  'Address': string;
  'City': string;
  'State': string;
  'Zip Code': string;
  'Phone Number': string;
  'Driver\'s License No.': string;
  'Email': string;
  'GPS App User Name': string;
  'TT ID': string;
}

export async function triggerTeletrackImport(caregiver: CaregiverProfile, teletrackPin: string) {
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

  const payload: TeletrackPayload = {
    'First Name': firstName,
    'Last Name': lastName,
    'Address': caregiver.address || '',
    'City': caregiver.city || '',
    'State': caregiver.state || '',
    'Zip Code': caregiver.zip || '',
    'Phone Number': caregiver.phone || '',
    'Driver\'s License No.': caregiver.driversLicenseNumber || '',
    'Email': caregiver.email || '',
    'GPS App User Name': caregiver.email || '',
    'TT ID': teletrackPin || '',
  };

  try {
    const response = await fetch(GITHUB_TELETRACK_EXPIMP_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${GITHUB_PAT}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'teletrack-new-applicant-import',
        client_payload: payload,
      }),
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
