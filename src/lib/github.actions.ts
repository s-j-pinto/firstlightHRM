'use server';

import { format, isDate } from 'date-fns';

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
  dob?: Date | string | { seconds: number; nanoseconds: number };
  ssn?: string;
  hireDate?: Date | string;
}

const safeToDate = (value: any): Date | null => {
    if (!value) return null;

    // Handle server-side Firestore Timestamps with a toDate method
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }

    // Handle client-side serialized Firestore Timestamps (plain objects)
    if (typeof value === 'object' && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
        return new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
    }

    // Handle standard Date objects
    if (isDate(value)) {
        return value;
    }
    
    // Handle ISO date strings and other string formats that new Date() can parse, including the custom "$D" prefix
    if (typeof value === 'string') {
        const cleanValue = value.startsWith('$D') ? value.substring(2) : value;
        const d = new Date(cleanValue);
        if (!isNaN(d.getTime())) {
            return d;
        }
    }
    
    // Fallback attempt for any other format
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }

    return null;
};


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
  const dob = caregiver.dob ? safeToDate(caregiver.dob) : null;
  const formattedDob = dob ? format(dob, 'MM/dd/yyyy') : '';
  const hireDate = caregiver.hireDate ? safeToDate(caregiver.hireDate) : null;
  const formattedHireDate = hireDate ? format(hireDate, 'MM/dd/yyyy') : '';


  // This payload matches the `inputs` of the `workflow_dispatch` trigger.
  const payload = {
    ref: 'main', // Assuming 'main' is the default branch for the workflow
    inputs: {
      firstName: firstName,
      lastName: lastName,
      address: caregiver.address || '',
      city: caregiver.city || '',
      state: caregiver.state || '',
      dateOfBirth: formattedDob,
      hireDate: formattedHireDate,
      zipCode: caregiver.zip || '',
      phoneNumber: caregiver.phone || '',
      driversLicenseNo: caregiver.driversLicenseNumber || '',
      email: caregiver.email || '',
      gpsAppUserName: caregiver.email || '',
      ttId: teletrackPin || '',
      ssn: caregiver.ssn || '',
    }
  };
  
  console.log("Data sent to Teletrack:", payload.inputs);
  
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
