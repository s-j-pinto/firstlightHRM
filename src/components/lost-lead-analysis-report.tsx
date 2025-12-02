"use client";

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { Loader2, BarChart, XCircle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function LostLeadAnalysisReport() {
  const closedContactsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'initial_contacts'), where('status', '==', 'Closed')), 
    []
  );
  const { data: closedContacts, isLoading } = useCollection<any>(closedContactsQuery);

  const reasonData = useMemo(() => {
    if (!closedContacts) return [];

    const reasonCount: { [key: string]: { count: number, totalRate: number, rateCount: number } } = {};

    closedContacts.forEach(contact => {
      const reason = contact.closureReason || "Unknown";
      if (!reasonCount[reason]) {
        reasonCount[reason] = { count: 0, totalRate: 0, rateCount: 0 };
      }
      reasonCount[reason].count++;
      if (contact.rateOffered && contact.rateOffered > 0) {
        reasonCount[reason].totalRate += contact.rateOffered;
        reasonCount[reason].rateCount++;
      }
    });

    return Object.entries(reasonCount).map(([reason, data]) => ({
      reason,
      count: data.count,
      avgRate: data.rateCount > 0 ? (data.totalRate / data.rateCount).toFixed(2) : 'N/A',
    })).sort((a,b) => b.count - a.count);
  }, [closedContacts]);

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
        <CardTitle className="flex items-center gap-2"><XCircle /> Lost Lead Analysis</CardTitle>
        <CardDescription>
          Understanding why potential clients do not convert.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {reasonData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsBarChart data={reasonData} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="reason" type="category" width={200} interval={0} />
              <Tooltip formatter={(value, name, props) => [`${value} (Avg Rate: $${props.payload.avgRate})`, "Count"]} />
              <Bar dataKey="count" fill="#E07A5F" />
            </RechartsBarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground">No closed leads with reasons found.</p>
        )}
      </CardContent>
    </Card>
  );
}
