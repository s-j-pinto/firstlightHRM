
"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2, UserCheck, Sparkles, Star } from "lucide-react";
import { useDoc, useCollection, useMemoFirebase, firestore } from "@/firebase";
import { collection, doc, getDocs, query } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { getCaregiverRecommendations } from "@/lib/recommendations.actions";
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

  const caregiversRef = useMemoFirebase(() => query(collection(firestore, 'caregivers_active')), []);
  const { data: caregiversData, isLoading: caregiversLoading } = useCollection<ActiveCaregiver>(caregiversRef);

  const [availabilities, setAvailabilities] = useState<any>({});
  const [preferences, setPreferences] = useState<any>({});
  const [subcollectionsLoading, setSubcollectionsLoading] = useState(true);

  useEffect(() => {
    async function fetchSubcollections() {
      if (!caregiversData) return;
      
      const availabilityPromises = caregiversData.map(cg => 
        getDocs(collection(firestore, 'caregivers_active', cg.id, 'availability'))
      );
      const preferencePromises = caregiversData.map(cg => 
        getDocs(collection(firestore, 'caregivers_active', cg.id, 'preferences'))
      );

      const availabilityResults = await Promise.all(availabilityPromises);
      const preferenceResults = await Promise.all(preferencePromises);

      const avails: any = {};
      availabilityResults.forEach((querySnapshot, index) => {
        if (!querySnapshot.empty) {
          // Assuming one doc per subcollection, e.g., 'current_week'
          avails[caregiversData[index].id] = querySnapshot.docs[0].data();
        }
      });

      const prefs: any = {};
      preferenceResults.forEach((querySnapshot, index) => {
        if (!querySnapshot.empty) {
          prefs[caregiversData[index].id] = querySnapshot.docs[0].data();
        }
      });

      setAvailabilities(avails);
      setPreferences(prefs);
      setSubcollectionsLoading(false);
    }

    if (caregiversData) {
      fetchSubcollections();
    }
  }, [caregiversData]);
  

  const handleGenerate = () => {
    if (!contactData || !caregiversData) {
      return;
    }

    startGeneratingTransition(async () => {
      const clientCareNeeds = { ...contactData, ...locData };
      const availableCaregivers = caregiversData
        .filter(cg => cg.status === 'Active')
        .map(cg => ({
            ...cg, // Pass the full caregiver object
            availability: availabilities[cg.id] || {},
            preferences: preferences[cg.id] || {},
        }));
        
      const result = await getCaregiverRecommendations({ clientCareNeeds, availableCaregivers });

      if (result.recommendations) {
        setRecommendations(result.recommendations);
      } else {
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
          <h3 className="text-lg font-semibold text-center">Top {recommendations.length} Recommended Caregivers</h3>
          {recommendations.map((rec, index) => (
            <Alert key={rec.id} variant={index === 0 ? "default" : "default"} className={index === 0 ? "bg-green-50 border-green-200" : ""}>
              <UserCheck className="h-4 w-4" />
              <AlertTitle className="flex justify-between items-center">
                <span>{index + 1}. {rec.name}</span>
                <span className="flex items-center text-sm font-medium text-yellow-500">
                  <Star className="h-4 w-4 mr-1 fill-current" />
                  Match Score: {rec.score.toFixed(0)}%
                </span>
              </AlertTitle>
              <AlertDescription className="mt-2">
                <ul className="list-disc pl-5 text-xs">
                    {rec.reasons.map((reason: string, i: number) => <li key={i}>{reason}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      ) : (
        !isGenerating && <p className="text-center text-muted-foreground">Click the button to generate caregiver recommendations based on the client's needs.</p>
      )}
    </div>
  );
}
