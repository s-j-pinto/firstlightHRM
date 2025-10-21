
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
      return { error: "Invalid credentials or inactive account." };
    }

    const caregiverDoc = snapshot.docs[0];
    const caregiverData = caregiverDoc.data();

    // Verify the PIN
    if (caregiverData['TTiD-PIN'] !== pin) {
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
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            await serverAuth.createUser({
                uid: uid,
                email: normalizedEmail,
                displayName: displayName,
            });
        } else {
            throw error; // Re-throw other errors
        }
    }

    // Create a custom token for the client to sign in with
    const customToken = await serverAuth.createCustomToken(uid);

    return { token: customToken };

  } catch (error: any) {
    console.error("Error in loginActiveCaregiver action:", error);
    return { error: "An unexpected server error occurred." };
  }
}
