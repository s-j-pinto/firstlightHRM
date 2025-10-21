
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
      .where('status', '==', 'ACTIVE')
      .limit(1);

    console.log(`[Login Action] Querying Firestore for active caregiver.`);
    const snapshot = await query.get();
    console.log(`[Login Action] Firestore query completed. Found ${snapshot.size} documents.`);

    if (snapshot.empty) {
      console.log(`[Login Action] No active caregiver found for email: ${normalizedEmail}`);
      return { error: "Invalid credentials or inactive account." };
    }

    const caregiverDoc = snapshot.docs[0];
    const caregiverData = caregiverDoc.data();

    // Ensure the PIN field exists and compare as strings to avoid type issues.
    const storedPin = caregiverData['TTiD-PIN'];
    if (storedPin === undefined || String(storedPin).trim() !== String(pin).trim()) {
        console.warn(`[Login Action] PIN mismatch for ${normalizedEmail}. Stored PIN is present: ${storedPin !== undefined}`);
        return { error: "Invalid credentials or inactive account." };
    }
    
    const uid = caregiverDoc.id;
    const displayName = caregiverData['Name'];
    console.log(`[Login Action] Credentials verified for UID: ${uid}. DisplayName: ${displayName}`);

    // Update or create the user in Firebase Auth
    try {
        console.log(`[Login Action] Updating Firebase Auth user for UID: ${uid}`);
        await serverAuth.updateUser(uid, {
            email: normalizedEmail,
            displayName: displayName,
        });
        console.log(`[Login Action] Successfully updated Auth user.`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.log(`[Login Action] Auth user not found. Creating new user for UID: ${uid}`);
            await serverAuth.createUser({
                uid: uid,
                email: normalizedEmail,
                displayName: displayName,
            });
            console.log(`[Login Action] Successfully created new Auth user.`);
        } else {
            // Re-throw other auth errors to be caught by the outer catch block
            console.error(`[Login Action] Error updating/creating Auth user:`, error);
            throw error;
        }
    }

    // Create a custom token for the client to sign in with
    console.log(`[Login Action] Creating custom token for UID: ${uid}`);
    const customToken = await serverAuth.createCustomToken(uid);
    console.log(`[Login Action] Successfully generated custom token.`);

    return { token: customToken };

  } catch (error: any) {
    console.error("[Login Action] Error in loginActiveCaregiver action:", error);
    // Return the specific error message for debugging
    return { error: `An unexpected server error occurred: ${error.message}` };
  }
}
