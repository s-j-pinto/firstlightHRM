"use client";

import { useMemo, useState } from 'react';
import { collection, query } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import {
  Referral,
  Reward,
  Client,
  InitialContact,
} from "@/lib/types";
import { format } from 'date-fns';

import {
  Loader2,
  Gift,
  Ticket,
  Users,
  Search
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
import { Badge } from "@/components/ui/badge";
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


type EnrichedReferral = Referral & {
  referrerName?: string;
  newClientInitialContact?: InitialContact;
};

const ReferralStatusBadge = ({ status }: { status: string }) => {
  const colorClass =
    status === "Rewarded"
      ? "bg-green-500"
      : status === "Converted"
      ? "bg-blue-500"
      : "bg-yellow-500";
  return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
};

const RewardStatusBadge = ({ status }: { status: string }) => {
    const colorClass = status === 'Applied' ? 'bg-green-500' : status === 'Available' ? 'bg-blue-500' : 'bg-gray-500';
    return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
};


export default function ReferralsRewardsReport() {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all necessary data
  const referralsQuery = useMemoFirebase(() => query(collection(firestore, "referrals")), []);
  const { data: referrals, isLoading: referralsLoading } = useCollection<Referral>(referralsQuery);

  const rewardsQuery = useMemoFirebase(() => query(collection(firestore, "rewards")), []);
  const { data: rewards, isLoading: rewardsLoading } = useCollection<Reward>(rewardsQuery);

  const clientsQuery = useMemoFirebase(() => query(collection(firestore, "Clients")), []);
  const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);
  
  const clientsMap = useMemo(() => {
    if (!clients) return new Map();
    return new Map(clients.map((c) => [c.id, c]));
  }, [clients]);

  const initialContactsQuery = useMemoFirebase(() => query(collection(firestore, "initial_contacts")), []);
  const { data: initialContacts, isLoading: contactsLoading } = useCollection<InitialContact>(initialContactsQuery);

  const enrichedReferrals = useMemo((): EnrichedReferral[] => {
    if (!referrals || !clients || !initialContacts) return [];
    const contactsMap = new Map(initialContacts.map((c) => [c.id, c]));

    return referrals.map((ref) => ({
      ...ref,
      referrerName: clientsMap.get(ref.referrerClientId)?.["Client Name"],
      newClientInitialContact: contactsMap.get(ref.newClientInitialContactId),
    })).sort((a, b) => (b.createdAt as any) - (a.createdAt as any));
  }, [referrals, clients, initialContacts, clientsMap]);
  
  const enrichedRewards = useMemo(() => {
      if (!rewards || !clientsMap) return [];
      return rewards.map(rew => ({
          ...rew,
          clientName: clientsMap.get(rew.clientId)?.["Client Name"]
      })).sort((a, b) => (b.createdAt as any) - (a.createdAt as any));
  }, [rewards, clientsMap]);

  const filteredReferrals = useMemo(() => {
      if (!searchTerm) return enrichedReferrals;
      const lowercasedTerm = searchTerm.toLowerCase();
      return enrichedReferrals.filter(r => 
        r.newClientName?.toLowerCase().includes(lowercasedTerm) || 
        r.referrerName?.toLowerCase().includes(lowercasedTerm)
    );
  }, [enrichedReferrals, searchTerm]);
  
  const filteredRewards = useMemo(() => {
      if (!searchTerm) return enrichedRewards;
      const lowercasedTerm = searchTerm.toLowerCase();
      return enrichedRewards.filter(r => r.clientName?.toLowerCase().includes(lowercasedTerm));
  }, [enrichedRewards, searchTerm]);

  const isLoading = referralsLoading || rewardsLoading || clientsLoading || contactsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <Card>
        <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <CardTitle>Referrals & Rewards Status</CardTitle>
                    <CardDescription>
                        A comprehensive overview of all referral activities and rewards issued.
                    </CardDescription>
                </div>
                 <div className="relative w-full sm:w-[300px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search by client name..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="referrals">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="referrals"><Users className="mr-2" />Referrals</TabsTrigger>
                    <TabsTrigger value="rewards"><Gift className="mr-2" />Rewards</TabsTrigger>
                </TabsList>
                <TabsContent value="referrals">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Referred Client</TableHead>
                            <TableHead>Referred By</TableHead>
                            <TableHead>Referral Date</TableHead>
                            <TableHead>Code Used</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {filteredReferrals.length > 0 ? (
                            filteredReferrals.map((ref) => (
                            <TableRow key={ref.id}>
                                <TableCell>
                                    <div className="font-medium">{ref.newClientName}</div>
                                    <div className="text-sm text-muted-foreground">{ref.newClientInitialContact?.clientPhone}</div>
                                </TableCell>
                                <TableCell>{ref.referrerName || "Unknown"}</TableCell>
                                <TableCell>{format((ref.createdAt as any).toDate(), "PP")}</TableCell>
                                <TableCell><Badge variant="outline">{ref.referralCodeUsed}</Badge></TableCell>
                                <TableCell><ReferralStatusBadge status={ref.status} /></TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">No referrals found.</TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </TabsContent>
                 <TabsContent value="rewards">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Client</TableHead>
                                <TableHead>Reward</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Earned On</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {filteredRewards.length > 0 ? (
                                filteredRewards.map((rew) => (
                                <TableRow key={rew.id}>
                                    <TableCell>{rew.clientName}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{rew.description}</div>
                                        <div className="text-sm text-muted-foreground">Type: {rew.rewardType}</div>
                                    </TableCell>
                                    <TableCell>{rew.rewardType === 'Discount' ? `$${rew.amount}` : `${rew.amount} hrs`}</TableCell>
                                    <TableCell>{format((rew.createdAt as any).toDate(), "PP")}</TableCell>
                                    <TableCell><RewardStatusBadge status={rew.status} /></TableCell>
                                </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center">No rewards found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TabsContent>
            </Tabs>
        </CardContent>
    </Card>
  );
}
