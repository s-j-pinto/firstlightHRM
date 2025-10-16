
"use client";

import { useState, useMemo, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';
import { caregiverEmployeeSchema } from '@/lib/types';
import { saveInterviewAndSchedule } from '@/lib/interviews.actions';


import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Calendar as CalendarIcon, Sparkles, UserCheck, AlertCircle, ExternalLink, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useRouter } from 'next/navigation';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Separator } from './ui/separator';

const phoneScreenSchema = z.object({
  interviewNotes: z.string().optional(),
  candidateRating: z.number().min(0).max(5),
  phoneScreenPassed: z.enum(['Yes', 'No']),
  inPersonDate: z.date().optional(),
  inPersonTime: z.string().optional(),
});


type PhoneScreenFormData = z.infer<typeof phoneScreenSchema>;
type HiringFormData = z.infer<typeof caregiverEmployeeSchema>;

export default function ManageInterviewsClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CaregiverProfile[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverProfile | null>(null);
  const [existingInterview, setExistingInterview] = useState<Interview | null>(null);
  const [existingEmployee, setExistingEmployee] = useState<CaregiverEmployee | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  
  const [isAiPending, startAiTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();

  const { toast } = useToast();
  const router = useRouter();
  const db = firestore;

  const caregiverProfilesRef = useMemoFirebase(() => collection(db, 'caregiver_profiles'), [db]);
  const { data: allCaregivers, isLoading: caregiversLoading } = useCollection<CaregiverProfile>(caregiverProfilesRef);

  const employeesRef = useMemoFirebase(() => collection(db, 'caregiver_employees'), [db]);
  const { data: allEmployees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesRef);
  
  const phoneScreenForm = useForm<PhoneScreenFormData>({
    resolver: zodResolver(phoneScreenSchema),
    defaultValues: {
      interviewNotes: '',
      candidateRating: 3,
      phoneScreenPassed: 'No',
      inPersonDate: undefined,
      inPersonTime: '',
    },
  });

  const hiringForm = useForm<HiringFormData>({
    resolver: zodResolver(caregiverEmployeeSchema),
    defaultValues: {
      caregiverProfileId: '',
      interviewId: '',
      inPersonInterviewDate: undefined,
      hireDate: new Date(),
      hiringComments: '',
      hiringManager: 'Lolita Pinto',
      startDate: new Date(),
    }
  });

  useEffect(() => {
    if (selectedCaregiver && existingInterview) {
      hiringForm.reset({
        caregiverProfileId: selectedCaregiver.id,
        interviewId: existingInterview.id,
        inPersonInterviewDate: undefined, 
        hireDate: new Date(),
        hiringComments: '',
        hiringManager: 'Lolita Pinto',
        startDate: new Date(),
      });
    }
  }, [selectedCaregiver, existingInterview, hiringForm]);

  const phoneScreenPassed = phoneScreenForm.watch('phoneScreenPassed');
  const shouldShowHiringForm = existingInterview?.phoneScreenPassed === 'Yes' && !existingEmployee;


  const handleSelectCaregiver = async (caregiver: CaregiverProfile) => {
    setSelectedCaregiver(caregiver);
    setSearchResults([]);
    setSearchTerm('');
    setAiInsight(null);
    setExistingInterview(null);
    setExistingEmployee(null);
    setAuthUrl(null);
    
    phoneScreenForm.reset({
      interviewNotes: '',
      candidateRating: 3,
      phoneScreenPassed: 'No',
      inPersonDate: undefined,
      inPersonTime: '',
    });

    // Check for existing employee record first
    const employeeRecord = allEmployees?.find(emp => emp.caregiverProfileId === caregiver.id);
    if (employeeRecord) {
        setExistingEmployee(employeeRecord);
    }

    const interviewsRef = collection(db, 'interviews');
    const q = query(interviewsRef, where("caregiverProfileId", "==", caregiver.id));
    
    try {
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const interviewDoc = querySnapshot.docs[0];
            const interviewData = { ...interviewDoc.data(), id: interviewDoc.id } as Interview;
            
            setExistingInterview(interviewData);
            phoneScreenForm.reset({
                interviewNotes: interviewData.interviewNotes,
                candidateRating: interviewData.candidateRating,
                phoneScreenPassed: interviewData.phoneScreenPassed as 'Yes' | 'No',
            });

            if(interviewData.aiGeneratedInsight) {
                setAiInsight(interviewData.aiGeneratedInsight);
            }
        }
    } catch (error) {
        toast({
            title: "Permission Error",
            description: "Could not fetch existing interview data. Check security rules.",
            variant: "destructive"
        });
    }
  };

  const handleGenerateInsights = () => {
    if (!selectedCaregiver) return;
    const { interviewNotes, candidateRating } = phoneScreenForm.getValues();

    if (!interviewNotes) {
      toast({
        title: "Missing Information",
        description: "Please provide interview notes before generating insights.",
        variant: "destructive"
      });
      return;
    }

    startAiTransition(async () => {
      try {
        const functions = getFunctions();
        const generateInterviewInsights = httpsCallable(functions, 'interviewInsights');
        const result: any = await generateInterviewInsights({
            caregiverProfile: { ...selectedCaregiver, id: selectedCaregiver.id },
            interviewNotes,
            candidateRating,
        });
        setAiInsight(result.data.aiGeneratedInsight);
      } catch (e) {
        console.error(e);
        toast({ title: "AI Error", description: "Failed to generate AI insights.", variant: "destructive"});
      }
    });
  };
  
  const onPhoneScreenSubmit = (data: PhoneScreenFormData) => {
    if (!selectedCaregiver || !db) return;
  
    startSubmitTransition(async () => {
      const interviewDocData = {
        caregiverProfileId: selectedCaregiver.id,
        caregiverUid: selectedCaregiver.uid,
        interviewDateTime: new Date(),
        interviewType: 'Phone' as const,
        interviewNotes: data.interviewNotes,
        candidateRating: data.candidateRating,
        phoneScreenPassed: data.phoneScreenPassed,
        aiGeneratedInsight: aiInsight || '',
      };
      
      let interviewId = existingInterview?.id;
  
      try {
        if (interviewId) {
            const docRef = doc(db, 'interviews', interviewId);
            await updateDoc(docRef, interviewDocData);
            toast({ title: 'Success', description: 'Phone interview results updated.' });
        } else {
            const colRef = collection(db, 'interviews');
            const docRef = await addDoc(colRef, interviewDocData);
            interviewId = docRef.id;
            toast({ title: 'Success', description: 'Phone interview results saved.' });
        }
  
        if (data.phoneScreenPassed === 'Yes' && data.inPersonDate && data.inPersonTime) {
          const [hours, minutes] = data.inPersonTime.split(':').map(Number);
          const inPersonDateTime = new Date(data.inPersonDate.setHours(hours, minutes));
  
          const result = await saveInterviewAndSchedule({
            caregiverProfile: selectedCaregiver,
            inPersonDateTime: inPersonDateTime,
            interviewId: interviewId,
            aiInsight: aiInsight || '',
          });
  
          if (result.authUrl) {
            setAuthUrl(result.authUrl);
          } else {
            setAuthUrl(null);
          }
  
          toast({
            title: result.error ? 'Calendar Error' : 'Success',
            description: result.message,
            variant: result.error ? 'destructive' : 'default',
          });
        }
        // After submission, re-fetch the caregiver data to update the view
        await handleSelectCaregiver(selectedCaregiver); 
      } catch (error) {
        const permissionError = new FirestorePermissionError({
          path: existingInterview ? `interviews/${interviewId}` : 'interviews',
          operation: existingInterview ? 'update' : 'create',
          requestResourceData: interviewDocData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({
          title: 'Error',
          description: 'Could not save interview results due to permissions.',
          variant: 'destructive',
        });
      }
    });
  };

  const onHiringSubmit = (data: HiringFormData) => {
    if (!selectedCaregiver || !existingInterview || !db) return;

    startSubmitTransition(async () => {
      try {
        const employeeData: { [key: string]: any } = {
          caregiverProfileId: selectedCaregiver.id,
          interviewId: existingInterview.id,
          hiringManager: data.hiringManager,
          hiringComments: data.hiringComments,
          hireDate: Timestamp.fromDate(data.hireDate),
          startDate: Timestamp.fromDate(data.startDate),
          createdAt: Timestamp.now(),
        };

        if (data.inPersonInterviewDate) {
          employeeData.inPersonInterviewDate = Timestamp.fromDate(data.inPersonInterviewDate);
        }

        const colRef = collection(db, 'caregiver_employees');
        await addDoc(colRef, employeeData).catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: 'caregiver_employees',
                operation: 'create',
                requestResourceData: employeeData
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });

        toast({ title: 'Success', description: 'Caregiver has been successfully marked as hired.' });
        
        await handleSelectCaregiver(selectedCaregiver);

      } catch (error) {
        toast({
          title: 'Error Saving Hiring Data',
          description: 'An error occurred while saving. Please check permissions.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleCancel = () => {
    setSelectedCaregiver(null);
    setExistingInterview(null);
    setExistingEmployee(null);
    setAiInsight(null);
    phoneScreenForm.reset();
    hiringForm.reset();
    setAuthUrl(null);
  }

  const isLoading = caregiversLoading || employeesLoading;

  return (
    <div className="space-y-6">
      {authUrl && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Required: Authorize Google Calendar</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              To send calendar invites, you must grant permission. Click the button below to authorize.
            </p>
            <Button asChild>
                <a href={authUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Authorization Page
                </a>
            </Button>
            <p className="mt-3 text-xs">
                After you authorize, Google will redirect you. Copy the 'code' from the new URL, then go to{' '}
                <Link href="/admin/settings" className="underline font-semibold">Admin Settings</Link> to paste it and generate a new refresh token.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {!selectedCaregiver && (
        <Card>
            <CardHeader>
            <CardTitle>Search for a Caregiver</CardTitle>
            <CardDescription>
                Search by full name or phone number to begin the interview process.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="flex gap-2">
                <Input
                placeholder="Enter name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={isSearching || !searchTerm.trim()}>
                {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                <span className="ml-2">Search</span>
                </Button>
            </div>
            {isLoading && <p className="text-sm text-muted-foreground mt-2">Loading...</p>}
            {searchResults.length > 0 && (
                <ul className="mt-4 border rounded-md divide-y">
                {searchResults.map((caregiver) => (
                    <li key={caregiver.id} className="p-2 hover:bg-muted">
                    <button
                        onClick={() => handleSelectCaregiver(caregiver)}
                        className="w-full text-left flex justify-between items-center"
                    >
                        <div>
                        <p className="font-semibold">{caregiver.fullName}</p>
                        <p className="text-sm text-muted-foreground">{caregiver.email}</p>
                        </div>
                        <p className="text-sm">{caregiver.phone}</p>
                    </button>
                    </li>
                ))}
                </ul>
            )}
            </CardContent>
        </Card>
      )}


      {selectedCaregiver && !existingEmployee && (
        <Card>
            <CardHeader>
                <CardTitle>Phone Screen: {selectedCaregiver.fullName}</CardTitle>
                <CardDescription>
                    {existingInterview ? "Update the results of the phone interview." : "Record the results of the phone interview."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...phoneScreenForm}>
                    <form onSubmit={phoneScreenForm.handleSubmit(onPhoneScreenSubmit)} className="space-y-8">
                         <FormField
                            control={phoneScreenForm.control}
                            name="interviewNotes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Interview Notes</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Notes from the phone screen..." {...field} rows={6} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={phoneScreenForm.control}
                            name="candidateRating"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Candidate Rating: {field.value}</FormLabel>
                                    <FormControl>
                                        <Slider
                                            min={0}
                                            max={5}
                                            step={1}
                                            value={[field.value]}
                                            onValueChange={(value) => field.onChange(value[0])}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-center">
                          <Button type="button" onClick={handleGenerateInsights} disabled={isAiPending}>
                            {isAiPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate AI Insights
                          </Button>
                        </div>

                        {isAiPending && (
                          <p className="text-sm text-center text-muted-foreground">The AI is analyzing the profile, please wait...</p>
                        )}

                        {aiInsight && (
                          <Alert>
                            <Sparkles className="h-4 w-4" />
                            <AlertTitle>AI-Generated Insight</AlertTitle>
                            <AlertDescription className="space-y-4 mt-2 whitespace-pre-wrap">
                               <p className='text-sm text-foreground'>{aiInsight}</p>
                            </AlertDescription>
                          </Alert>
                        )}

                        <FormField
                            control={phoneScreenForm.control}
                            name="phoneScreenPassed"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Did the candidate pass the phone screen?</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {phoneScreenPassed === 'Yes' && (
                             <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle>Schedule In-Person Interview</CardTitle>
                                    <CardDescription>Select a date and time for the 2.5 hour in-person interview.</CardDescription>
                                </CardHeader>
                                <CardContent className="grid md:grid-cols-2 gap-4">
                                     <FormField
                                        control={phoneScreenForm.control}
                                        name="inPersonDate"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Interview Date</FormLabel>
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="w-auto p-0" align="start">
                                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                                    </PopoverContent>
                                                </Popover>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={phoneScreenForm.control}
                                        name="inPersonTime"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Interview Time</FormLabel>
                                                <FormControl>
                                                    <Input type="time" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        <div className="flex justify-end gap-4">
                            <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                             <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <UserCheck className="mr-2 h-4 w-4" />
                                )}
                                Save and Complete
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
      )}

      {selectedCaregiver && shouldShowHiringForm && (
        <Card>
            <CardHeader>
                 <CardTitle>Hiring &amp; Onboarding: {selectedCaregiver?.fullName}</CardTitle>
                <CardDescription>
                    The phone screen for this candidate has been completed. Enter hiring details below.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <Form {...hiringForm}>
                    <form onSubmit={hiringForm.handleSubmit(onHiringSubmit)} className="space-y-8 pt-4">
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                             <FormField
                                control={hiringForm.control}
                                name="inPersonInterviewDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>In-Person Interview Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={hiringForm.control}
                                name="hireDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Hire Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={hiringForm.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Start Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={hiringForm.control}
                                name="hiringManager"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Hiring Manager</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a hiring manager" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Lolita Pinto">Lolita Pinto</SelectItem>
                                                <SelectItem value="Jacqui Wilson">Jacqui Wilson</SelectItem>
                                                <SelectItem value="Office Hiring Manager">Office Hiring Manager</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={hiringForm.control}
                            name="hiringComments"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Hiring Comments</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Additional comments about the hiring decision..." {...field} rows={4} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end gap-4">
                            <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                             <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                Complete Hiring
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
      )}

      {selectedCaregiver && existingEmployee && (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    <Briefcase />
                    Hired Status: {selectedCaregiver.fullName}
                </CardTitle>
                <CardDescription>
                    This caregiver has already been hired. The following information is read-only.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {existingInterview && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Interview Details</h3>
                        <div className="space-y-2 text-sm p-4 border rounded-lg bg-muted/50">
                            <p><strong>Interview Date:</strong> {format((existingInterview.interviewDateTime as any).toDate(), 'PPP p')}</p>
                            <p><strong>Phone Screen Passed:</strong> {existingInterview.phoneScreenPassed}</p>
                            <p><strong>Candidate Rating:</strong> {existingInterview.candidateRating} / 5</p>
                            <p><strong>Notes:</strong> {existingInterview.interviewNotes || 'N/A'}</p>
                            {existingInterview.aiGeneratedInsight && (
                                <div className='pt-2'>
                                    <p className="font-semibold">AI Insight:</p>
                                    <p className="mt-1 text-muted-foreground whitespace-pre-wrap">{existingInterview.aiGeneratedInsight}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                <Separator />

                <div>
                    <h3 className="text-lg font-semibold mb-2">Hiring Status</h3>
                    <div className="space-y-2 text-sm p-4 border rounded-lg bg-muted/50">
                        <p><strong>Hiring Manager:</strong> {existingEmployee.hiringManager}</p>
                        <p><strong>Hire Date:</strong> {format((existingEmployee.hireDate as any).toDate(), 'PPP')}</p>
                        <p><strong>Start Date:</strong> {format((existingEmployee.startDate as any).toDate(), 'PPP')}</p>
                        {existingEmployee.inPersonInterviewDate && <p><strong>In-Person Interview Date:</strong> {format((existingEmployee.inPersonInterviewDate as any).toDate(), 'PPP')}</p>}
                        <p><strong>Comments:</strong> {existingEmployee.hiringComments || 'N/A'}</p>
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4">
                    <Button type="button" variant="outline" onClick={handleCancel}>Close</Button>
                </div>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
