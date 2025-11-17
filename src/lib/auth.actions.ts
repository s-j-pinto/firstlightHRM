
"use server";

import { serverAuth, serverDb } from "@/firebase/server-init";

/**
 * Verifies an active caregiver's credentials and returns a custom Firebase auth token.
 * @param email - The caregiver's email.
 * @param pin - The caregiver's TTiD-PIN.
 * @returns An object with a custom token or an error message.
 */
export async function loginActiveCaregiver(email: string, pin: string) {
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[Login Action] Attempting login for email: ${normalizedEmail}`);

  try {
    const caregiversRef = serverDb.collection('caregivers_active');
    const query = caregiversRef
      .where('Email', '==', normalizedEmail)
      .where('status', '==', 'Active')
      .limit(1);

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`[Login Action] No active caregiver found for email: ${normalizedEmail}`);
      return { error: "Invalid credentials or inactive account." };
    }

    const caregiverDoc = snapshot.docs[0];
    const caregiverData = caregiverDoc.data();
    const storedPin = caregiverData['TTiD-PIN'];

    if (storedPin === undefined || String(storedPin).trim() !== String(pin).trim()) {
        console.warn(`[Login Action] PIN mismatch for ${normalizedEmail}.`);
        return { error: "Invalid credentials or inactive account." };
    }
    
    const uid = caregiverDoc.id;
    const displayName = caregiverData['Name'];
    
    // --- Resilient Firebase Auth Interaction Block ---
    // This entire block attempts to sync the user and create a token.
    // If any part fails due to permissions, it will be caught and a
    // specific error will be returned instead of crashing the server.
    try {
        console.log(`[Login Action] Attempting to update or create Firebase Auth user for UID: ${uid}`);
        await serverAuth.updateUser(uid, {
            email: normalizedEmail,
            displayName: displayName,
        }).catch(async (error: any) => {
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
                throw error;
            }
        });

        console.log(`[Login Action] Creating custom token for UID: ${uid}`);
        const customToken = await serverAuth.createCustomToken(uid);
        console.log(`[Login Action] Successfully generated custom token.`);
        return { token: customToken };

    } catch (authError: any) {
        console.error("[Login Action] A critical error occurred during Firebase Auth operations:", authError);
        
        // This is the error message seen in production.
        const isPermissionError = authError.message?.includes('Caller does not have required permission');
        
        if (isPermissionError) {
             return { 
                error: `A server permission error occurred. The backend service is missing the required IAM role ("Service Usage Consumer") to interact with Firebase Authentication. Please check the Google Cloud console.` 
            };
        }
        
        // Return a generic but informative error for other auth issues.
        return { error: `An unexpected server authentication error occurred: ${authError.message}` };
    }
    // --- End of Resilient Block ---

  } catch (error: any) {
    console.error("[Login Action] A critical, unexpected error occurred in loginActiveCaregiver:", error);
    return { error: `A critical server error occurred. Please check the server logs.` };
  }
}
