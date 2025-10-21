
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

  try {
    const caregiversRef = serverDb.collection('caregivers_active');
    const query = caregiversRef
      .where('Email', '==', normalizedEmail)
      .where('status', '==', 'ACTIVE')
      .limit(1);

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`[Login Action] No active caregiver found for email: ${normalizedEmail}`);
      return { error: "Invalid credentials or inactive account." };
    }

    const caregiverDoc = snapshot.docs[0];
    const caregiverData = caregiverDoc.data();

    // Ensure the PIN field exists and compare as strings to avoid type issues.
    const storedPin = caregiverData['TTiD-PIN'];
    if (storedPin === undefined || String(storedPin).trim() !== String(pin).trim()) {
        console.log(`[Login Action] PIN mismatch for ${normalizedEmail}. Stored: '${storedPin}', Provided: '${pin}'`);
        return { error: "Invalid credentials or inactive account." };
    }
    
    const uid = caregiverDoc.id;
    const displayName = caregiverData['Name'];

    // Update or create the user in Firebase Auth
    try {
        await serverAuth.updateUser(uid, {
            email: normalizedEmail,
            displayName: displayName,
        });
        console.log(`[Login Action] Updated Firebase Auth user for UID: ${uid}`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            await serverAuth.createUser({
                uid: uid,
                email: normalizedEmail,
                displayName: displayName,
            });
            console.log(`[Login Action] Created new Firebase Auth user for UID: ${uid}`);
        } else {
            // Re-throw other auth errors to be caught by the outer catch block
            throw error;
        }
    }

    // Create a custom token for the client to sign in with
    const customToken = await serverAuth.createCustomToken(uid);
    console.log(`[Login Action] Successfully generated custom token for UID: ${uid}`);

    return { token: customToken };

  } catch (error: any) {
    console.error("[Login Action] Error in loginActiveCaregiver action:", error);
    // Return the specific error message for debugging
    return { error: `An unexpected server error occurred: ${error.message}` };
  }
}
