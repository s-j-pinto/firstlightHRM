
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CaregiverForm } from "@/components/caregiver-form";
import { AppointmentScheduler } from "@/components/appointment-scheduler";

function JourneyManager() {
  const searchParams = useSearchParams();
  const step = searchParams.get('step');
  const caregiverId = searchParams.get('caregiverId');
  const caregiverName = searchParams.get('caregiverName');
  const caregiverEmail = searchParams.get('caregiverEmail');
  const caregiverPhone = searchParams.get('caregiverPhone');

  const handleFormSuccess = (id: string, name: string) => {
    // This function is now effectively handled by the server action redirect
    // It can be kept for other potential flows or removed.
    // For now, we rely on the redirect.
  };

  return (
    <main className="flex-1">
      <div className="container relative">
        {step === 'schedule' && caregiverId && caregiverName && caregiverEmail && caregiverPhone ? (
          <AppointmentScheduler 
            caregiverId={caregiverId} 
            caregiverName={caregiverName}
            caregiverEmail={caregiverEmail}
            caregiverPhone={caregiverPhone}
          />
        ) : (
          <CaregiverForm onSuccess={handleFormSuccess} />
        )}
      </div>
    </main>
  );
}


export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <JourneyManager />
    </Suspense>
  )
}
