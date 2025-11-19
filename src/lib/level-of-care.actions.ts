
"use server";

import { revalidatePath } from 'next/cache';
import { serverDb } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

export const levelOfCareSchema = z.object({
  level_0_independent_in_emergency: z.boolean().optional(),
  level_0_able_to_negotiate_stairs: z.boolean().optional(),
  level_0_able_to_bathe: z.boolean().optional(),
  level_0_able_to_dress: z.boolean().optional(),
  level_0_able_to_groom: z.boolean().optional(),
  level_0_able_to_transfer_and_ambulate: z.boolean().optional(),
  level_0_able_to_use_toilet: z.boolean().optional(),
  level_0_take_medications: z.boolean().optional(),
  level_0_able_to_prepare_and_eat_meals: z.boolean().optional(),
  level_0_light_housekeeping: z.boolean().optional(),
  level_0_able_to_plan_social_activities: z.boolean().optional(),
  level_0_little_to_no_family_concern: z.boolean().optional(),
  level_1_able_to_respond_in_emergency: z.boolean().optional(),
  level_1_ambulates_independently: z.boolean().optional(),
  level_1_infrequent_falls: z.boolean().optional(),
  level_1_independent_to_verbal_reminders: z.boolean().optional(),
  level_1_continent_bladder_bowel: z.boolean().optional(),
  level_1_independent_baths: z.boolean().optional(),
  level_1_meal_prep_assistance_helpful: z.boolean().optional(),
  level_1_housekeeping_assistance_helpful: z.boolean().optional(),
  level_1_some_encouragement_for_social_activities: z.boolean().optional(),
  level_1_oriented_to_self: z.boolean().optional(),
  level_1_little_memory_impairment: z.boolean().optional(),
  level_1_family_slightly_concerned: z.boolean().optional(),
  level_2_may_need_assistance_in_emergency: z.boolean().optional(),
  level_2_transfer_stand_by_assist: z.boolean().optional(),
  level_2_needs_reminders_for_adls: z.boolean().optional(),
  level_2_medication_management_helpful: z.boolean().optional(),
  level_2_some_incontinence_assistance: z.boolean().optional(),
  level_2_some_bathing_assistance: z.boolean().optional(),
  level_2_some_meal_prep_planning_assistance: z.boolean().optional(),
  level_2_some_housekeeping_assistance: z.boolean().optional(),
  level_2_reminders_encourage_participation: z.boolean().optional(),
  level_2_mild_memory_impairment: z.boolean().optional(),
  level_2_sometimes_disoriented: z.boolean().optional(),
  level_2_family_concerned: z.boolean().optional(),
  level_3_needs_assistance_in_emergency: z.boolean().optional(),
  level_3_transfer_one_person_assist: z.boolean().optional(),
  level_3_verbal_cues_to_hands_on_assist: z.boolean().optional(),
  level_3_medication_management: z.boolean().optional(),
  level_3_incontinence_management: z.boolean().optional(),
  level_3_needs_bathing_assistance: z.boolean().optional(),
  level_3_meal_prep_assistance_needed: z.boolean().optional(),
  level_3_housekeeping_assistance_needed: z.boolean().optional(),
  level_3_encouragement_escort_to_social_activities: z.boolean().optional(),
  level_3_impaired_memory: z.boolean().optional(),
  level_3_poor_orientation: z.boolean().optional(),
  level_3_mild_confusion: z.boolean().optional(),
  level_3_family_very_concerned: z.boolean().optional(),
  level_4_needs_supervision_in_emergency: z.boolean().optional(),
  level_4_transfer_two_person_or_mechanical_lift: z.boolean().optional(),
  level_4_hands_on_assistance_with_adls: z.boolean().optional(),
  level_4_medication_management: z.boolean().optional(),
  level_4_behavior_management: z.boolean().optional(),
  level_4_bathing_assistance: z.boolean().optional(),
  level_4_verbal_cues_hands_on_assistance_to_eat: z.boolean().optional(),
  level_4_needs_housekeeping: z.boolean().optional(),
  level_4_encouragement_escort_or_one_on_one: z.boolean().optional(),
  level_4_needs_24_hour_supervision: z.boolean().optional(),
  level_4_needs_skilled_services: z.boolean().optional(),
  level_4_severe_cognitive_and_memory_impairment: z.boolean().optional(),
});
export type LevelOfCareFormData = z.infer<typeof levelOfCareSchema>;

interface SavePayload {
    initialContactId: string;
    assessmentId: string | null;
    formData: LevelOfCareFormData;
}

export async function saveLevelOfCare(payload: SavePayload) {
    const { initialContactId, assessmentId, formData } = payload;

    const validation = levelOfCareSchema.safeParse(formData);
    if (!validation.success) {
        return { message: "Invalid data provided.", error: true };
    }

    const firestore = serverDb;
    const now = Timestamp.now();
    const dataToSave = { ...validation.data, initialContactId, lastUpdatedAt: now };

    try {
        if (assessmentId) {
            const assessmentRef = firestore.collection('level_of_care_assessments').doc(assessmentId);
            await assessmentRef.update(dataToSave);
        } else {
            const assessmentRef = firestore.collection('level_of_care_assessments').doc();
            await assessmentRef.set({ ...dataToSave, createdAt: now });
        }
        
        revalidatePath(`/admin/initial-contact?contactId=${initialContactId}`);
        revalidatePath(`/owner/initial-contact?contactId=${initialContactId}`);
        revalidatePath('/admin/assessments');
        revalidatePath('/owner/dashboard');

        return { message: "Level of Care assessment has been saved successfully." };
    } catch (error: any) {
        console.error("Error saving Level of Care assessment:", error);
        return { message: `An error occurred: ${error.message}`, error: true };
    }
}
