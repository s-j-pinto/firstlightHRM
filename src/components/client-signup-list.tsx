
"use client";

import { useMemo, useState } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { format, subDays, isAfter } from 'date-fns';
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { CampaignTemplate } from '@/lib/types';

const intakeStatuses = [
    "New",
    "In-Home Visit Scheduled",
    "Assessment Complete",
    "Incomplete",
    "Pending Client Signatures",
    "Client Signatures Completed",
    "Signed and Published",
    "Closed",
    "Archived",
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

// Helper to safely convert Firestore Timestamps or serialized strings to Date objects
const safeToDate = (value: any): Date | null => {
    if (!value) return null;
    // Check for Firestore Timestamp (both on server and serialized on client)
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    // Check for serialized Timestamp format from server
    if (typeof value === 'object' && 'seconds' in value && 'nanoseconds' in value) {
        return new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
    }
    // Handle string or number representations
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return null;
};


export default function ClientSignupList() {
  const pathname = usePathname();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<DateRangeKey>('last_month');
  const [showClosed, setShowClosed] = useState(false);
  
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

  const templatesQuery = useMemoFirebase(() => 
    query(collection(firestore, 'campaign_templates')),
    []
  );
  const { data: templates, isLoading: templatesLoading } = useCollection<CampaignTemplate>(templatesQuery);

  const templatesMap = useMemo(() => {
    if (!templates) return new Map();
    return new Map(templates.map(t => [t.id, t.name]));
  }, [templates]);

  const unifiedIntakeList = useMemo(() => {
    if (!contacts) return [];

    const signupsMap = new Map(signups?.map(s => [s.initialContactId, s]) || []);

    const allIntakes = contacts.map(contact => {
      const signup = signupsMap.get(contact.id);
      let status = signup?.status || contact.status || "New";
      
      if (status === 'Pending Client Signatures' && signup?.signatureReminderSent) {
          status = 'Pending (Reminder Sent)';
      }

      const emailFollowups = (contact.followUpHistory || [])
        .map((entry: any) => templatesMap.get(entry.templateId))
        .filter(Boolean);
        
      const allFollowups = [...emailFollowups];
      if (contact.smsFollowUpSent) {
        allFollowups.unshift("1-Hour SMS Follow-up"); // Add SMS to the beginning
      }

      return {
        id: contact.id,
        signupId: signup?.id,
        clientName: contact.clientName || 'N/A',
        clientPhone: contact.clientPhone || 'N/A',
        clientAddress: contact.clientAddress || '',
        clientCity: contact.city || '',
        createdAt: contact.createdAt,
        status: status,
        source: contact.source || 'N/A',
        followupsSent: allFollowups,
      };
    });

    // Apply filters
    const filteredIntakes = allIntakes.filter(item => {
        if (!showClosed && (item.status === 'Closed' || item.status === 'Archived')) {
            return false;
        }

        const statusMatch = statusFilter === 'ALL' || item.status === statusFilter || (statusFilter === 'Pending Client Signatures' && item.status === 'Pending (Reminder Sent)');
        if (!statusMatch) return false;

        if (dateFilter === 'all_time') return true;
        
        const days = dateRanges[dateFilter].days;
        const cutoffDate = subDays(new Date(), days);
        const itemDate = safeToDate(item.createdAt);
        
        return itemDate && isAfter(itemDate, cutoffDate);
    });

    return filteredIntakes;

  }, [contacts, signups, statusFilter, dateFilter, showClosed, templatesMap]);

  const baseEditPath = pathname.includes('/admin') ? '/admin/initial-contact' : '/owner/initial-contact';
  const csaBasePath = pathname.includes('/admin') ? '/admin/new-client-signup' : '/owner/new-client-signup';
  const isLoading = contactsLoading || signupsLoading || templatesLoading;

  const StatusBadge = ({ status }: { status: string }) => {
    const colorClass = 
        status === 'Signed and Published' ? 'bg-green-500' :
        status === 'Client Signatures Completed' ? 'bg-blue-500' :
        status === 'Pending Client Signatures' || status === 'Pending (Reminder Sent)' ? 'bg-yellow-500' :
        status === 'In-Home Visit Scheduled' ? 'bg-teal-500' :
        status === 'Assessment Complete' ? 'bg-indigo-500' :
        status === 'New' ? 'bg-sky-500' :
        status === 'Closed' ? 'bg-red-500' :
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
                <div className="flex items-center space-x-2">
                    <Checkbox id="show-closed" checked={showClosed} onCheckedChange={(checked) => setShowClosed(checked as boolean)} />
                    <Label htmlFor="show-closed" className="whitespace-nowrap">Show Closed/Archived</Label>
                </div>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client Name</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Follow-ups Sent</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unifiedIntakeList.length > 0 ? (
              unifiedIntakeList.map(item => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.clientName}</div>
                    <div className="text-sm text-muted-foreground">{item.clientAddress}</div>
                    <div className="text-sm text-muted-foreground">{item.clientCity}</div>
                  </TableCell>
                  <TableCell>
                    {item.createdAt ? format(safeToDate(item.createdAt) || new Date(), 'PPp') : 'N/A'}
                  </TableCell>
                  <TableCell>{item.source}</TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.followupsSent.map((followupName: string) => (
                        <Badge key={followupName} variant="secondary">{followupName}</Badge>
                      ))}
                    </div>
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
                <TableCell colSpan={7} className="h-24 text-center">
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
