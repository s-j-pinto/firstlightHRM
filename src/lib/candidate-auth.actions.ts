
"use server";

import { serverAuth, serverDb } from "@/firebase/server-init";

export async function loginCandidate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[Login Action] Attempting login for email: ${normalizedEmail}`);

  try {
    const profilesRef = serverDb.collection('caregiver_profiles');
    const query = profilesRef.where('email', '==', normalizedEmail).limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`[Login Action] Firestore Query: No caregiver_profiles document found for email: ${normalizedEmail}`);
      return { error: "No application found with that email address." };
    }
    
    console.log(`[Login Action] Firestore Query: Found a matching profile for ${normalizedEmail}.`);

    const profileDoc = snapshot.docs[0];
    const profileData = profileDoc.data();
    
    const phoneLastFour = (profileData.phone || '').slice(-4);

    if (phoneLastFour !== password) {
      console.warn(`[Login Action] Password check FAILED for ${normalizedEmail}. Provided password (last 4): ${password}, Expected (from phone): ${phoneLastFour}`);
      return { error: "Invalid password. Please use the last 4 digits of your phone number." };
    }
    
    console.log(`[Login Action] Password check PASSED for ${normalizedEmail}.`);

    const uid = profileDoc.id;
    const displayName = profileData.fullName;
    console.log(`[Login Action] Using UID: ${uid} and DisplayName: ${displayName} for Firebase Auth operations.`);

    try {
        console.log(`[Login Action] Attempting to update or create Firebase Auth user for UID: ${uid}`);
        await serverAuth.updateUser(uid, {
            email: normalizedEmail,
            displayName: displayName,
        }).catch(async (error: any) => {
            console.log(`[Login Action] 'updateUser' failed with code: ${error.code}. Checking if user needs to be created.`);
            if (error.code === 'auth/user-not-found') {
                console.log(`[Login Action] Auth user not found. Creating new user for UID: ${uid}`);
                await serverAuth.createUser({
                    uid: uid,
                    email: normalizedEmail,
                    displayName: displayName,
                });
                console.log(`[Login Action] Successfully created new Auth user.`);
            } else {
                // Re-throw other errors to be caught by the outer block.
                console.error(`[Login Action] 'updateUser' threw an unexpected error:`, error);
                throw error;
            }
        });

        console.log(`[Login Action] Creating custom token for UID: ${uid}`);
        const customToken = await serverAuth.createCustomToken(uid);
        console.log(`[Login Action] Successfully generated custom token.`);
        return { token: customToken };

    } catch (authError: any) {
        console.error("[Login Action] A critical error occurred during Firebase Auth operations:", authError);
        
        const isPermissionError = authError.message?.includes('Caller does not have required permission');
        
        if (isPermissionError) {
             return { 
                error: `A server permission error occurred. The backend service is missing the required IAM role ("Service Usage Consumer") to interact with Firebase Authentication. Please check the Google Cloud console.` 
            };
        }
        
        return { error: `An unexpected server authentication error occurred: ${authError.message}` };
    }

  } catch (error: any) {
    console.error('[Login Action] A critical, unexpected error occurred in loginCandidate:', error);
    return { error: 'A critical server error occurred. Please check the server logs.' };
  }
}
