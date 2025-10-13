
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { appointmentSchema } from "./types";

// This server action is now only responsible for redirection.
// The data is already validated and saved by the client.
export async function submitCaregiverProfile(data: {
    caregiverId: string;
    caregiverName: string;
    caregiverEmail: string;
    caregiverPhone: string;
}) {
  const params = new URLSearchParams({
      caregiverId: data.caregiverId,
      caregiverName: data.caregiverName,
      caregiverEmail: data.caregiverEmail,
      caregiverPhone: data.caregiverPhone,
      step: 'schedule'
  });
    
  redirect(`/?${params.toString()}`);
}


// This server action is now only responsible for redirection.
// The data creation is handled on the client.
export async function scheduleAppointment(data: z.infer<typeof appointmentSchema>) {
    const validatedFields = appointmentSchema.safeParse(data);

    if (!validatedFields.success) {
        // This should ideally not be hit if client-side validation is working
        redirect('/?step=schedule&error=invalid_data');
        return;
    }
    
    // Although data is saved on client, we can still revalidate here
    // to ensure the admin dashboard is updated.
    revalidatePath("/admin");
    
    const redirectUrl = `/confirmation?time=${validatedFields.data.startTime.toISOString()}`;
    redirect(redirectUrl);
}

    
