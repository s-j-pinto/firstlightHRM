
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';
import * as logger from "firebase-functions/logger";


// This is the primary Genkit instance.
export const ai = genkit({
    plugins: [googleAI()],
    enableTracingAndMetrics: true,
});

// Defines the expected input from the client.
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

// Defines the expected output from the AI model.
const InterviewInsightsOutputSchema = z.object({
    aiGeneratedInsight: z.string().describe('A concise summary of the candidate (max 200 words), followed by a clear hiring recommendation (e.g., "Recommend for in-person interview," "Proceed with caution," "Do not recommend") with a brief justification.'),
});


/**
 * This function is NOT a Cloud Function itself. It's a helper that contains
 * the Genkit logic and is called by our actual `onCall` Cloud Function.
 *
 * @param input The data passed from the client, conforming to InterviewInsightsInputSchema.
 * @returns The AI-generated insights.
 */
export async function generateInterviewInsights(input: any) {
    logger.info("Received request for AI insights", { structuredData: true, data: input });

    // Validate the input from the client.
    const validatedInput = InterviewInsightsInputSchema.safeParse(input);
    if (!validatedInput.success) {
        logger.error("Invalid input for AI insights", { structuredData: true, error: validatedInput.error.issues });
        throw new Error("Invalid input provided.");
    }
    
    // Define the prompt for the AI model.
    const interviewAnalysisPrompt = ai.definePrompt(
        {
          name: 'interviewAnalysisPrompt',
          input: { schema: InterviewInsightsInputSchema },
          output: { schema: InterviewInsightsOutputSchema },
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
- Availability is complex and not needed for this high-level summary.
- Transportation: Has car: {{hasCar}}, Valid License: {{validLicense}}

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
        },
    );

    // Run the prompt with the validated input.
    const { output } = await interviewAnalysisPrompt(validatedInput.data);
    
    if (!output) {
        logger.error("The AI model did not return a valid output.");
        throw new Error("The AI model did not return a valid output.");
    }

    logger.info("Successfully generated AI insights.", { structuredData: true });
    return output;
}
