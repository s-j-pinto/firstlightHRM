
'use server';
/**
 * @fileOverview A specialized AI agent for recommending caregivers for unassigned shifts.
 *
 * This flow analyzes an unassigned shift and a pool of active caregivers,
 * ranking them based on continuity of care (prior relationship), availability overlap,
 * workload, and proximity.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const CandidateSchema = z.object({
    id: z.string(),
    name: z.string(),
    isPriorCaregiver: z.boolean().describe("Whether this caregiver has worked with the client before (last 30 days)."),
    isDenied: z.boolean().describe("Whether this caregiver is explicitly denied from working with this client."),
    availabilityText: z.string().describe("The raw text description of the caregiver's availability for the day."),
    nonOvertimeHours: z.number().describe("Number of hours the caregiver can work today before hitting a daily overtime cap."),
    distanceText: z.string().optional().describe("Distance from caregiver address to client address."),
});

const UnassignedInputSchema = z.object({
    clientName: z.string(),
    shiftDate: z.string(),
    shiftTime: z.string(),
    shiftHours: z.number(),
    candidates: z.array(CandidateSchema),
});

const UnassignedOutputSchema = z.object({
    recommendations: z.array(z.object({
        caregiverId: z.string(),
        caregiverName: z.string(),
        score: z.number().min(0).max(100),
        reasons: z.array(z.string()),
        isPriorCaregiver: z.boolean(),
        isDenied: z.boolean(),
        overtimeHoursAvailable: z.number(),
        dailyAvailability: z.string(),
        distance: z.string().optional(),
    })),
});

const unassignedPrompt = ai.definePrompt({
    name: 'unassignedPrompt',
    input: { schema: UnassignedInputSchema },
    output: { schema: UnassignedOutputSchema },
    model: 'googleai/gemini-2.5-flash-lite',
    prompt: `You are an expert staffing coordinator for FirstLight Home Care. Your task is to recommend the best caregiver for an unassigned shift.

**Shift Details:**
- Client: {{clientName}}
- Date: {{shiftDate}}
- Time: {{shiftTime}}
- Duration: {{shiftHours}} hours

**Candidate Pool:**
{{{json candidates}}}

**Scoring Criteria (Max 100 points):**
1. **Hard Filter**: If 'isDenied' is true, set 'score' to 0 and 'reasons' to ["CAREGIVER IS DENIED FOR THIS CLIENT"].
2. **Continuity of Care (40 pts)**: Award 40 pts if 'isPriorCaregiver' is true. 
3. **Availability Match (30 pts)**: Evaluate 'availabilityText' against 'shiftTime'. Award 30 pts for a perfect match, 10 pts for a partial match.
4. **Workload/Overtime Risk (15 pts)**: Award 15 pts if 'nonOvertimeHours' is >= 'shiftHours'. Deduct proportional points for overtime risk.
5. **Proximity (15 pts)**: Award up to 15 pts based on 'distanceText'. Under 5 miles = 15, 5-15 miles = 10, >15 miles = 5.

**Task:**
Rank the top 10 eligible candidates. Provide clear, professional reasoning for each score. 
Highlight prior relationship and distance specifically in the reasons.

Return the results in the 'recommendations' array, sorted by score in descending order.`,
});

export async function recommendUnassignedCaregivers(input: z.infer<typeof UnassignedInputSchema>) {
    const { output } = await unassignedPrompt(input);
    if (!output) throw new Error("Staffing AI failed to generate recommendations for unassigned shift.");
    return output;
}
