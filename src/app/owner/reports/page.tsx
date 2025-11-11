"use client";

import { useState } from 'react';
import CancelledInterviewsReport from "@/components/cancelled-interviews-report";
import CandidateStatusReport from "@/components/candidate-status-report";
import ClientCareRequestsReport from '@/components/client-care-requests-report';
import ReferralsRewardsReport from '@/components/referrals-rewards-report';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OwnerReportsPage() {
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
            <div className="w-full sm:w-[280px]">
                 <Select value={selectedReport} onValueChange={setSelectedReport}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a report" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="candidate_status">Candidate Interview Status</SelectItem>
                        <SelectItem value="cancelled_interviews">Cancelled Phone Screen Appointments</SelectItem>
                        <SelectItem value="client_care_requests">Client Care Request Status</SelectItem>
                        <SelectItem value="referrals_rewards">Referrals and Rewards Status</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
      
      <div className="mt-6">
        {selectedReport === 'candidate_status' && <CandidateStatusReport />}
        {selectedReport === 'cancelled_interviews' && <CancelledInterviewsReport />}
        {selectedReport === 'client_care_requests' && <ClientCareRequestsReport />}
        {selectedReport === 'referrals_rewards' && <ReferralsRewardsReport />}
      </div>
    </div>
  );
}
