"use client";

import { useEffect, useTransition, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc, collection, query, where, limit } from "firebase/firestore";
import { format } from "date-fns";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Save, X, FileText, Sparkles, ClipboardList, CheckSquare, Car } from "lucide-react";
import { useUser, useDoc, useCollection, useMemoFirebase, useFirestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { masterInterview360Schema, type MasterInterview360FormData, type CaregiverProfile, type Interview } from "@/lib/types";
import { saveMasterInterview360Data } from "@/lib/candidate-hiring-forms.actions";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

const safeToDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return null;
};

export default function MasterInterview360Page() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    const firestore = useFirestore();

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "care-rc@firstlighthomecare.com";
    const ownerEmail = process.env.NEXT_PUBLIC_OWNER_EMAIL || "lpinto@firstlighthomecare.com";
    const staffingAdminEmail = process.env.NEXT_PUBLIC_STAFFING_ADMIN_EMAIL || "admin-rc@firstlighthomecare.com";
    const isAnAdmin = user?.email === adminEmail || user?.email === ownerEmail || user?.email === staffingAdminEmail;

    const candidateId = searchParams.get('candidateId');
    const profileIdToLoad = isAnAdmin && candidateId ? candidateId : null;

    const caregiverProfileRef = useMemoFirebase(
      () => (profileIdToLoad ? doc(firestore, 'caregiver_profiles', profileIdToLoad) : null),
      [profileIdToLoad, firestore]
    );
    const { data: profileData, isLoading: isProfileLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const interviewQuery = useMemoFirebase(
      () => (profileIdToLoad ? query(collection(firestore, 'interviews'), where('caregiverProfileId', '==', profileIdToLoad), limit(1)) : null),
      [profileIdToLoad, firestore]
    );
    const { data: interviewDocs, isLoading: isInterviewLoading } = useCollection<Interview>(interviewQuery);
    const interviewData = interviewDocs?.[0];

    const form = useForm<MasterInterview360FormData>({
      resolver: zodResolver(masterInterview360Schema),
      defaultValues: {
        source: '',
        overnightStayAvailability: undefined,
        workPermitVisaSpanish: '',
        flhcOverview: '',
        promptedCallFLHC: '',
        roleDurationPreference: '',
        experiencedConditions: '',
        payExpectation: '',
        howSoonStart: '',
        earliestStartTime: '',
      },
    });

    useEffect(() => {
        if (profileData && interviewData) {
            form.reset({
                source: profileData.source || '',
                overnightStayAvailability: profileData.overnightStayAvailability,
                workPermitVisaSpanish: interviewData.workPermitVisaSpanish || '',
                flhcOverview: interviewData.flhcOverview || '',
                promptedCallFLHC: interviewData.promptedCallFLHC || '',
                roleDurationPreference: interviewData.roleDurationPreference || '',
                experiencedConditions: interviewData.experiencedConditions || '',
                payExpectation: interviewData.payExpectation || '',
                howSoonStart: interviewData.howSoonStart || '',
                earliestStartTime: interviewData.earliestStartTime || '',
            });
        }
    }, [profileData, interviewData, form]);

    const onSubmit = (data: MasterInterview360FormData) => {
      if (!profileIdToLoad) return;
      startSavingTransition(async () => {
        const result = await saveMasterInterview360Data(profileIdToLoad, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Master Interview 360 data saved."});
          router.push(`/candidate-hiring-forms?candidateId=${profileIdToLoad}`);
        }
      });
    }

    if (!isAnAdmin) {
        return <div className="p-8 text-center">Unauthorized. Only administrators can access this form.</div>;
    }

    const isLoading = isUserLoading || isProfileLoading || isInterviewLoading;
    if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-12 w-12 animate-spin text-accent" /></div>;

    return (
        <Card className="max-w-5xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl font-bold font-headline">MASTER INTERVIEW 360: {profileData?.fullName}</CardTitle>
                <CardDescription>Comprehensive assessment form combining application data and interview results.</CardDescription>
            </CardHeader>
            <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-8">
                        
                        {/* PERSONAL & LOGISTICS */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold bg-muted p-2 rounded">PERSONAL & LOGISTICS</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><Label>NAME</Label><Input value={profileData?.fullName || ''} readOnly className="bg-muted" /></div>
                                <div className="space-y-1"><Label>TELEPHONE</Label><Input value={profileData?.phone || ''} readOnly className="bg-muted" /></div>
                                <FormField control={form.control} name="source" render={({ field }) => ( <FormItem><FormLabel>SOURCE</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                                <div className="space-y-1"><Label>ADDRESS</Label><Input value={`${profileData?.address || ''}, ${profileData?.city || ''} ${profileData?.zip || ''}`} readOnly className="bg-muted" /></div>
                                <div className="space-y-1"><Label>DATE APPLIED</Label><Input value={profileData?.createdAt ? format(safeToDate(profileData.createdAt) || new Date(), 'PP') : 'N/A'} readOnly className="bg-muted" /></div>
                                <FormField control={form.control} name="workPermitVisaSpanish" render={({ field }) => ( <FormItem><FormLabel>WORK PERMIT/VISA (if Spanish)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                                <div className="space-y-1"><Label>EMAIL</Label><Input value={profileData?.email || ''} readOnly className="bg-muted" /></div>
                                <div className="space-y-1"><Label>PHONESCREEN INTERVIEW DATE</Label><Input value={interviewData?.interviewDateTime ? format(safeToDate(interviewData.interviewDateTime) || new Date(), 'PPp') : 'N/A'} readOnly className="bg-muted" /></div>
                            </div>
                        </div>

                        {/* BACKGROUND */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold bg-muted p-2 rounded">BACKGROUND</h3>
                            <FormField control={form.control} name="flhcOverview" render={({ field }) => ( <FormItem><FormLabel>Brief overview of FirstLight HomeCare</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem> )} />
                            <FormField control={form.control} name="promptedCallFLHC" render={({ field }) => ( <FormItem><FormLabel>What prompted you to call FirstLight?</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem> )} />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1"><Label>CAREGIVER EXPERIENCE</Label><Input value={`${profileData?.yearsExperience || 0} years - ${profileData?.previousRoles || 'N/A'}`} readOnly className="bg-muted" /></div>
                                <FormField control={form.control} name="roleDurationPreference" render={({ field }) => ( <FormItem><FormLabel>Short-term or long-term role?</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                            </div>
                            <FormField control={form.control} name="experiencedConditions" render={({ field }) => ( <FormItem><FormLabel>Types of conditions worked with (dementia, Parkinson’s, mobility, etc.)</FormLabel><FormControl><Textarea {...field} rows={2} /></FormControl></FormItem> )} />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1"><Label>OTHER LANGUAGES</Label><Input value={profileData?.otherLanguages || 'N/A'} readOnly className="bg-muted" /></div>
                                <FormField control={form.control} name="payExpectation" render={({ field }) => ( <FormItem><FormLabel>PAY EXPECTATION ($17.50 up to $19 hr)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                            </div>
                        </div>

                        {/* AVAILABILITY */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold bg-muted p-2 rounded">AVAILABILITY</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={form.control} name="howSoonStart" render={({ field }) => ( <FormItem><FormLabel>How soon can you start?</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                                <FormField control={form.control} name="earliestStartTime" render={({ field }) => ( <FormItem><FormLabel>Earliest start time at client home?</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                                <FormField control={form.control} name="overnightStayAvailability" render={({ field }) => (
                                    <FormItem><FormLabel>Availability for overnight stays?</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="overnight-yes" /><Label htmlFor="overnight-yes">Yes</Label></div>
                                                <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="overnight-no" /><Label htmlFor="overnight-no">No</Label></div>
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )} />
                            </div>
                        </div>

                        {/* SITUATIONS & SKILLS (Summary) */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold bg-muted p-2 rounded">SITUATIONS & SKILLS SUMMARY</h3>
                            <p className="text-sm text-muted-foreground italic">Note: Responses to situation questions and detailed skill checkmarks are read from their respective forms. Use the buttons below if updates are needed.</p>
                            <div className="flex flex-wrap gap-4">
                                <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/admin/manage-interviews?search=${encodeURIComponent(profileData?.fullName || '')}`)}>
                                    <ClipboardList className="mr-2 h-4 w-4" /> Edit Situations
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/admin/manage-interviews?search=${encodeURIComponent(profileData?.fullName || '')}`)}>
                                    <CheckSquare className="mr-2 h-4 w-4" /> Edit Skills
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => router.push(`/admin/manage-interviews?search=${encodeURIComponent(profileData?.fullName || '')}`)}>
                                    <Car className="mr-2 h-4 w-4" /> Edit Transportation
                                </Button>
                            </div>
                        </div>

                    </CardContent>
                    <CardFooter className="flex justify-end gap-4 border-t pt-6">
                        <Button type="button" variant="outline" onClick={() => router.back()}><X className="mr-2 h-4 w-4" /> Cancel</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Form
                        </Button>
                    </CardFooter>
                </form>
            </FormProvider>
        </Card>
    );
}
