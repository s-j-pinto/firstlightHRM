
'use server';

import { revalidatePath } from "next/cache";
import { serverDb } from "@/firebase/server-init";
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendHomeVisitInvite } from "./google-calendar.actions";

export async function submitLeadIntakeForm(contactId: string, data: any) {
    if (!contactId) {
        return { message: "Contact ID is missing.", error: true };
    }
    
    const firestore = serverDb;
    const contactRef = firestore.collection('initial_contacts').doc(contactId);

    try {
        const contactDoc = await contactRef.get();
        if (!contactDoc.exists) {
            return { message: "Original contact record not found.", error: true };
        }
        
        // Ensure an assessment time was selected
        if (!data.assessmentTime) {
            return { message: "Please select an assessment time to continue.", error: true };
        }
        
        const [date, time] = data.assessmentTime.split(' ');
        const [hours, minutes] = time.split(':');
        const assessmentDateTime = new Date(date);
        assessmentDateTime.setHours(parseInt(hours), parseInt(minutes));

        const updateData = {
            ...data,
            estimatedStartDate: data.estimatedStartDate ? Timestamp.fromDate(data.estimatedStartDate) : null,
            dateOfHomeVisit: Timestamp.fromDate(assessmentDateTime),
            timeOfVisit: time,
            status: 'In-Home Visit Scheduled',
            sendFollowUpCampaigns: false, // Stop campaigns after scheduling
            lastUpdatedAt: FieldValue.serverTimestamp(),
        };

        // Remove client info and assessmentTime as they are not part of the initial_contacts schema
        delete updateData.clientName;
        delete updateData.clientEmail;
        delete updateData.clientPhone;
        delete updateData.assessmentTime;

        await contactRef.update(updateData);
        
        const originalContactData = contactDoc.data();

        // Send calendar invite
        const calendarResult = await sendHomeVisitInvite({
            clientName: originalContactData?.clientName,
            clientAddress: originalContactData?.clientAddress,
            clientEmail: originalContactData?.clientEmail,
            additionalEmail: originalContactData?.additionalEmail,
            dateOfHomeVisit: assessmentDateTime,
            timeOfVisit: time,
        });

        if (calendarResult.error) {
            // Even if calendar fails, the update was successful, so we return a partial success
            return { message: `Form submitted, but calendar invite failed: ${calendarResult.message}`, error: true, authUrl: calendarResult.authUrl };
        }
        
        revalidatePath(`/lead-intake?id=${contactId}`);
        return { message: 'Your assessment has been scheduled successfully!' };
    } catch (error: any) {
        console.error("Error submitting lead intake form:", error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}
