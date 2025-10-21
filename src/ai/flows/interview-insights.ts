
'use server';

import { z } from 'zod';
import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Defines the schema for the data that will be passed into the AI prompt.
// This ensures the data is structured correctly before being sent to the model.
const InterviewInsightsInputSchema = z.object({
  fullName: z.string(),
  yearsExperience: z.coerce.number(),
  summary: z.string().optional(),
  canUseHoyerLift: z.boolean().optional(),
  hasDementiaExperience: z.boolean().optional(),
  hasHospiceExperience: z.boolean().optional(),
  cna: z.boolean().optional(),
  hha: z.boolean().optional(),
  hca: z.boolean().optional(),
  availability: z.any(),
  hasCar: z.string(),
  validLicense: z.string(),
  interviewNotes: z.string(),
  candidateRating: z.number().min(0).max(5),
});
export type InterviewInsightsInput = z.infer<typeof InterviewInsightsInputSchema>;


// Defines the schema for the expected output from the AI model.
// This tells the model how to structure its response.
const InterviewInsightsOutputSchema = z.object({
  aiGeneratedInsight: z.string().describe('A concise summary of the candidate (max 200 words), followed by a clear hiring recommendation (e.g., "Recommend for in-person interview," "Proceed with caution," "Do not recommend") with a brief justification.'),
});
export type InterviewInsightsOutput = z.infer<typeof InterviewInsightsOutputSchema>;

/**
 * A server action that wraps the Genkit flow for use on the client.
 * @param input - The candidate and interview data.
 * @returns The structured output from the AI model.
 */
export async function generateInterviewInsights(input: InterviewInsightsInput): Promise<InterviewInsightsOutput> {
  return generateInterviewInsightsFlow(input);
}


// Defines the prompt template that will be sent to the AI model.
// It uses Handlebars syntax `{{...}}` to insert the input data.
const interviewAnalysisPrompt = ai.definePrompt(
  {
    name: 'interviewAnalysisPrompt',
    input: { schema: InterviewInsightsInputSchema },
    output: { schema: InterviewInsightsOutputSchema },
    model: googleAI.model('gemini-1.5-flash'),
    prompt: `You are an expert HR assistant for a home care agency. Your task is to analyze a caregiver candidate's profile and the notes from their phone screen to provide a single, combined insight containing a summary and a hiring recommendation.

Analyze the following information:

**Caregiver Profile:**
- Full Name: {{fullName}}
- Years of Experience: {{yearsExperience}}
- Experience Summary: {{#if summary}}{{summary}}{{else}}Not provided{{/if}}
- Skills:
  - Hoyer Lift: {{#if canUseHoyerLift}}Yes{{else}}No{{/if}}
  - Dementia Experience: {{#if hasDementiaExperience}}Yes{{else}}No{{/if}}
  - Hospice Experience: {{#if hasHospiceExperience}}Yes{{else}}No{{/if}}
- Certifications:
  - CNA: {{#if cna}}Yes{{else}}No{{/if}}
  - HHA: {{#if hha}}Yes{{else}}No{{/if}}
  - HCA: {{#if hca}}Yes{{else}}No{{/if}}
- Transportation: Has car: {{hasCar}}, Valid License: {{validLicense}}

**Interviewer's Phone Screen Feedback:**
- Rating (out of 5): {{candidateRating}}
- Notes:
{{{interviewNotes}}}

**Your Task:**

Generate a single string for the 'aiGeneratedInsight' field. This string must contain two parts:

1.  **Summary:** First, write a concise professional summary of the candidate. Highlight their key strengths, potential weaknesses, and alignment with a caregiver role. The summary must be a maximum of 200 words.

2.  **Recommendation:** After the summary, add two new lines (to create a blank line), then provide a clear, actionable hiring recommendation. Start this part with "Recommendation:". Choose from "Recommend for in-person interview," "Proceed with caution," or "Do not recommend." Justify your choice with 1-2 key reasons based on the provided data.

Example format:
[Summary of the candidate...]

Recommendation: [Your recommendation and justification...]
`,
  },
);

// Defines the Genkit flow, which orchestrates the call to the AI prompt.
const generateInterviewInsightsFlow = ai.defineFlow(
  {
    name: "generateInterviewInsightsFlow",
    inputSchema: InterviewInsightsInputSchema,
    outputSchema: InterviewInsightsOutputSchema,
  },
  async (input) => {
    const { output } = await interviewAnalysisPrompt(input);
    
    if (!output) {
      throw new Error("The AI model did not return a valid output.");
    }
    
    return output;
  }
);
