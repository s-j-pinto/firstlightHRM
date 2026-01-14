
'use server';

import { generateInterviewInsights, InterviewInsightsInput } from '@/ai/flows/interview-insights';
import { extractCareLogData as extractCareLogDataFlow } from '@/ai/flows/extract-carelog-flow';
import type { ExtractCareLogInput, ExtractCareLogOutput } from '@/lib/types';


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
export async function getAiInterviewInsights(payload: Omit<InterviewInsightsInput, 'cna'>) {
  try {
    const result = await generateInterviewInsights({...payload, cna: false});
    return { aiGeneratedInsight: result.aiGeneratedInsight };
  } catch (e: any) {
    console.error("Error in getAiInterviewInsights Server Action:", e);
    // Propagate a clear error message to the client.
    return { error: `An error occurred while generating AI insights: ${e.message}` };
  }
}

/**
 * Server Action to extract text and data from a care log image.
 *
 * @param payload - The image data to process.
 * @returns An object containing the extracted text and shift date/time.
 */
export async function extractCareLogData(payload: ExtractCareLogInput): Promise<ExtractCareLogOutput | { error: string }> {
  try {
    const result = await extractCareLogDataFlow(payload);
    return result;
  } catch (e: any) {
    console.error("Error in extractCareLogData Server Action:", e);
    return { error: `An error occurred while processing the image: ${e.message}` };
  }
}
