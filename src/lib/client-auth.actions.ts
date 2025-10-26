
'use server';

import { serverAuth, serverDb } from '@/firebase/server-init';
import { CareLogGroup, Client } from './types';

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
      if (clientData.Email && clientData.Email.toLowerCase() === normalizedEmail) {
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

      if (groupQuery.empty) {
        return { error: 'No care log group is associated with your profile. Please contact the administrator.' };
      }
      const groupId = groupQuery.docs[0].id;
      
      await serverAuth.setCustomUserClaims(uid, { clientId: client.id });
      const customToken = await serverAuth.createCustomToken(uid, { clientId: client.id });

      console.log(`[Client Login] Token generated for UID: ${uid}`);

      return { 
        token: customToken,
        redirect: `/client/reports/carelog/${groupId}`
      };
    }

    const tempUid = `client_multi_${Date.now()}`;
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
 * Finds the care log group ID for a given client ID.
 * @param clientId The ID of the client.
 * @returns An object with the groupId or an error.
 */
export async function getCareLogGroupId(clientId: string) {
    if (!clientId) {
        return { error: "Client ID is required." };
    }

    try {
        const careLogGroupsRef = serverDb.collection('carelog_groups');
        const groupQuery = await careLogGroupsRef.where('clientId', '==', clientId).limit(1).get();

        if (groupQuery.empty) {
            return { error: 'No care log group is associated with the selected client.' };
        }
        
        const groupId = groupQuery.docs[0].id;
        return { groupId, redirect: `/client/reports/carelog/${groupId}` };

    } catch (error: any) {
        console.error("Error fetching care log group ID:", error);
        return { error: "Could not retrieve the care log report." };
    }
}
