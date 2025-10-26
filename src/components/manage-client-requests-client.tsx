
"use client";

import { useState, useMemo, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { ClientCareRequest } from '@/lib/types';
import { updateCareRequestStatus } from '@/lib/client-care-request.actions';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar, Clock, User, FileText, MessageSquare } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const updateStatusSchema = z.object({
  status: z.enum(["reviewed", "scheduled", "denied"]),
  adminNotes: z.string().optional(),
});

type UpdateStatusFormData = z.infer<typeof updateStatusSchema>;

export default function ManageClientRequestsClient() {
  const [selectedRequest, setSelectedRequest] = useState<ClientCareRequest | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const requestsRef = useMemoFirebase(() => collection(firestore, 'client_additional_care_requests'), [firestore]);
  const { data: requestsData, isLoading } = useCollection<ClientCareRequest>(requestsRef);

  const form = useForm<UpdateStatusFormData>({
    resolver: zodResolver(updateStatusSchema),
  });

  const sortedRequests = useMemo(() => {
    if (!requestsData) return [];
    return requestsData.sort((a, b) => {
      const statusOrder = { pending: 0, reviewed: 1, scheduled: 2, denied: 3 };
      if (statusOrder[a.status] !== statusOrder[b.status]) {
        return statusOrder[a.status] - statusOrder[b.status];
      }
      return (b.createdAt as any).toDate() - (a.createdAt as any).toDate();
    });
  }, [requestsData]);

  const handleSelectRequest = (request: ClientCareRequest) => {
    setSelectedRequest(request);
    form.reset({
      status: request.status === 'pending' ? 'reviewed' : request.status,
      adminNotes: request.adminNotes || '',
    });
  };

  const onSubmit = (data: UpdateStatusFormData) => {
    if (!selectedRequest) return;

    startTransition(async () => {
      const result = await updateCareRequestStatus({
        requestId: selectedRequest.id,
        status: data.status,
        adminNotes: data.adminNotes || '',
      });

      if (result.error) {
        toast({ title: "Update Failed", description: result.message, variant: "destructive" });
      } else {
        toast({ title: "Update Successful", description: result.message });
        setSelectedRequest(null);
      }
    });
  };

  const StatusBadge = ({ status }: { status: ClientCareRequest['status'] }) => {
    const colorClass =
      status === 'pending' ? 'bg-yellow-500' :
      status === 'reviewed' ? 'bg-blue-500' :
      status === 'scheduled' ? 'bg-green-500' :
      status === 'denied' ? 'bg-red-500' :
      'bg-gray-500';
    return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
        <p className="ml-4 text-muted-foreground">Loading client requests...</p>
      </div>
    );
  }

  return (
    <div>
      {sortedRequests.length === 0 ? (
        <Card className="text-center py-16">
          <CardHeader>
            <CardTitle>No Requests Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">There are currently no additional care requests from clients.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedRequests.map(request => (
            <Card key={request.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleSelectRequest(request)}>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  {request.clientName}
                  <StatusBadge status={request.status} />
                </CardTitle>
                <CardDescription>
                  Requested on {format((request.createdAt as any).toDate(), 'PP')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> <strong>Preferred Date:</strong> {format((request.preferredDateTime as any).toDate(), 'PP')}</p>
                <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /> <strong>Time:</strong> {format((request.preferredDateTime as any).toDate(), 'p')}</p>
                <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> <strong>Urgency:</strong> {request.urgency}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedRequest} onOpenChange={(isOpen) => !isOpen && setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-2xl">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>Care Request from {selectedRequest.clientName}</DialogTitle>
                <DialogDescription>
                  Review the details below and update the status of the request.
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto p-1">
                <Card className="my-4">
                  <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText /> Request Details</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p><strong>Client Email:</strong> {selectedRequest.clientEmail}</p>
                    <p><strong>Preferred Date & Time:</strong> {format((selectedRequest.preferredDateTime as any).toDate(), 'PPPPp')}</p>
                    <p><strong>Requested Duration:</strong> {selectedRequest.duration}</p>
                    <p><strong>Urgency:</strong> {selectedRequest.urgency}</p>
                    <p><strong>Preferred Caregiver:</strong> {selectedRequest.preferredCaregiver}</p>
                    <div>
                      <strong>Reason for Request:</strong>
                      <p className="p-3 bg-muted rounded-md mt-1 whitespace-pre-wrap">{selectedRequest.reason}</p>
                    </div>
                  </CardContent>
                </Card>

                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Update Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a new status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="reviewed">Reviewed</SelectItem>
                              <SelectItem value="scheduled">Scheduled</SelectItem>
                              <SelectItem value="denied">Denied</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="adminNotes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2"><MessageSquare /> Admin Notes</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Add internal notes about this request..." {...field} rows={4} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <DialogFooter className="pt-4">
                        <DialogClose asChild>
                          <Button type="button" variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button type="submit" disabled={isPending}>
                          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Update Request
                        </Button>
                      </DialogFooter>
                  </form>
                </Form>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
