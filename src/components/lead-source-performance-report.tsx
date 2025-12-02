"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { Loader2, BarChart3 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

export default function LeadSourcePerformanceReport() {
  const contactsQuery = useMemoFirebase(() => query(collection(firestore, 'initial_contacts')), []);
  const { data: contacts, isLoading } = useCollection<any>(contactsQuery);

  const sourcePerformance = useMemo(() => {
    if (!contacts) return [];

    const performanceData: { [key: string]: { total: number, visits: number, closed: number, totalRate: number, rateCount: number } } = {};

    contacts.forEach(contact => {
      const source = contact.source || "Unknown";
      if (!performanceData[source]) {
        performanceData[source] = { total: 0, visits: 0, closed: 0, totalRate: 0, rateCount: 0 };
      }
      performanceData[source].total++;
      if (contact.inHomeVisitSet === 'Yes') {
        performanceData[source].visits++;
      }
      if (contact.status === 'Closed') {
        performanceData[source].closed++;
      }
      if (contact.rateOffered && contact.rateOffered > 0) {
        performanceData[source].totalRate += contact.rateOffered;
        performanceData[source].rateCount++;
      }
    });

    return Object.entries(performanceData).map(([source, data]) => ({
      source,
      ...data,
      visitRate: (data.visits / data.total) * 100,
      closureRate: (data.closed / data.total) * 100,
      avgRate: data.rateCount > 0 ? data.totalRate / data.rateCount : 0,
    })).sort((a,b) => b.total - a.total);
  }, [contacts]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 /> Lead Source Performance</CardTitle>
        <CardDescription>
          Analyzing the effectiveness of different lead sources based on conversion to an in-home visit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Total Leads</TableHead>
              <TableHead>In-Home Visits</TableHead>
              <TableHead>Visit Rate</TableHead>
              <TableHead>Avg. Rate Offered</TableHead>
              <TableHead>Closed Leads Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sourcePerformance.map(item => (
              <TableRow key={item.source}>
                <TableCell className="font-medium">{item.source}</TableCell>
                <TableCell>{item.total}</TableCell>
                <TableCell>{item.visits}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={item.visitRate} className="w-24" />
                    <span>{item.visitRate.toFixed(1)}%</span>
                  </div>
                </TableCell>
                <TableCell>${item.avgRate > 0 ? item.avgRate.toFixed(2) : 'N/A'}</TableCell>
                <TableCell>{item.closureRate.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}