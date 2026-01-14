
"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2, UserCheck, Sparkles, Star } from "lucide-react";
import { useCollection, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { getCaregiverRecommendations } from "@/lib/ai.actions";
import type { InitialContact, LevelOfCareFormData, ActiveCaregiver } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";

interface CaregiverRecommendationClientProps {
  contactId: string;
}

export function CaregiverRecommendationClient({ contactId }: CaregiverRecommendationClientProps) {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [isGenerating, startGeneratingTransition] = useTransition();

  const contactRef = useMemoFirebase(() => doc(firestore, 'initial_contacts', contactId), [contactId]);
  const { data: contactData, isLoading: contactLoading } = useDoc<InitialContact>(contactRef);
  
  const locRef = useMemoFirebase(() => doc(firestore, 'level_of_care_assessments', contactId), [contactId]);
  const { data: locData, isLoading: locLoading } = useDoc<LevelOfCareFormData>(locRef);

  const caregiversRef = useMemoFirebase(() => collection(firestore, 'caregivers_active'), [firestore]);
  const { data: caregiversData, isLoading: caregiversLoading } = useCollection<ActiveCaregiver>(caregiversRef);

  // We need to fetch subcollections separately. This is a simplified approach.
  // A real-world scenario might require more complex data fetching logic.
  const [availabilities, setAvailabilities] = useState<any>({});
  const [preferences, setPreferences] = useState<any>({});
  const [subcollectionsLoading, setSubcollectionsLoading] = useState(true);

  useEffect(() => {
    async function fetchSubcollections() {
      if (!caregiversData) return;
      
      const availabilityPromises = caregiversData.map(cg => 
        firestore.collection('caregivers_active').doc(cg.id).collection('availability').doc('current_week').get()
      );
      const preferencePromises = caregiversData.map(cg => 
        firestore.collection('caregivers_active').doc(cg.id).collection('preferences').doc('current').get()
      );

      const availabilityResults = await Promise.all(availabilityPromises);
      const preferenceResults = await Promise.all(preferencePromises);

      const avails: any = {};
      availabilityResults.forEach((doc, index) => {
        if (doc.exists) avails[caregiversData[index].id] = doc.data();
      });

      const prefs: any = {};
      preferenceResults.forEach((doc, index) => {
        if (doc.exists) prefs[caregiversData[index].id] = doc.data();
      });

      setAvailabilities(avails);
      setPreferences(prefs);
      setSubcollectionsLoading(false);
    }

    if (caregiversData) {
      fetchSubcollections();
    }
  }, [caregiversData, firestore]);
  

  const handleGenerate = () => {
    if (!contactData || !caregiversData) {
      return;
    }

    startGeneratingTransition(async () => {
      const clientCareNeeds = { ...contactData, ...locData, languagePreference: contactData.languagePreference || 'English' };
      const availableCaregivers = caregiversData
        .filter(cg => cg.status === 'Active')
        .map(cg => ({
            id: cg.id,
            name: cg.Name,
            availability: availabilities[cg.id] || {},
            preferences: preferences[cg.id] || {},
        }));
        
      const result = await getCaregiverRecommendations({ clientCareNeeds, availableCaregivers });

      if (result.recommendations) {
        setRecommendations(result.recommendations);
      } else {
        // Handle error
        console.error(result.error);
      }
    });
  };
  
  const isLoading = contactLoading || locLoading || caregiversLoading || subcollectionsLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <Button onClick={handleGenerate} disabled={isGenerating || isLoading}>
          {isGenerating ? (
            <Loader2 className="mr-2 animate-spin" />
          ) : (
            <Sparkles className="mr-2" />
          )}
          {isLoading ? 'Loading Data...' : 'Generate Recommendations'}
        </Button>
      </div>

      {recommendations.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-center">Top 3 Recommended Caregivers</h3>
          {recommendations.map((rec, index) => (
            <Alert key={rec.caregiverId} variant={index === 0 ? "default" : "default"} className={index === 0 ? "bg-green-50 border-green-200" : ""}>
              <UserCheck className="h-4 w-4" />
              <AlertTitle className="flex justify-between items-center">
                <span>{index + 1}. {rec.caregiverName}</span>
                <span className="flex items-center text-sm font-medium text-yellow-500">
                  <Star className="h-4 w-4 mr-1 fill-current" />
                  Match Score: {rec.matchScore.toFixed(0)}%
                </span>
              </AlertTitle>
              <AlertDescription className="mt-2 whitespace-pre-wrap">{rec.reasoning}</AlertDescription>
            </Alert>
          ))}
        </div>
      ) : (
        !isGenerating && <p className="text-center text-muted-foreground">Click the button to generate AI-powered caregiver recommendations based on the client's needs.</p>
      )}
    </div>
  );
}

    