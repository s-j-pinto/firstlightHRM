
"use server";

import { serverAuth, serverDb } from "@/firebase/server-init";

export async function loginCandidate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const profilesRef = serverDb.collection('caregiver_profiles');
    // Reverted to a direct query now that the index is deployed.
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
        // This pattern ensures a user exists in Firebase Auth.
        // It attempts to update, and if the user doesn't exist, it creates one.
        await serverAuth.updateUser(uid, {
            email: normalizedEmail,
            displayName: displayName,
        }).catch(async (error: any) => {
            if (error.code === 'auth/user-not-found') {
                await serverAuth.createUser({
                    uid: uid,
                    email: normalizedEmail,
                    displayName: displayName,
                });
            } else {
                // For other errors (e.g., email already exists with another UID), re-throw.
                throw error;
            }
        });

        const customToken = await serverAuth.createCustomToken(uid);
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
