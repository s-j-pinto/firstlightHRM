
'use server';
/**
 * @fileOverview An AI flow for generating insights about a caregiver interview.
 *
 * - generateInterviewInsights - A function that analyzes an interview and provides a summary and recommendation.
 * - InterviewInsightsInput - The input type for the generateInterviewInsights function.
 * - InterviewInsightsOutput - The return type for the generateInterviewInsights function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { caregiverFormSchema, type CaregiverProfile } from '@/lib/types';

const InterviewInsightsInputSchema = z.object({
  caregiverProfile: caregiverFormSchema.extend({ id: z.string() }),
  interviewNotes: z.string().describe('The notes taken by the interviewer during the phone screen.'),
  candidateRating: z.number().min(0).max(5).describe('A 0-5 rating given by the interviewer.'),
});
export type InterviewInsightsInput = z.infer<typeof InterviewInsightsInputSchema>;

const InterviewInsightsOutputSchema = z.object({
  aiGeneratedInsight: z.string().describe('A concise summary of the candidate (max 200 words), followed by a clear hiring recommendation (e.g., "Recommend for in-person interview," "Proceed with caution," "Do not recommend") with a brief justification.'),
});
export type InterviewInsightsOutput = z.infer<typeof InterviewInsightsOutputSchema>;

export async function generateInterviewInsights(input: InterviewInsightsInput): Promise<InterviewInsightsOutput> {
  return interviewInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'interviewInsightsPrompt',
  input: { schema: InterviewInsightsInputSchema },
  output: { schema: InterviewInsightsOutputSchema },
  prompt: `You are an expert HR assistant for a home care agency. Your task is to analyze a caregiver candidate's profile and the notes from their phone screen to provide a single, combined insight containing a summary and a hiring recommendation.

Analyze the following information:

**Caregiver Profile:**
- Full Name: {{caregiverProfile.fullName}}
- Years of Experience: {{caregiverProfile.yearsExperience}}
- Experience Summary: {{#if caregiverProfile.summary}}{{caregiverProfile.summary}}{{else}}Not provided{{/if}}
- Skills:
  - Hoyer Lift: {{#if caregiverProfile.canUseHoyerLift}}Yes{{else}}No{{/if}}
  - Dementia Experience: {{#if caregiverProfile.hasDementiaExperience}}Yes{{else}}No{{/if}}
  - Hospice Experience: {{#if caregiverProfile.hasHospiceExperience}}Yes{{else}}No{{/if}}
- Certifications:
  - CNA: {{#if caregiverProfile.cna}}Yes{{else}}No{{/if}}
  - HHA: {{#if caregiverProfile.hha}}Yes{{else}}No{{/if}}
  - HCA: {{#if caregiverProfile.hca}}Yes{{else}}No{{/if}}
- Availability: 
  {{#each caregiverProfile.availability}}
  {{@key}}: {{#if this}}{{#each this}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Not available{{/if}}
  {{/each}}
- Transportation: Has car: {{caregiverProfile.hasCar}}, Valid License: {{caregiverProfile.validLicense}}

**Interviewer's Phone Screen Feedback:**
- Rating (out of 5): {{candidateRating}}
- Notes:
{{{interviewNotes}}}

**Your Task:**

Generate a single string for the 'aiGeneratedInsight' field. This string should contain two parts:

1.  **Summary:** First, write a concise professional summary of the candidate. Highlight their key strengths, potential weaknesses, and alignment with a caregiver role. The summary must be a maximum of 200 words.

2.  **Recommendation:** After the summary, add two new lines, then provide a clear, actionable hiring recommendation. Start this part with "Recommendation:". Choose from "Recommend for in-person interview," "Proceed with caution," or "Do not recommend." Justify your choice with 1-2 key reasons based on the provided data.

Example format:
[Summary of the candidate...]

Recommendation: [Your recommendation and justification...]
`,
});

const interviewInsightsFlow = ai.defineFlow(
  {
    name: 'interviewInsightsFlow',
    inputSchema: InterviewInsightsInputSchema,
    outputSchema: InterviewInsightsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
