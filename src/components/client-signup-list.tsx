"use client";

import { useMemo } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { format } from 'date-fns';
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
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

export default function ClientSignupList() {
  const pathname = usePathname();
  
  // 1. Fetch all initial contacts, ordered by creation date
  const contactsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'initial_contacts'), orderBy('createdAt', 'desc')),
    []
  );
  const { data: contacts, isLoading: contactsLoading } = useCollection<any>(contactsQuery);

  // 2. Fetch all client signups
  const signupsQuery = useMemoFirebase(() => 
    query(collection(firestore, 'client_signups')),
    []
  );
  const { data: signups, isLoading: signupsLoading } = useCollection<any>(signupsQuery);

  // 3. Perform the client-side join and create a unified list
  const unifiedIntakeList = useMemo(() => {
    if (!contacts) return [];

    // Create a map of signups for efficient lookup
    const signupsMap = new Map(signups?.map(s => [s.initialContactId, s]) || []);

    return contacts.map(contact => {
      const signup = signupsMap.get(contact.id);
      
      const status = signup?.status || "INITIAL PHONE CONTACT COMPLETED";
      
      return {
        id: contact.id, // Use contact ID as the key
        signupId: signup?.id, // Pass signupId if it exists
        clientName: contact.clientName || 'N/A',
        clientPhone: contact.clientPhone || 'N/A',
        clientAddress: contact.clientAddress ? `${contact.clientAddress}, ${contact.city || ''}` : 'N/A',
        createdAt: contact.createdAt,
        status: status,
      };
    });
  }, [contacts, signups]);

  const baseEditPath = pathname.includes('/admin') ? '/admin/initial-contact' : '/owner/initial-contact';
  const csaBasePath = pathname.includes('/admin') ? '/admin/new-client-signup' : '/owner/new-client-signup';
  const isLoading = contactsLoading || signupsLoading;

  const StatusBadge = ({ status }: { status: string }) => {
    const colorClass = 
        status === 'SIGNED AND PUBLISHED' ? 'bg-green-500' :
        status === 'CLIENT_SIGNATURES_COMPLETED' ? 'bg-blue-500' :
        status === 'PENDING CLIENT SIGNATURES' ? 'bg-yellow-500' :
        status === 'INITIAL PHONE CONTACT COMPLETED' ? 'bg-purple-500' :
        'bg-gray-500';

    return <Badge className={cn("text-white", colorClass)}>{status.replace(/_/g, ' ')}</Badge>;
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
        <CardTitle>Client Intake Documents</CardTitle>
        <CardDescription>
          A unified list of all client intake forms from initial contact to final signature.
        </CardDescription>
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
                  No intake documents found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
