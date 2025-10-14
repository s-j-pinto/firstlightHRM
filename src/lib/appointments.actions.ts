
"use server";

import { revalidatePath } from "next/cache";
import { serverDb } from "@/firebase/server-init";
import type { Appointment } from "./types";

export async function updateAppointment(appointmentId: string, newStartTime: Date, newEndTime: Date) {
    try {
        const firestore = serverDb;
        const appointmentRef = firestore.collection('appointments').doc(appointmentId);
        
        const appointmentDoc = await appointmentRef.get();
        if (!appointmentDoc.exists) {
            return { message: "Appointment not found.", error: true };
        }

        await appointmentRef.update({
            startTime: newStartTime,
            endTime: newEndTime,
            inviteSent: false,
        });

        revalidatePath('/admin');

        return { message: "Appointment updated successfully." };
    } catch (error) {
        console.error("Error updating appointment:", error);
        return { message: "Failed to update appointment.", error: true };
    }
}

export async function cancelAppointment(appointmentId: string, reason: string) {
    try {
        const firestore = serverDb;
        const appointmentRef = firestore.collection('appointments').doc(appointmentId);

        await appointmentRef.update({
            appointmentStatus: "cancelled",
            cancelReason: reason,
            cancelDateTime: new Date(),
        });

        revalidatePath('/admin');
        
        return { message: "Appointment cancelled successfully." };
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        return { message: "Failed to cancel appointment.", error: true };
    }
}
