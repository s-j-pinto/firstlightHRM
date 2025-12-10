
"use client";

import { useMemo } from 'react';
import { collection, query, where } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { Loader2, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { Interview } from '@/lib/types';

export default function GhostingTrendsReport() {
  const noShowQuery = useMemoFirebase(() => 
    query(collection(firestore, 'interviews'), where('finalInterviewStatus', '==', 'No Show')),
    []
  );
  const { data: noShowInterviews, isLoading } = useCollection<Interview>(noShowQuery);

  const chartData = useMemo(() => {
    if (!noShowInterviews) return [];

    const monthlyCounts: { [key: string]: number } = {};

    noShowInterviews.forEach(interview => {
      // The appointment cancellation date is what determines when they were marked as a no-show
      const date = (interview.cancelDateTime as any)?.toDate();
      if (date) {
        const month = format(date, 'MMM yyyy');
        if (!monthlyCounts[month]) {
          monthlyCounts[month] = 0;
        }
        monthlyCounts[month]++;
      }
    });

    return Object.entries(monthlyCounts)
      .map(([name, count]) => ({ name, 'No Shows': count }))
      .sort((a, b) => {
        const dateA = new Date(a.name);
        const dateB = new Date(b.name);
        return dateA.getTime() - dateB.getTime();
      });
  }, [noShowInterviews]);

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
        <CardTitle className="flex items-center gap-2"><TrendingUp /> Ghosting Trends by Month</CardTitle>
        <CardDescription>
          A monthly breakdown of the number of candidates who did not show up for their scheduled phone screen.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="No Shows" fill="#E07A5F" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground py-10">No "No Show" data available to display trends.</p>
        )}
      </CardContent>
    </Card>
  );
}
