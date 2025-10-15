
"use server";

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { serverDb } from '@/firebase/server-init';
import { caregiverEmployeeSchema } from './types';

// Define a type for the payload to ensure type safety
type HireCaregiverPayload = z.infer<typeof caregiverEmployeeSchema>;

export async function hireCaregiver(payload: HireCaregiverPayload) {
  
  const validatedFields = caregiverEmployeeSchema.safeParse(payload);

  if (!validatedFields.success) {
    return { 
        message: "Invalid data provided.",
        error: true,
        issues: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const { caregiverProfileId, interviewId, ...rest } = validatedFields.data;

    const employeeData = {
        ...rest,
        caregiverProfileId,
        interviewId,
        createdAt: new Date(),
    };

    await serverDb.collection('caregiver_employees').add(employeeData);

    revalidatePath('/admin/manage-interviews');
    
    return { message: 'Caregiver has been successfully marked as hired.' };

  } catch (error) {
    console.error("Error hiring caregiver:", error);
    return { message: "Failed to save hiring data.", error: true };
  }
}
