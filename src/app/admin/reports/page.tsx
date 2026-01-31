"use client";

import { useState } from 'react';
import CancelledInterviewsReport from "@/components/cancelled-interviews-report";
import CandidateStatusReport from "@/components/candidate-status-report";
import NoShowRateReport from '@/components/no-show-rate-report';
import GhostingTrendsReport from '@/components/ghosting-trends-report';
import SpeedToHireReport from '@/components/speed-to-hire-report';
import TimeInStageReport from '@/components/time-in-stage-report';
import RejectionPointAnalysisReport from '@/components/rejection-point-analysis-report';
import TimeToRejectReport from '@/components/time-to-reject-report';
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
                            <SelectItem value="speed_to_hire">Time-Based Metrics (Speed to Hire)</SelectItem>
                            <SelectItem value="time_in_stage">Candidate Time-in-Stage Analysis</SelectItem>
                            <SelectItem value="rejection_points">Hiring Funnel & Rejection Points</SelectItem>
                            <SelectItem value="time_to_reject">Time-to-Reject Analysis</SelectItem>
                            <SelectItem value="cancelled_interviews">Cancelled Phone Screen Appointments</SelectItem>
                            <SelectItem value="no_show_rate">"No Show" Candidate Rate</SelectItem>
                            <SelectItem value="ghosting_trends">Ghosting Trends by Month</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <HelpDialog topic="adminReports" />
            </div>
        </div>
      
      <div className="mt-6">
        {selectedReport === 'candidate_status' && <CandidateStatusReport />}
        {selectedReport === 'cancelled_interviews' && <CancelledInterviewsReport />}
        {selectedReport === 'no_show_rate' && <NoShowRateReport />}
        {selectedReport === 'ghosting_trends' && <GhostingTrendsReport />}
        {selectedReport === 'speed_to_hire' && <SpeedToHireReport />}
        {selectedReport === 'time_in_stage' && <TimeInStageReport />}
        {selectedReport === 'rejection_points' && <RejectionPointAnalysisReport />}
        {selectedReport === 'time_to_reject' && <TimeToRejectReport />}
      </div>
    </div>
  );
}
