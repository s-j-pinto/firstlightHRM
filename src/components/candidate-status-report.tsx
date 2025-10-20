
"use client";

import { useMemo, useState } from "react";
import { format, subDays, subMonths, subQuarters, subYears, startOfDay } from "date-fns";
import { collection } from "firebase/firestore";
import { Loader2, FileText, ClipboardList, Check, X, CalendarCheck, CalendarX, UserCheck } from "lucide-react";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";

import type { Appointment, CaregiverProfile, Interview, CaregiverEmployee } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface CandidateReportData {
  caregiverId: string;
  caregiverName: string;
  appliedDate?: Date;
  phoneScreenAppointmentDate?: Date;
  phoneScreenPassed?: 'Yes' | 'No' | 'N/A';
  nextInterviewDate?: Date;
  nextInterviewType?: 'In-Person' | 'Google Meet';
  isHired: boolean;
}

export default function CandidateStatusReport() {
  const [timeFrame, setTimeFrame] = useState("last_month");

  const caregiversRef = useMemoFirebase(() => collection(firestore, 'caregiver_profiles'), []);
  const { data: caregiversData, isLoading: caregiversLoading } = useCollection<CaregiverProfile>(caregiversRef);

  const appointmentsRef = useMemoFirebase(() => collection(firestore, 'appointments'), []);
  const { data: appointmentsData, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsRef);

  const interviewsRef = useMemoFirebase(() => collection(firestore, 'interviews'), []);
  const { data: interviewsData, isLoading: interviewsLoading } = useCollection<Interview>(interviewsRef);

  const employeesRef = useMemoFirebase(() => collection(firestore, 'caregiver_employees'), []);
  const { data: employeesData, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesRef);

  const reportData = useMemo(() => {
    if (!caregiversData || !appointmentsData || !interviewsData || !employeesData) return [];
    
    const now = new Date();
    let startDate: Date;

    switch (timeFrame) {
      case "last_week":
        startDate = subDays(now, 7);
        break;
      case "last_quarter":
        startDate = subQuarters(now, 1);
        break;
      case "last_year":
        startDate = subYears(now, 1);
        break;
      case "last_month":
      default:
        startDate = subMonths(now, 1);
        break;
    }
    const startOfFilterDate = startOfDay(startDate);

    const filteredCaregivers = caregiversData.filter(cg => {
        const appliedDate = (cg.createdAt as any)?.toDate();
        return appliedDate && appliedDate >= startOfFilterDate;
    });

    const appointmentsMap = new Map(appointmentsData.map(a => [a.caregiverId, a]));
    const interviewsMap = new Map(interviewsData.map(i => [i.caregiverProfileId, i]));
    const employeesSet = new Set(employeesData.map(e => e.caregiverProfileId));

    const data: CandidateReportData[] = filteredCaregivers.map(cg => {
      const appointment = appointmentsMap.get(cg.id);
      const interview = interviewsMap.get(cg.id);
      
      const appliedDate = (cg.createdAt as any)?.toDate();
      const phoneScreenDate = (appointment?.startTime as any)?.toDate();
      const nextInterviewDate = interview?.phoneScreenPassed === 'Yes' ? (interview.interviewDateTime as any)?.toDate() : undefined;

      return {
        caregiverId: cg.id,
        caregiverName: cg.fullName,
        appliedDate: appliedDate,
        phoneScreenAppointmentDate: phoneScreenDate,
        phoneScreenPassed: interview?.phoneScreenPassed,
        nextInterviewDate: nextInterviewDate,
        nextInterviewType: interview?.interviewType as 'In-Person' | 'Google Meet' | undefined,
        isHired: employeesSet.has(cg.id),
      };
    });

    return data.sort((a,b) => (b.appliedDate?.getTime() || 0) - (a.appliedDate?.getTime() || 0));

  }, [caregiversData, appointmentsData, interviewsData, employeesData, timeFrame]);

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Caregiver Name,Applied Date,Phone Screen Scheduled,Phone Screen Passed,Next Interview Date,Next Interview Type,Hired\n";
    reportData.forEach(item => {
        const row = [
            `"${item.caregiverName}"`,
            `"${item.appliedDate ? format(item.appliedDate, "yyyy-MM-dd HH:mm") : 'N/A'}"`,
            `"${item.phoneScreenAppointmentDate ? format(item.phoneScreenAppointmentDate, "yyyy-MM-dd HH:mm") : 'N/A'}"`,
            `"${item.phoneScreenPassed || 'N/A'}"`,
            `"${item.nextInterviewDate ? format(item.nextInterviewDate, "yyyy-MM-dd HH:mm") : 'N/A'}"`,
            `"${item.nextInterviewType || 'N/A'}"`,
            `"${item.isHired ? 'Yes' : 'No'}"`
        ].join(",");
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `candidate-status-report-${timeFrame}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isLoading = caregiversLoading || appointmentsLoading || interviewsLoading || employeesLoading;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center">
              <ClipboardList className="mr-2 h-5 w-5 text-accent" />
              Candidate Interview Status
            </CardTitle>
            <p className="text-muted-foreground text-sm mt-1">
              Overview of the candidate pipeline from application to hire.
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={timeFrame} onValueChange={setTimeFrame}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select time frame" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_week">Last 7 Days</SelectItem>
                <SelectItem value="last_month">Last 30 Days</SelectItem>
                <SelectItem value="last_quarter">Last Quarter</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} disabled={reportData.length === 0}>
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="ml-4 text-muted-foreground">Loading report data...</p>
          </div>
        ) : reportData.length === 0 ? (
          <div className="text-center py-12 border-dashed border-2 rounded-lg">
            <ClipboardList className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Candidates Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">There are no candidates who applied in the selected time frame.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caregiver Name</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Phone Screen</TableHead>
                <TableHead>Phone Screen Passed</TableHead>
                <TableHead>Next Interview</TableHead>
                <TableHead>Hired</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.map((item) => (
                <TableRow key={item.caregiverId}>
                  <TableCell className="font-medium">{item.caregiverName}</TableCell>
                  <TableCell>{item.appliedDate ? format(item.appliedDate, "P") : "N/A"}</TableCell>
                  <TableCell>
                    {item.phoneScreenAppointmentDate ? (
                        <Badge variant="secondary" className="flex items-center w-fit">
                            <CalendarCheck className="mr-1 h-3 w-3 text-green-600"/> 
                            {format(item.phoneScreenAppointmentDate, "P")}
                        </Badge>
                    ) : (
                         <Badge variant="outline" className="flex items-center w-fit">
                            <CalendarX className="mr-1 h-3 w-3 text-red-600"/> Not Scheduled
                        </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.phoneScreenPassed === "Yes" && <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Yes</Badge>}
                    {item.phoneScreenPassed === "No" && <Badge variant="destructive">No</Badge>}
                    {!item.phoneScreenPassed && <Badge variant="outline">Pending</Badge>}
                  </TableCell>
                  <TableCell>
                    {item.nextInterviewDate ? (
                      <div className="flex flex-col">
                        <span>{format(item.nextInterviewDate, "P p")}</span>
                        <Badge variant="secondary" className="w-fit mt-1">{item.nextInterviewType}</Badge>
                      </div>
                    ) : (
                      <Badge variant="outline">N/A</Badge>
                    )}
                  </TableCell>
                   <TableCell>
                    {item.isHired ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 flex items-center w-fit">
                            <UserCheck className="mr-1 h-3 w-3"/> Yes
                        </Badge>
                    ) : (
                      <Badge variant="outline">No</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
