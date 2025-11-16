"use client";

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ClientCareRequestsReport from '@/components/client-care-requests-report';
import { HelpDialog } from '@/components/HelpDialog';

export default function StaffingReportsPage() {
  const [selectedReport, setSelectedReport] = useState('client_care_requests');

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
                            <SelectItem value="client_care_requests">Client Care Requests Status</SelectItem>
                            {/* Add more reports here as they are built */}
                        </SelectContent>
                    </Select>
                </div>
                 <HelpDialog topic="adminReports" />
            </div>
        </div>
      
      <div className="mt-6">
        {selectedReport === 'client_care_requests' && <ClientCareRequestsReport />}
      </div>
    </div>
  );
}

    