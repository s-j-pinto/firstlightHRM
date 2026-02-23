
"use server";

import { serverAuth, serverDb } from "@/firebase/server-init";

export async function loginCandidate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const profilesRef = serverDb.collection('caregiver_profiles');
    const query = profilesRef.where('email', '==', normalizedEmail).limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      return { error: "No application found with that email address." };
    }

    const profileDoc = snapshot.docs[0];
    const profileData = profileDoc.data();
    
    const phoneLastFour = (profileData.phone || '').slice(-4);

    if (phoneLastFour !== password) {
      return { error: "Invalid password. Please use the last 4 digits of your phone number." };
    }
    
    const uid = profileDoc.id;
    const displayName = profileData.fullName;
    
    try {
        // More robust auth user creation/verification
        const userRecord = await serverAuth.getUserByEmail(normalizedEmail).catch(() => null);

        if (userRecord) {
            // User with this email exists. Ensure it's the correct user.
            if (userRecord.uid !== uid) {
                // This is a critical state error. An auth user exists with this email but a different UID.
                console.error(`[Candidate Login] Auth conflict for ${normalizedEmail}. UID in Auth: ${userRecord.uid}, expected UID from profile: ${uid}`);
                return { error: "An account conflict exists for this email. Please contact support." };
            }
            // User exists with correct UID, ensure display name is up to date.
            if (userRecord.displayName !== displayName) {
                await serverAuth.updateUser(uid, { displayName });
            }
        } else {
            // No user with this email exists. Create one with the correct UID.
            await serverAuth.createUser({
                uid: uid,
                email: normalizedEmail,
                displayName: displayName,
            });
        }
        
        // If we've reached here, a user with the correct UID exists.
        const customToken = await serverAuth.createCustomToken(uid);
        return { token: customToken };

    } catch (authError: any) {
        console.error("[Candidate Login] Firebase Auth operation failed:", authError);
        return { error: `A server authentication error occurred: ${authError.code}` };
    }

  } catch (error: any) {
    console.error('[Candidate Login] A critical error occurred:', error);
    return { error: 'A server error occurred. Please try again later.' };
  }
}
