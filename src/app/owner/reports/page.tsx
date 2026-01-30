
"use client";

import { useState } from 'react';
import CancelledInterviewsReport from "@/components/cancelled-interviews-report";
import CandidateStatusReport from "@/components/candidate-status-report";
import ClientCareRequestsReport from '@/components/client-care-requests-report';
import ReferralsRewardsReport from '@/components/referrals-rewards-report';
import LeadConversionFunnelReport from '@/components/lead-conversion-funnel-report';
import LeadSourcePerformanceReport from '@/components/lead-source-performance-report';
import LostLeadAnalysisReport from '@/components/lost-lead-analysis-report';
import LevelOfCareReport from '@/components/level-of-care-report';
import SpeedToHireReport from '@/components/speed-to-hire-report';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpDialog } from '@/components/HelpDialog';

export default function OwnerReportsPage() {
  const [selectedReport, setSelectedReport] = useState('lead_conversion_funnel');

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
                <div className="w-full sm:w-[320px]">
                    <Select value={selectedReport} onValueChange={setSelectedReport}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a report" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="lead_conversion_funnel">Lead Conversion Funnel</SelectItem>
                            <SelectItem value="lead_source_performance">Lead Source Performance</SelectItem>
                            <SelectItem value="lost_lead_analysis">Lost Lead Analysis</SelectItem>
                            <SelectItem value="level_of_care">Level of Care Needs Analysis</SelectItem>
                            <SelectItem value="candidate_status">Candidate Interview Status</SelectItem>
                            <SelectItem value="speed_to_hire">Time-Based Metrics (Speed to Hire)</SelectItem>
                            <SelectItem value="cancelled_interviews">Cancelled Phone Screen Appointments</SelectItem>
                            <SelectItem value="client_care_requests">Client Care Request Status</SelectItem>
                            <SelectItem value="referrals_rewards">Referrals and Rewards Status</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <HelpDialog topic="adminReports" />
            </div>
        </div>
      
      <div className="mt-6">
        {selectedReport === 'lead_conversion_funnel' && <LeadConversionFunnelReport />}
        {selectedReport === 'lead_source_performance' && <LeadSourcePerformanceReport />}
        {selectedReport === 'lost_lead_analysis' && <LostLeadAnalysisReport />}
        {selectedReport === 'level_of_care' && <LevelOfCareReport />}
        {selectedReport === 'candidate_status' && <CandidateStatusReport />}
        {selectedReport === 'cancelled_interviews' && <CancelledInterviewsReport />}
        {selectedReport === 'client_care_requests' && <ClientCareRequestsReport />}
        {selectedReport === 'referrals_rewards' && <ReferralsRewardsReport />}
        {selectedReport === 'speed_to_hire' && <SpeedToHireReport />}
      </div>
    </div>
  );
}
