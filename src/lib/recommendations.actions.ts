
'use server';

import type { ClientCareNeeds, ActiveCaregiver } from '@/lib/types';

interface RecommendationPayload {
  clientCareNeeds: Partial<ClientCareNeeds>;
  availableCaregivers: (ActiveCaregiver & { availability?: any, preferences?: any })[];
}

const SCORING_WEIGHTS = {
  LEVEL_OF_CARE: 30,
  DEMENTIA_EXPERIENCE: 20,
  PETS: 10,
  DRIVING: 10,
  // Schedule overlap is calculated dynamically
};

// Simplified check for level of care. A real implementation would be more complex.
const clientNeedsLevel = (client: Partial<ClientCareNeeds>): number => {
    if (client.level_4_transfer_two_person_or_mechanical_lift || client.level_4_severe_cognitive_and_memory_impairment) return 4;
    if (client.level_3_transfer_one_person_assist || client.level_3_impaired_memory) return 3;
    if (client.level_2_transfer_stand_by_assist || client.level_2_mild_memory_impairment) return 2;
    if (client.level_1_independent_to_verbal_reminders) return 1;
    return 0;
};

// A caregiver's supported level of care would ideally be stored in their profile.
// Here we'll infer it based on skills.
const caregiverSupportsLevel = (caregiver: ActiveCaregiver): number => {
    // This is a placeholder. In a real app, this data would come from the caregiver's profile.
    // For now, let's assume all active caregivers can handle up to level 3.
    // A more advanced check could look at `canUseHoyerLift`, etc.
    return 3; 
};


export async function getCaregiverRecommendations(payload: RecommendationPayload) {
    try {
        const { clientCareNeeds, availableCaregivers } = payload;
        const requiredLevel = clientNeedsLevel(clientCareNeeds);
        
        const scoredCaregivers = availableCaregivers.map(caregiver => {
            let score = 0;
            const reasons: string[] = [];

            // --- Hard Filters ---
            const supportedLevel = caregiverSupportsLevel(caregiver);
            if (supportedLevel < requiredLevel) {
                return null; // Hard filter: caregiver cannot support the required level of care.
            }
            
            // --- Weighted Scoring ---
            score += SCORING_WEIGHTS.LEVEL_OF_CARE;
            reasons.push(`Supports required level of care (+${SCORING_WEIGHTS.LEVEL_OF_CARE} pts)`);

            if (clientCareNeeds.personalCare_provideAlzheimersCare && caregiver.preferences?.dementiaExperience === 'Yes') {
                score += SCORING_WEIGHTS.DEMENTIA_EXPERIENCE;
                reasons.push(`Has dementia experience (+${SCORING_WEIGHTS.DEMENTIA_EXPERIENCE} pts)`);
            }
            
            const clientHasPets = clientCareNeeds.pets && clientCareNeeds.pets.toLowerCase() !== 'no';
            if (clientHasPets && caregiver.preferences?.worksWithPets === 'Yes') {
                score += SCORING_WEIGHTS.PETS;
                reasons.push(`Works with pets (+${SCORING_WEIGHTS.PETS} pts)`);
            }
            
            if (clientCareNeeds.companionCare_escortAndTransportation && caregiver['Drivers Lic']) {
                score += SCORING_WEIGHTS.DRIVING;
                reasons.push(`Has a driver's license for transportation (+${SCORING_WEIGHTS.DRIVING} pts)`);
            }
            
            // This is a simplified availability check. A real version would be more complex.
            if(caregiver.availability && Object.keys(caregiver.availability).length > 0) {
                reasons.push(`Has availability defined.`);
            }

            return {
                id: caregiver.id,
                name: caregiver.Name,
                score: score,
                reasons: reasons,
            };
        }).filter(Boolean); // Remove nulls from hard filters

        // Rank and get top 3
        const rankedCaregivers = (scoredCaregivers as any[])
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
            
        // Normalize score to be out of 100
        const maxScore = SCORING_WEIGHTS.LEVEL_OF_CARE + SCORING_WEIGHTS.DEMENTIA_EXPERIENCE + SCORING_WEIGHTS.PETS + SCORING_WEIGHTS.DRIVING;
        const finalRecommendations = rankedCaregivers.map(cg => ({
            ...cg,
            score: (cg.score / maxScore) * 100,
        }));

        return { recommendations: finalRecommendations };

    } catch (e: any) {
        console.error("Error in getCaregiverRecommendations:", e);
        return { error: `An error occurred: ${e.message}` };
    }
}
