'use server';

import { format, isDate, parse, isValid } from 'date-fns';

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
  dob?: any;
  ssn?: string;
  hireDate?: any;
  emergencyContact1_name?: string;
  emergencyContact1_relation?: string;
  emergencyContact1_phone?: string;
  emergencyContact1_address?: string;
  emergencyContact1_city?: string;
  emergencyContact1_state?: string;
  emergencyContact1_zip?: string;
  emergencyContact2_name?: string;
  emergencyContact2_relation?: string;
  emergencyContact2_phone?: string;
  emergencyContact2_address?: string;
  emergencyContact2_city?: string;
  emergencyContact2_state?: string;
  emergencyContact2_zip?: string;
}

const safeToDate = (value: any): Date | null => {
    if (!value) return null;

    // Handle server-side Firestore Timestamps with a toDate method
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }

    // Handle client-side serialized Firestore Timestamps (plain objects)
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }

    // Handle standard Date objects
    if (isDate(value)) {
        return value;
    }
    
    // Handle strings
    if (typeof value === 'string') {
        const cleanValue = value.startsWith('$D') ? value.substring(2) : value;
        
        // Try MM/DD/YYYY first as it's the app standard
        const parsedMMDD = parse(cleanValue, 'MM/dd/yyyy', new Date());
        if (isValid(parsedMMDD)) return parsedMMDD;

        // Fallback to standard JS parsing (ISO etc)
        const d = new Date(cleanValue);
        if (!isNaN(d.getTime())) {
            return d;
        }
    }
    
    return null;
};


export async function triggerTeletrackImport(caregiver: TeletrackApplicantPayload, teletrackPin: string) {
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GITHUB_TELETRACK_EXPIMP_API = process.env.GITHUB_TELETRACK_EXPIMP_API || "https://api.github.com/repos/s-j-pinto/teletrack-export/actions/workflows/import-applicant.yml/dispatches";

  if (!GITHUB_PAT || !GITHUB_TELETRACK_EXPIMP_API) {
    const missing = [];
    if (!GITHUB_PAT) missing.push('GITHUB_PAT');
    if (!GITHUB_TELETRACK_EXPIMP_API) missing.push('GITHUB_TELETRACK_EXPIMP_API');
    
    const errorMsg = `Configuration Error: Missing ${missing.join(' and ')} on the server. Please ensure these are set in Secret Manager and mapped in apphosting.yaml.`;
    console.error(`[GitHub Action Error] ${errorMsg}`);
    return { error: errorMsg };
  }

  const nameParts = caregiver.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  
  const dob = caregiver.dob ? safeToDate(caregiver.dob) : null;
  const formattedDob = dob ? format(dob, 'MM/dd/yyyy') : '';
  
  const hireDate = caregiver.hireDate ? safeToDate(caregiver.hireDate) : null;
  const formattedHireDate = hireDate ? format(hireDate, 'MM/dd/yyyy') : '';

  const emergencyContact1String = [
    caregiver.emergencyContact1_name || '',
    caregiver.emergencyContact1_address || '',
    caregiver.emergencyContact1_city || '',
    caregiver.emergencyContact1_state || '',
    caregiver.emergencyContact1_zip || '',
    caregiver.emergencyContact1_phone || '',
    caregiver.emergencyContact1_relation || '',
  ].join('|');

  const emergencyContact2String = [
    caregiver.emergencyContact2_name || '',
    caregiver.emergencyContact2_address || '',
    caregiver.emergencyContact2_city || '',
    caregiver.emergencyContact2_state || '',
    caregiver.emergencyContact2_zip || '',
    caregiver.emergencyContact2_phone || '',
    caregiver.emergencyContact2_relation || '',
  ].join('|');


  // This payload matches the `inputs` of the `workflow_dispatch` trigger.
  const payload = {
    ref: 'main', 
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
      emergencyContact1: emergencyContact1String,
      emergencyContact2: emergencyContact2String,
    }
  };
  
  console.log(`[GitHub Action] Triggering for ${caregiver.fullName} (PIN: ${teletrackPin})`);
  
  try {
    const response = await fetch(GITHUB_TELETRACK_EXPIMP_API, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_PAT}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'FirstLightHRM-App'
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
