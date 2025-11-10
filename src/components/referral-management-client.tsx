
"use client";

import * as React from "react";
import { useMemo, useState, useTransition } from "react";
import { collection, query } from "firebase/firestore";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import {
  Referral,
  Reward,
  Client,
  InitialContact,
} from "@/lib/types";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import {
  Loader2,
  Gift,
  RefreshCcw,
  CheckCircle,
  FileText,
  Users,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { updateReferralStatusAndCreateReward } from "@/lib/referral.actions";

type EnrichedReferral = Referral & {
  referrerName?: string;
  newClientInitialContact?: InitialContact;
};

const rewardSchema = z.object({
  newStatus: z.enum(["Pending", "Converted", "Rewarded"]),
  issueReward: z.boolean().default(false),
  rewardType: z.enum(["Discount", "Free Hours"]).optional(),
  amount: z.coerce.number().optional(),
  description: z.string().optional(),
});

type RewardFormData = z.infer<typeof rewardSchema>;

const StatusBadge = ({ status }: { status: string }) => {
  const colorClass =
    status === "Rewarded"
      ? "bg-green-500"
      : status === "Converted"
      ? "bg-blue-500"
      : "bg-yellow-500";
  return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
};

export default function ReferralManagementClient() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedReferral, setSelectedReferral] =
    useState<EnrichedReferral | null>(null);

  const form = useForm<RewardFormData>({
    resolver: zodResolver(rewardSchema),
    defaultValues: {
        issueReward: false
    }
  });

  const issueReward = form.watch('issueReward');

  // Fetch all necessary data
  const referralsQuery = useMemoFirebase(
    () => query(collection(firestore, "referrals")),
    []
  );
  const { data: referrals, isLoading: referralsLoading } =
    useCollection<Referral>(referralsQuery);

  const clientsQuery = useMemoFirebase(
    () => query(collection(firestore, "Clients")),
    []
  );
  const { data: clients, isLoading: clientsLoading } =
    useCollection<Client>(clientsQuery);

  const initialContactsQuery = useMemoFirebase(
    () => query(collection(firestore, "initial_contacts")),
    []
  );
  const { data: initialContacts, isLoading: contactsLoading } =
    useCollection<InitialContact>(initialContactsQuery);

  const enrichedReferrals = useMemo((): EnrichedReferral[] => {
    if (!referrals || !clients || !initialContacts) return [];
    
    const clientsMap = new Map(clients.map((c) => [c.id, c]));
    const contactsMap = new Map(initialContacts.map((c) => [c.id, c]));

    return referrals.map((ref) => ({
      ...ref,
      referrerName: clientsMap.get(ref.referrerClientId)?.["Client Name"],
      newClientInitialContact: contactsMap.get(ref.newClientInitialContactId),
    })).sort((a, b) => (b.createdAt as any) - (a.createdAt as any));
  }, [referrals, clients, initialContacts]);

  const handleOpenDialog = (referral: EnrichedReferral) => {
    setSelectedReferral(referral);
    form.reset({
      newStatus: referral.status as "Pending" | "Converted" | "Rewarded",
      issueReward: false,
      rewardType: "Discount",
      amount: 50,
      description: "50% off next month's service for successful referral.",
    });
  };
  
  const onSubmit = (data: RewardFormData) => {
    if (!selectedReferral) return;

    if (data.issueReward && (!data.rewardType || !data.amount || !data.description)) {
        toast({ title: 'Error', description: 'Please fill out all reward details when issuing a reward.', variant: 'destructive' });
        return;
    }
    
    startTransition(async () => {
        const result = await updateReferralStatusAndCreateReward({
            referralId: selectedReferral.id,
            newStatus: data.newStatus,
            issueReward: data.issueReward,
            rewardDetails: data.issueReward ? {
                rewardType: data.rewardType!,
                amount: data.amount!,
                description: data.description!,
            } : undefined,
            referrerClientId: selectedReferral.referrerClientId,
        });

        if(result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive'});
        } else {
            toast({ title: 'Success', description: result.message });
            setSelectedReferral(null);
        }
    })
  }

  const isLoading = referralsLoading || clientsLoading || contactsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>All Referrals</CardTitle>
          <CardDescription>
            A list of all referrals made by clients.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referred Client</TableHead>
                <TableHead>Referred By</TableHead>
                <TableHead>Referral Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrichedReferrals.length > 0 ? (
                enrichedReferrals.map((ref) => (
                  <TableRow key={ref.id}>
                    <TableCell>
                        <div className="font-medium">{ref.newClientName}</div>
                        <div className="text-sm text-muted-foreground">{ref.newClientInitialContact?.clientPhone}</div>
                    </TableCell>
                    <TableCell>{ref.referrerName || "Unknown"}</TableCell>
                    <TableCell>
                      {format((ref.createdAt as any).toDate(), "PP")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ref.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(ref)}
                      >
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No referrals found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog
        open={!!selectedReferral}
        onOpenChange={(isOpen) => !isOpen && setSelectedReferral(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Referral</DialogTitle>
            <DialogDescription>
              Update the status and issue a reward for this referral.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            <div className="p-4 border rounded-md bg-muted/50 space-y-2">
                <p><strong>Referred By:</strong> {selectedReferral?.referrerName}</p>
                <p><strong>New Client:</strong> {selectedReferral?.newClientName}</p>
                <p><strong>Referral Code Used:</strong> {selectedReferral?.referralCodeUsed}</p>
                <p><strong>Date:</strong> {selectedReferral ? format((selectedReferral.createdAt as any).toDate(), 'PP') : ''}</p>
            </div>

            <FormField
              control={form.control}
              name="newStatus"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>Update Status</Label>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Converted">Converted</SelectItem>
                      <SelectItem value="Rewarded">Rewarded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
            
            <FormField
              control={form.control}
              name="issueReward"
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="issueReward" checked={field.value} onChange={e => field.onChange(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent" />
                  <Label htmlFor="issueReward" className="font-medium">
                    Issue Reward for this Conversion
                  </Label>
                </div>
              )}
            />
            
            {issueReward && (
                <Card className="bg-green-500/10 border-green-500/50">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Gift className="text-green-600"/> Reward Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="rewardType" render={({field}) => (
                           <div className="space-y-2">
                                <Label>Reward Type</Label>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Discount">Discount</SelectItem>
                                        <SelectItem value="Free Hours">Free Hours</SelectItem>
                                    </SelectContent>
                                </Select>
                           </div>
                        )} />
                        <FormField control={form.control} name="amount" render={({field}) => (
                            <div className="space-y-2">
                                <Label>Amount (e.g., 50 for discount, 4 for hours)</Label>
                                <Input type="number" {...field} />
                            </div>
                        )} />
                        <FormField control={form.control} name="description" render={({field}) => (
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input {...field} />
                            </div>
                        )} />
                    </CardContent>
                </Card>
            )}

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
