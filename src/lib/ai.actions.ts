'use server';

import { generateInterviewInsightsFlow } from '@/ai/flows/interview-insights';

/**
 * Server Action to generate AI insights for a caregiver interview.
 *
 * This function is called from the client and executes on the server.
 * It takes the candidate's profile and interview feedback, passes it
 * to a Genkit flow, and returns the AI-generated analysis.
 *
 * @param payload - The data for the candidate and interview.
 * @returns An object containing the AI-generated insight.
 */
export async function getAiInterviewInsights(payload: any) {
  try {
    const result = await generateInterviewInsightsFlow(payload);
    return { aiGeneratedInsight: result.aiGeneratedInsight };
  } catch (e: any) {
    console.error("Error in getAiInterviewInsights Server Action:", e);
    // Propagate a clear error message to the client.
    return { error: `An error occurred while generating AI insights: ${e.message}` };
  }
}
