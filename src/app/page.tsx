"use client";

import { useState } from "react";
import { CaregiverForm } from "@/components/caregiver-form";
import { AppointmentScheduler } from "@/components/appointment-scheduler";

type JourneyState = "FORM" | "SCHEDULING";

export default function Home() {
  const [journeyState, setJourneyState] = useState<JourneyState>("FORM");
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [caregiverName, setCaregiverName] = useState<string>("");

  const handleFormSuccess = (id: string, name: string) => {
    setCaregiverId(id);
    setCaregiverName(name);
    setJourneyState("SCHEDULING");
    window.scrollTo(0, 0);
  };

  return (
    <main className="flex-1">
      <div className="container relative">
        {journeyState === "FORM" ? (
          <CaregiverForm onSuccess={handleFormSuccess} />
        ) : (
          <AppointmentScheduler caregiverId={caregiverId!} caregiverName={caregiverName} />
        )}
      </div>
    </main>
  );
}
