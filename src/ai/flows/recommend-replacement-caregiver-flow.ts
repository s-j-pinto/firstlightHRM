
'use server';
/**
 * @fileOverview A specialized AI agent for recommending replacement caregivers when a call-off occurs.
 *
 * This flow analyzes a specific open shift and a pool of candidate caregivers,
 * ranking them based on continuity of care (prior relationship), availability overlap,
 * and workload/overtime risk.
 *
 * - recommendReplacementCaregivers - Wrapper function for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CandidateSchema = z.object({
    id: z.string(),
    name: z.string(),
    isPriorCaregiver: z.boolean().describe("Whether this caregiver has worked with the client before."),
    availabilityText: z.string().describe("The raw text description of the caregiver's availability for the day."),
    nonOvertimeHours: z.number().describe("Number of hours the caregiver can work today before hitting a daily overtime cap (9h)."),
});

const ReplacementInputSchema = z.object({
    clientName: z.string(),
    shiftDate: z.string(),
    shiftTime: z.string(),
    shiftHours: z.number(),
    candidates: z.array(CandidateSchema),
});

const ReplacementOutputSchema = z.object({
    recommendations: z.array(z.object({
        caregiverId: z.string(),
        caregiverName: z.string(),
        score: z.number().min(0).max(100),
        reasons: z.array(z.string()),
        isPriorCaregiver: z.boolean(),
        overtimeHoursAvailable: z.number(),
        dailyAvailability: z.string(),
    })),
});

const replacementPrompt = ai.definePrompt({
    name: 'replacementPrompt',
    input: { schema: ReplacementInputSchema },
    output: { schema: ReplacementOutputSchema },
    model: 'googleai/gemini-2.5-flash-lite',
    prompt: `You are an expert staffing coordinator for a home care agency. Your task is to recommend the best replacement caregiver for an open shift.

**Shift Details:**
- Client: {{clientName}}
- Date: {{shiftDate}}
- Time: {{shiftTime}}
- Duration: {{shiftHours}} hours

**Candidate Pool:**
{{{json candidates}}}

**Scoring Criteria (Max 100 points):**
1. **Continuity of Care (50 pts):** Awarded if 'isPriorCaregiver' is true. This is the highest priority.
2. **Workload/Overtime Risk (30 pts):** Award full points if 'nonOvertimeHours' is greater than or equal to the 'shiftHours'. Deduct 10 points for every hour they would be in overtime.
3. **Availability Overlap (20 pts):** Evaluate 'availabilityText' against 'shiftTime'. Award points based on how clearly and comfortably their availability window covers the shift.

**Task:**
Rank the top 5 candidates. Provide clear, professional reasoning for each score, highlighting their history with the client and their overtime status.

Return the results in the 'recommendations' array, sorted by score in descending order.`,
});

export async function recommendReplacementCaregivers(input: z.infer<typeof ReplacementInputSchema>) {
    return recommendReplacementCaregiversFlow(input);
}

const recommendReplacementCaregiversFlow = ai.defineFlow(
    {
        name: 'recommendReplacementCaregiversFlow',
        inputSchema: ReplacementInputSchema,
        outputSchema: ReplacementOutputSchema,
    },
    async (input) => {
        const { output } = await replacementPrompt(input);
        if (!output) throw new Error("Staffing AI failed to generate recommendations.");
        return output;
    }
);
