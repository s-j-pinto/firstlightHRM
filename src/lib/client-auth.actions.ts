
'use server';

import { serverAuth, serverDb } from '@/firebase/server-init';
import { Client } from './types';
import { cookies } from 'next/headers';

/**
 * Verifies a client's credentials and returns a custom Firebase auth token or a list of choices.
 * @param email - The client contact's email.
 * @param password - The last 4 digits of the client's mobile number.
 * @returns An object with a custom token, a list of client choices, or an error message.
 */
export async function loginClient(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  console.log(`[Client Login] Attempting login for email: ${normalizedEmail}`);

  try {
    const clientsRef = serverDb.collection('Clients');
    const snapshot = await clientsRef.where('status', '==', 'ACTIVE').get();

    if (snapshot.empty) {
      console.log(`[Client Login] No active clients found in the database.`);
      return { error: 'Invalid credentials or no active clients found.' };
    }

    const matchingClients: (Client & { id: string })[] = [];
    snapshot.forEach(doc => {
      const clientData = doc.data() as Client;
      const clientEmail = (clientData.Email || '').trim().toLowerCase();
      if (clientEmail === normalizedEmail) {
        const mobileLastFour = (clientData.Mobile || '').slice(-4);
        if (mobileLastFour === password) {
          matchingClients.push({ ...clientData, id: doc.id });
        }
      }
    });

    if (matchingClients.length === 0) {
      console.log(`[Client Login] No active client found with matching email and password for: ${normalizedEmail}`);
      return { error: 'Invalid credentials. Please check your email and password.' };
    }

    if (matchingClients.length === 1) {
      const client = matchingClients[0];
      const uid = `client_${client.id}`;
      
      console.log(`[Client Login] Single client found: ${client['Client Name']}. Generating token.`);

      const careLogGroupsRef = serverDb.collection('carelog_groups');
      const groupQuery = await careLogGroupsRef.where('clientId', '==', client.id).limit(1).get();
      
      // The UID is now unique per client, and the claim confirms which client it is.
      const customToken = await serverAuth.createCustomToken(uid, { clientId: client.id });
      console.log(`[Client Login] Token generated for UID: ${uid}`);

      if (groupQuery.empty) {
        // If no group, redirect to a generic client dashboard page.
        console.log(`[Client Login] No care log group found for client ${client.id}. Redirecting to generic dashboard.`);
        return { 
          token: customToken,
          redirect: `/client/dashboard` // Redirect to a generic page
        };
      }
      
      const groupId = groupQuery.docs[0].id;

      return { 
        token: customToken,
        redirect: `/client/reports/carelog/${groupId}`
      };
    }

    // --- Multi-client scenario ---
    // The UID needs to be consistent for the session, so we use the email.
    // This allows us to update claims later.
    const tempUid = `multi_user_${Buffer.from(normalizedEmail).toString('base64')}`;
    const clientChoices = matchingClients.map(c => ({
      id: c.id,
      name: c['Client Name'],
    }));
    
    console.log(`[Client Login] Multiple clients found for ${normalizedEmail}. Returning choices.`);

    const customToken = await serverAuth.createCustomToken(tempUid, { email: normalizedEmail });

    return { 
      token: customToken,
      choices: clientChoices,
      redirect: '/client-dashboard' 
    };

  } catch (error: any) {
    console.error('[Client Login] A critical error occurred:', error);
    return { error: 'A server error occurred. Please try again later.' };
  }
}

/**
 * Finds the care log group ID for a given client ID and adds the clientId as a custom claim.
 * @param clientId The ID of the client.
 * @returns An object with the groupId or an error.
 */
export async function addClientIdClaimAndGetRedirect(clientId: string) {
    if (!clientId) {
        return { error: "Client ID is required." };
    }

    try {
        const sessionCookie = cookies().get("__session")?.value || "";
        if (!sessionCookie) {
            return { error: "Session not found. Please log in again." };
        }
        const decodedIdToken = await serverAuth.verifySessionCookie(sessionCookie, true);
        const uid = decodedIdToken.uid;
        
        await serverAuth.setCustomUserClaims(uid, { clientId: clientId });

        const careLogGroupsRef = serverDb.collection('carelog_groups');
        const groupQuery = await careLogGroupsRef.where('clientId', '==', clientId).limit(1).get();

        if (groupQuery.empty) {
            // If no group, redirect to the generic dashboard instead of returning an error
            return { redirect: '/client/dashboard' };
        }
        
        const groupId = groupQuery.docs[0].id;
        return { groupId, redirect: `/client/reports/carelog/${groupId}` };

    } catch (error: any)
    {
        console.error("Error setting claim or fetching group ID:", error);
        return { error: "Could not set client profile or retrieve the care log report." };
    }
}
