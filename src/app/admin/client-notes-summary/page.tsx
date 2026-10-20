
"use client";

import ClientNotesSummaryViewer from "@/components/client-notes-summary-viewer";
import { HelpDialog } from "@/components/HelpDialog";

export default function AdminClientNotesSummaryPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Client Notes Summary
          </h1>
          <p className="text-muted-foreground">
            Review AI-generated weekly summaries of caregiver notes and health observations.
          </p>
        </div>
        <HelpDialog topic="adminReports" />
      </div>
      <div className="mt-6">
        <ClientNotesSummaryViewer />
      </div>
    </div>
  );
}
