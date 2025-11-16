
"use client";

import { useState } from 'react';
import CancelledInterviewsReport from "@/components/cancelled-interviews-report";
import CandidateStatusReport from "@/components/candidate-status-report";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpDialog } from '@/components/HelpDialog';

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState('candidate_status');

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">Reports</h1>
                <p className="text-muted-foreground">
                    Analyze trends and historical data by selecting a report.
                </p>
            </div>
            <div className="flex items-center gap-4">
                <div className="w-full sm:w-[280px]">
                    <Select value={selectedReport} onValueChange={setSelectedReport}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a report" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="candidate_status">Candidate Interview Status</SelectItem>
                            <SelectItem value="cancelled_interviews">Cancelled Phone Screen Appointments</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <HelpDialog topic="adminReports" />
            </div>
        </div>
      
      <div className="mt-6">
        {selectedReport === 'candidate_status' && <CandidateStatusReport />}
        {selectedReport === 'cancelled_interviews' && <CancelledInterviewsReport />}
      </div>
    </div>
  );
}

    