

'use server';

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendHomeVisitInvite } from './google-calendar.actions';
import { parse, set, isValid, isDate } from 'date-fns';

const safeParseDate = (dateString?: string | Date, format = 'MM/dd/yyyy') => {
    if (!dateString) return null;
    if (isDate(dateString)) return dateString as Date;
    const date = parse(dateString as string, format, new Date());
    return isValid(date) ? date : null;
};

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
            return { message: "Please select an appointment time to continue.", error: true };
        }
        
        const [dateStr, timeStr] = data.assessmentTime.split(' ');
        const [hours, minutes] = timeStr.split(':');
        const assessmentDate = parse(dateStr, 'yyyy-MM-dd', new Date());
        assessmentDate.setHours(parseInt(hours), parseInt(minutes));

        const estimatedStartDate = safeParseDate(data.estimatedStartDate);

        const updateData: { [key: string]: any } = {
            ...data,
            estimatedStartDate: estimatedStartDate ? Timestamp.fromDate(estimatedStartDate) : null,
            dateOfHomeVisit: Timestamp.fromDate(assessmentDate),
            timeOfVisit: timeStr,
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
            dateOfHomeVisit: assessmentDate,
            timeOfVisit: timeStr,
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
