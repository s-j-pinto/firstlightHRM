
'use server';
/**
 * @fileOverview An AI flow to recommend caregivers based on client needs and caregiver availability/skills.
 *
 * - recommendCaregivers - A function that takes client needs and a list of caregivers and returns the top 3 matches.
 * - CaregiverRecommendationInput - The input type for the recommendCaregivers function.
 * - CaregiverRecommendationOutput - The return type for the recommendCaregivers function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import {
  CaregiverRecommendationInputSchema,
  CaregiverRecommendationOutputSchema,
  type CaregiverRecommendationInput,
  type CaregiverRecommendationOutput
} from '@/lib/types';


export async function recommendCaregivers(input: CaregiverRecommendationInput): Promise<CaregiverRecommendationOutput> {
  return recommendCaregiversFlow(input);
}

const prompt = ai.definePrompt({
  name: 'recommendCaregiversPrompt',
  input: { schema: CaregiverRecommendationInputSchema },
  output: { schema: CaregiverRecommendationOutputSchema },
  prompt: `You are an expert staffing coordinator for a home care agency. Your task is to recommend the top 3 caregivers for a new client based on their specific needs and the available caregivers' skills, availability, and preferences.

Analyze the following client needs and the list of available caregivers. For each of the top 3 caregivers, provide a match score (out of 100) and a concise, bulleted list explaining why they are a good match.

**Client's Care Needs:**
- **Language Preference:** {{clientCareNeeds.languagePreference}}
- **Companion Care Needs:**
  - Meal Preparation: {{#if clientCareNeeds.companionCare_mealPreparation}}Yes{{else}}No{{/if}}
  - Kitchen Cleaning: {{#if clientCareNeeds.companionCare_cleanKitchen}}Yes{{else}}No{{/if}}
  - Laundry Assistance: {{#if clientCareNeeds.companionCare_assistWithLaundry}}Yes{{else}}No{{/if}}
  - Alzheimer's/Dementia Redirection: {{#if clientCareNeeds.companionCare_provideAlzheimersRedirection}}Yes{{else}}No{{/if}}
  - Transportation: {{#if clientCareNeeds.companionCare_escortAndTransportation}}Yes{{else}}No{{/if}}
  - Other Companion Notes: {{clientCareNeeds.companionCare_other}}
- **Personal Care Needs:**
  - Alzheimer's/Dementia Care: {{#if clientCareNeeds.personalCare_provideAlzheimersCare}}Yes{{else}}No{{/if}}
  - Medication Reminders: {{#if clientCareNeeds.personalCare_provideMedicationReminders}}Yes{{else}}No{{/if}}
  - Mobility/Transfer Assistance: {{#if clientCareNeeds.personalCare_assistWithMobilityAmbulationTransfer}}Yes{{else}}No{{/if}}
  - Incontinence Care: {{#if clientCareNeeds.personalCare_assistWithIncontinenceCare}}Yes{{else}}No{{/if}}
  - Other Personal Care Notes: {{clientCareNeeds.personalCare_assistWithOther}}
- **Level of Care Assessment:**
  - Stand-by Transfer Assist Needed: {{#if clientCareNeeds.level_2_transfer_stand_by_assist}}Yes{{else}}No{{/if}}
  - One-Person Transfer Assist Needed: {{#if clientCareNeeds.level_3_transfer_one_person_assist}}Yes{{else}}No{{/if}}
  - Two-Person/Hoyer Lift Needed: {{#if clientCareNeeds.level_4_transfer_two_person_or_mechanical_lift}}Yes{{else}}No{{/if}}
  - Incontinence Management: {{#if clientCareNeeds.level_3_incontinence_management}}Yes{{else}}No{{/if}}
  - Mild Memory Impairment: {{#if clientCareNeeds.level_2_mild_memory_impairment}}Yes{{else}}No{{/if}}
  - Impaired Memory: {{#if clientCareNeeds.level_3_impaired_memory}}Yes{{else}}No{{/if}}
  - Severe Cognitive Impairment: {{#if clientCareNeeds.level_4_severe_cognitive_and_memory_impairment}}Yes{{else}}No{{/if}}


**List of Available Caregivers:**
{{#each availableCaregivers}}
- **ID:** {{id}}
  - **Name:** {{name}}
  - **Availability:**
    - Monday: {{#if availability.monday}}{{join availability.monday ", "}}{{else}}Not available{{/if}}
    - Tuesday: {{#if availability.tuesday}}{{join availability.tuesday ", "}}{{else}}Not available{{/if}}
    - Wednesday: {{#if availability.wednesday}}{{join availability.wednesday ", "}}{{else}}Not available{{/if}}
    - Thursday: {{#if availability.thursday}}{{join availability.thursday ", "}}{{else}}Not available{{/if}}
    - Friday: {{#if availability.friday}}{{join availability.friday ", "}}{{else}}Not available{{/if}}
    - Saturday: {{#if availability.saturday}}{{join availability.saturday ", "}}{{else}}Not available{{/if}}
    - Sunday: {{#if availability.sunday}}{{join availability.sunday ", "}}{{else}}Not available{{/if}}
  - **Preferences:**
    - Works with Pets: {{#if preferences.worksWithPets}}{{preferences.worksWithPets}}{{else}}N/A{{/if}}
    - Has Allergies: {{#if preferences.hasAllergies}}{{preferences.hasAllergies}}{{else}}N/A{{/if}}
    - Smoking Preference: {{#if preferences.smokingPreference}}{{preferences.smokingPreference}}{{else}}N/A{{/if}}
{{/each}}

Based on this information, provide your top 3 recommendations. The reasoning should be clear and directly relate to the client's needs and the caregiver's profile.
`,
});

const recommendCaregiversFlow = ai.defineFlow(
  {
    name: 'recommendCaregiversFlow',
    inputSchema: CaregiverRecommendationInputSchema,
    outputSchema: CaregiverRecommendationOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("The AI model did not return a valid recommendation.");
    }
    return output;
  }
);

    