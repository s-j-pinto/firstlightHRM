
"use client";

import * as React from 'react';
import { useUser, firestore, useCollection, useMemoFirebase } from "@/firebase";
import { Loader2, ArrowLeft, Gift, Clipboard, Send, Star, Ticket, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { collection, query, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sendReferralInvite } from '@/lib/referral.actions';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { HelpDialog } from '@/components/HelpDialog';

const referralInviteSchema = z.object({
    friendEmail: z.string().email("Please enter a valid email address."),
    friendName: z.string().min(1, "Please enter your friend's name."),
    personalMessage: z.string().optional(),
});
type ReferralInviteFormData = z.infer<typeof referralInviteSchema>;

export default function ReferralsPage() {
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSending, startSendingTransition] = React.useTransition();
  const [clientId, setClientId] = React.useState<string | null>(null);
  const [clientName, setClientName] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchClaims = async () => {
        if (user) {
            const tokenResult = await user.getIdTokenResult();
            setClientId(tokenResult.claims.clientId as string || null);
            setClientName(tokenResult.claims.name as string || user.displayName || null);
        }
    };
    if (user) {
        fetchClaims();
    }
  }, [user]);

  const profileQuery = useMemoFirebase(() => clientId ? query(collection(firestore, 'referral_profiles'), where('clientId', '==', clientId)) : null, [clientId]);
  const { data: profileData, isLoading: profileLoading } = useCollection<any>(profileQuery);
  const referralProfile = profileData?.[0];

  const referralsQuery = useMemoFirebase(() => clientId ? query(collection(firestore, 'referrals'), where('referrerClientId', '==', clientId)) : null, [clientId]);
  const { data: referrals, isLoading: referralsLoading } = useCollection<any>(referralsQuery);
  
  const rewardsQuery = useMemoFirebase(() => clientId ? query(collection(firestore, 'rewards'), where('clientId', '==', clientId)) : null, [clientId]);
  const { data: rewards, isLoading: rewardsLoading } = useCollection<any>(rewardsQuery);

  const form = useForm<ReferralInviteFormData>({
    resolver: zodResolver(referralInviteSchema),
    defaultValues: { friendEmail: '', friendName: '', personalMessage: '' }
  });

  const handleCopyCode = () => {
    if (!referralProfile?.referralCode) return;
    navigator.clipboard.writeText(referralProfile.referralCode);
    toast({
      title: "Copied!",
      description: "Your referral code has been copied to the clipboard.",
    });
  };

  const onInviteSubmit = (data: ReferralInviteFormData) => {
    if (!referralProfile || !clientName) {
        toast({ title: 'Error', description: 'Could not find your referral information. Please try again.', variant: 'destructive'});
        return;
    };
    startSendingTransition(async () => {
        const result = await sendReferralInvite({
            ...data,
            referrerName: clientName,
            referralCode: referralProfile.referralCode,
        });

        if (result.error) {
            toast({ title: "Error", description: result.message, variant: "destructive" });
        } else {
            toast({ title: "Success", description: result.message });
            form.reset();
        }
    });
  };
  
  const RewardStatusBadge = ({ status }: { status: string }) => {
    const colorClass = status === 'Applied' ? 'bg-green-500' : status === 'Available' ? 'bg-blue-500' : 'bg-gray-500';
    return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
  };
  
  const ReferralStatusBadge = ({ status }: { status: string }) => {
    const colorClass = status === 'Converted' || status === 'Rewarded' ? 'bg-green-500' : 'bg-yellow-500';
    return <Badge className={cn("text-white", colorClass)}>{status}</Badge>;
  }

  const isLoading = isUserLoading || profileLoading || referralsLoading || rewardsLoading;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline mb-2 flex items-center gap-2"><Gift /> Referral Program</h1>
          <p className="text-muted-foreground">Know another family member or friend who might benefit from compassionate home care? Refer them easily and you both will receive 2 free hours of care each when they sign up for atleast 30 hours of service as a thank-you credit.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/client/dashboard">
                <ArrowLeft className="mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <HelpDialog topic="clientReferrals" />
        </div>
      </div>
      
       {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Your Referral Code</CardTitle>
                        <CardDescription>Share this code with friends. They can use it when they first contact us.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {referralProfile?.referralCode ? (
                            <div className="flex items-center space-x-2">
                                <Input value={referralProfile.referralCode} readOnly className="font-mono text-lg" />
                                <Button onClick={handleCopyCode} variant="outline" size="icon">
                                    <Clipboard className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                             <p className="text-sm text-muted-foreground text-center py-4">Your referral code is not yet active. Please check back later.</p>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Invite a Friend</CardTitle>
                        <CardDescription>Send an invitation directly to your friend&apos;s email.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={form.handleSubmit(onInviteSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="friendName">Friend&apos;s Name</Label>
                                    <Input id="friendName" {...form.register('friendName')} />
                                    {form.formState.errors.friendName && <p className="text-sm text-destructive">{form.formState.errors.friendName.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="friendEmail">Friend&apos;s Email</Label>
                                    <Input id="friendEmail" type="email" {...form.register('friendEmail')} />
                                    {form.formState.errors.friendEmail && <p className="text-sm text-destructive">{form.formState.errors.friendEmail.message}</p>}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="personalMessage">Personal Message (Optional)</Label>
                                <Textarea id="personalMessage" placeholder="e.g., Thought you might be interested in this!" {...form.register('personalMessage')} />
                            </div>
                             <Button type="submit" disabled={isSending || !referralProfile} className="w-full">
                                {isSending ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                                Send Invite
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
             <div className="space-y-8">
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Star/> Your Referrals</CardTitle></CardHeader>
                    <CardContent>
                        {referrals && referrals.length > 0 ? (
                            <ul className="space-y-3">
                                {referrals.map(ref => (
                                    <li key={ref.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                                        <div>
                                            <p className="font-semibold">{ref.newClientName}</p>
                                            <p className="text-xs text-muted-foreground">Referred on: {format((ref.createdAt as any).toDate(), 'PP')}</p>
                                        </div>
                                        <ReferralStatusBadge status={ref.status} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                             <p className="text-sm text-muted-foreground text-center py-4">You haven&apos;t made any referrals yet.</p>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Ticket/> Your Rewards</CardTitle></CardHeader>
                    <CardContent>
                        {rewards && rewards.length > 0 ? (
                             <ul className="space-y-3">
                                {rewards.map(rew => (
                                    <li key={rew.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                                        <div>
                                            <p className="font-semibold">{rew.description}</p>
                                            <p className="text-xs text-muted-foreground">Earned on: {format((rew.createdAt as any).toDate(), 'PP')}</p>
                                        </div>
                                        <RewardStatusBadge status={rew.status} />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">You have no rewards yet. Start referring to earn!</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
      )}
    </div>
  );
}
