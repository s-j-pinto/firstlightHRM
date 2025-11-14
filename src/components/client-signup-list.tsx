
"use client";

import { useMemo, useState } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { format, subDays, subMonths, isAfter } from 'date-fns';
import { Loader2, ChevronRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

const intakeStatuses = [
    "Initial Phone Contact Completed",
    "In-Home Visit Scheduled",
    "App Referral Received",
    "Google Ads Lead Received",
    "Incomplete",
    "Pending Client Signatures",
    "Client Signatures Completed",
    "Signed and Published",
];

const dateRanges = {
    'last_week': { label: 'Last Week', days: 7 },
    'last_2_weeks': { label: 'Last 2 Weeks', days: 14 },
    'last_month': { label: 'Last Month', days: 30 },
    'last_quarter': { label: 'Last Quarter', days: 90 },
    'last_6_months': { label: 'Last 6 Months', days: 180 },
    'all_time': { label: 'All Time', days: -1 },
};

type DateRangeKey = keyof typeof dateRanges;

export default function ClientSignupList() {
  const pathname = usePathname();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeKey>('last_month');
  
  const contactsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'initial_contacts'), orderBy('createdAt', 'desc')),
    []
  );
  const { data: contacts, isLoading: contactsLoading } = useCollection<any>(contactsQuery);

  const signupsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'client_signups')),
    []
  );
  const { data: signups, isLoading: signupsLoading } = useCollection<any>(signupsQuery);

  const unifiedIntakeList = useMemo(() => {
    if (!contacts) return [];

    const signupsMap = new Map(signups?.map(s => [s.initialContactId, s]) || []);

    const allIntakes = contacts.map(contact => {
      const signup = signupsMap.get(contact.id);
      const status = signup?.status || contact.status || "Initial Phone Contact Completed";
      
      return {
        id: contact.id,
        signupId: signup?.id,
        clientName: contact.clientName || 'N/A',
        clientPhone: contact.clientPhone || 'N/A',
        clientAddress: contact.clientAddress ? `${contact.clientAddress}, ${contact.city || ''}` : 'N/A',
        createdAt: contact.createdAt,
        status: status,
      };
    });

    // Apply filters
    const filteredIntakes = allIntakes.filter(item => {
        const statusMatch = statusFilter === 'ALL' || item.status === statusFilter;
        if (!statusMatch) return false;

        if (dateFilter === 'all_time') return true;
        
        const days = dateRanges[dateFilter].days;
        const cutoffDate = subDays(new Date(), days);
        const itemDate = item.createdAt?.toDate();
        
        return itemDate && isAfter(itemDate, cutoffDate);
    });

    return filteredIntakes;

  }, [contacts, signups, statusFilter, dateFilter]);

  const baseEditPath = pathname.includes('/admin') ? '/admin/initial-contact' : '/owner/initial-contact';
  const csaBasePath = pathname.includes('/admin') ? '/admin/new-client-signup' : '/owner/new-client-signup';
  const isLoading = contactsLoading || signupsLoading;

  const StatusBadge = ({ status }: { status: string }) => {
    const colorClass = 
        status === 'Signed and Published' ? 'bg-green-500' :
        status === 'Client Signatures Completed' ? 'bg-blue-500' :
        status === 'Pending Client Signatures' ? 'bg-yellow-500' :
        status === 'In-Home Visit Scheduled' ? 'bg-teal-500' :
        status === 'Google Ads Lead Received' ? 'bg-sky-500' :
        status === 'Initial Phone Contact Completed' ? 'bg-purple-500' :
        'bg-gray-500';

    return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading intake documents...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
                <CardTitle>Client Intake Documents</CardTitle>
                <CardDescription>
                A unified list of all client intake forms from initial contact to final signature.
                </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[240px]">
                        <SelectValue placeholder="Filter by status..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">All Statuses</SelectItem>
                        {intakeStatuses.map(status => (
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateRangeKey)}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Filter by date..." />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(dateRanges).map(([key, { label }]) => (
                             <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unifiedIntakeList.length > 0 ? (
              unifiedIntakeList.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.clientName}</TableCell>
                  <TableCell>{item.clientPhone}</TableCell>
                  <TableCell>{item.clientAddress}</TableCell>
                  <TableCell>
                    {item.createdAt ? format((item.createdAt as any).toDate(), 'PPp') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-right space-y-1">
                    <Link href={`${baseEditPath}?contactId=${item.id}`} className="flex items-center justify-end text-accent hover:underline">
                      Open Intake <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                    {item.signupId && (
                      <Link href={`${csaBasePath}?signupId=${item.signupId}`} className="flex items-center justify-end text-accent hover:underline">
                        <FileText className="h-4 w-4 mr-1" /> Open CSA <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No intake documents found with the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
