
"use client";

import { useState, useMemo } from "react";
import { format, subDays, subMonths, subQuarters, subYears, startOfDay, endOfDay } from "date-fns";
import { collection } from "firebase/firestore";
import { Loader2, CalendarX2, FileText } from "lucide-react";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";

import type { Appointment, CaregiverProfile } from "@/lib/types";
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

type CancelledAppointmentWithCaregiver = Appointment & { caregiver?: CaregiverProfile } & { 
    cancelDateTime: Date, 
    cancelReason: string 
};


const isCancelledAppointment = (appt: Appointment & { caregiver?: CaregiverProfile }): appt is CancelledAppointmentWithCaregiver => {
    return appt.appointmentStatus === "cancelled" && !!appt.cancelDateTime && !!appt.caregiver && !!appt.cancelReason;
}

export default function CancelledInterviewsReport() {
  const [timeFrame, setTimeFrame] = useState("last_month");
  
  const appointmentsRef = useMemoFirebase(() => collection(firestore, "appointments"), []);
  const { data: appointmentsData, isLoading: appointmentsLoading } = useCollection<Appointment>(appointmentsRef);

  const caregiverProfilesRef = useMemoFirebase(() => collection(firestore, 'caregiver_profiles'), []);
  const { data: caregiversData, isLoading: caregiversLoading } = useCollection<CaregiverProfile>(caregiverProfilesRef);

  const filteredAppointments = useMemo(() => {
    if (!appointmentsData || !caregiversData) return [];
    
    const caregiversMap = new Map(caregiversData.map(c => [c.id, c]));

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

    return appointmentsData
      .map(appt => ({
          ...appt,
          cancelDateTime: (appt.cancelDateTime as any)?.toDate(),
          caregiver: caregiversMap.get(appt.caregiverId),
      }))
      .filter(isCancelledAppointment)
      .filter(appt => appt.cancelDateTime >= startOfFilterDate)
      .sort((a, b) => b.cancelDateTime.getTime() - a.cancelDateTime.getTime());

  }, [appointmentsData, caregiversData, timeFrame]);

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Caregiver Name,Email,Cancelled Date,Reason\n";
    filteredAppointments.forEach(appt => {
        const row = [
            `"${appt.caregiver?.fullName}"`,
            `"${appt.caregiver?.email}"`,
            `"${format(appt.cancelDateTime, "yyyy-MM-dd HH:mm")}"`,
            `"${appt.cancelReason}"`
        ].join(",");
        csvContent += row + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cancelled-interviews-report-${timeFrame}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  const isLoading = appointmentsLoading || caregiversLoading;

  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
                 <CardTitle className="flex items-center">
                    <CalendarX2 className="mr-2 h-5 w-5 text-accent" />
                    Cancelled Interviews
                </CardTitle>
                <p className="text-muted-foreground text-sm mt-1">Review appointments that have been cancelled.</p>
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
                 <Button variant="outline" onClick={handleExport} disabled={filteredAppointments.length === 0}>
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
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12 border-dashed border-2 rounded-lg">
            <CalendarX2 className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No Cancelled Appointments</h3>
            <p className="mt-1 text-sm text-muted-foreground">There are no cancelled appointments in the selected time frame.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Caregiver Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>Cancelled Date</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAppointments.map((appt) => (
                <TableRow key={appt.id}>
                  <TableCell>{appt.caregiver?.fullName}</TableCell>
                  <TableCell>{appt.caregiver?.email}</TableCell>
                  <TableCell>{format(appt.cancelDateTime, "PPp")}</TableCell>
                  <TableCell>{appt.cancelReason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
