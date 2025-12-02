"use client";

import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { Loader2, TrendingUp, Users, Home, FileSignature, FileCheck } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function LeadConversionFunnelReport() {
  const contactsQuery = useMemoFirebase(() => query(collection(firestore, 'initial_contacts')), []);
  const { data: contacts, isLoading: contactsLoading } = useCollection<any>(contactsQuery);

  const signupsQuery = useMemoFirebase(() => query(collection(firestore, 'client_signups')), []);
  const { data: signups, isLoading: signupsLoading } = useCollection<any>(signupsQuery);

  const funnelData = useMemo(() => {
    if (!contacts || !signups) return [];

    const totalLeads = contacts.length;
    const visitsScheduled = contacts.filter(c => c.inHomeVisitSet === 'Yes').length;
    
    const contactIdsWithCsa = new Set(signups.map(s => s.initialContactId));
    const csaCreated = contacts.filter(c => contactIdsWithCsa.has(c.id)).length;

    const csaSent = signups.filter(s => s.status === 'Pending Client Signatures' || s.status === 'Client Signatures Completed' || s.status === 'Signed and Published').length;
    const csaSigned = signups.filter(s => s.status === 'Client Signatures Completed' || s.status === 'Signed and Published').length;
    const published = signups.filter(s => s.status === 'Signed and Published').length;
    
    return [
      { name: 'Total Leads', value: totalLeads, fill: '#8884d8' },
      { name: 'In-Home Visit Scheduled', value: visitsScheduled, fill: '#83a6ed' },
      { name: 'CSA Created', value: csaCreated, fill: '#8dd1e1' },
      { name: 'CSA Sent for Signature', value: csaSent, fill: '#82ca9d' },
      { name: 'CSA Signed by Client', value: csaSigned, fill: '#a4de6c' },
      { name: 'Signed & Published', value: published, fill: '#d0ed57' },
    ];
  }, [contacts, signups]);

  const isLoading = contactsLoading || signupsLoading;

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
        <CardTitle className="flex items-center gap-2"><TrendingUp /> Lead Conversion Funnel</CardTitle>
        <CardDescription>
          Visualizing the client journey from initial contact to a signed agreement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {funnelData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={funnelData} isAnimationActive>
                <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
                 <LabelList position="center" fill="#fff" stroke="none" dataKey="value" formatter={(value: number) => `${value}`} />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-muted-foreground">No data available to display the funnel.</p>
        )}
      </CardContent>
    </Card>
  );
}
