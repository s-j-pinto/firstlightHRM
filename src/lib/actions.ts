
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appointmentSchema } from "./types";
import { serverDb } from "@/firebase/server-init";

// This server action is now only responsible for redirection.
// The data is already validated and saved by the client.
export async function submitCaregiverProfile(data: {
    caregiverId: string;
    caregiverName: string;
    caregiverEmail: string;
    caregiverPhone: string;
}) {
  console.log("Step 4 (Server): `submitCaregiverProfile` action started for redirection.");
  
  const params = new URLSearchParams({
      caregiverId: data.caregiverId,
      caregiverName: data.caregiverName,
      caregiverEmail: data.caregiverEmail,
      caregiverPhone: data.caregiverPhone,
      step: 'schedule'
  });
    
  console.log("Step 5 (Server): Redirecting to scheduling step.");
  redirect(`/?${params.toString()}`);
}

export async function scheduleAppointment(data: z.infer<typeof appointmentSchema>) {
    const validatedFields = appointmentSchema.safeParse(data);

    if (!validatedFields.success) {
        return {
            error: "Invalid appointment data."
        }
    }

    try {
        await serverDb.collection("appointments").add(validatedFields.data);
    } catch (e) {
        console.error("Failed to schedule appointment:", e);
        return {
            error: "Could not schedule appointment."
        }
    }

    revalidatePath("/admin");
    
    const redirectUrl = `/confirmation?time=${validatedFields.data.startTime.toISOString()}`;
    redirect(redirectUrl);
}

    