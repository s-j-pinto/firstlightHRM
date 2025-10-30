
"use server";

import { serverAuth, serverDb } from "@/firebase/server-init";

/**
 * Verifies a new client's credentials for document signing and returns a custom Firebase auth token.
 * @param email - The client's email.
 * @param password - The last 4 digits of the client's phone number.
 * @returns An object with a custom token or an error message.
 */
export async function loginNewClient(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[New Client Login] Attempting login for email: ${normalizedEmail}`);

  try {
    const signupsRef = serverDb.collection('client_signups');
    const query = signupsRef
      .where('clientEmail', '==', normalizedEmail)
      .where('status', '==', 'PENDING CLIENT SIGNATURES')
      .limit(1);

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`[New Client Login] No pending signup found for email: ${normalizedEmail}`);
      return { error: "Invalid credentials or no documents are awaiting your signature." };
    }

    const signupDoc = snapshot.docs[0];
    const signupData = signupDoc.data();
    
    // The form data is nested in the 'formData' field
    const clientPhone = signupData.formData?.clientPhone;
    if (!clientPhone) {
        console.log(`[New Client Login] Phone number missing for signup doc ID: ${signupDoc.id}`);
        return { error: "Client profile is incomplete. Please contact the office." };
    }
    
    const phoneLastFour = clientPhone.slice(-4);

    if (phoneLastFour !== password) {
        console.warn(`[New Client Login] Password mismatch for ${normalizedEmail}.`);
        return { error: "Invalid credentials. Please check your email and password." };
    }
    
    const clientName = signupData.formData?.clientName || "Client";
    const uid = `new_client_${signupDoc.id}`;
    
    try {
        await serverAuth.updateUser(uid, {
            email: normalizedEmail,
            displayName: clientName,
        }).catch(async (error: any) => {
            if (error.code === 'auth/user-not-found') {
                await serverAuth.createUser({
                    uid: uid,
                    email: normalizedEmail,
                    displayName: clientName,
                });
            } else {
                throw error;
            }
        });

        const customToken = await serverAuth.createCustomToken(uid);
        console.log(`[New Client Login] Successfully generated custom token for UID: ${uid}`);
        return { token: customToken };

    } catch (authError: any) {
        console.error("[New Client Login] Firebase Auth operation failed:", authError);
        const isPermissionError = authError.message?.includes('Caller does not have required permission');
        if (isPermissionError) {
             return { error: `Server permission error: Missing IAM role ("Service Usage Consumer").` };
        }
        return { error: `An unexpected server authentication error occurred: ${authError.message}` };
    }

  } catch (error: any) {
    console.error('[New Client Login] A critical error occurred:', error);
    return { error: 'A critical server error occurred. Please check the server logs.' };
  }
}
