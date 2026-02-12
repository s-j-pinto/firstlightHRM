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
                throw error;
            }
        });

        const customToken = await serverAuth.createCustomToken(uid);
        return { token: customToken };

    } catch (authError: any) {
        console.error("[Candidate Login] Firebase Auth operation failed:", authError);
        return { error: `A server authentication error occurred.` };
    }

  } catch (error: any) {
    console.error('[Candidate Login] A critical error occurred:', error);
    return { error: 'A server error occurred. Please try again later.' };
  }
}
