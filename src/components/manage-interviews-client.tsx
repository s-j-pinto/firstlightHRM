

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
import { getAiInterviewInsights } from '@/lib/ai.actions';


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
import { Loader2, Search, Calendar as CalendarIcon, Sparkles, UserCheck, AlertCircle, ExternalLink, Briefcase, Video, GraduationCap } from 'lucide-react';
import { format, toDate } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';

const phoneScreenSchema = z.object({
  interviewNotes: z.string().min(1, "Interview notes are required."),
  candidateRating: z.number().min(0).max(5),
  phoneScreenPassed: z.enum(['Yes', 'No']),
  
  interviewPathway: z.enum(['separate', 'combined']).optional(),

  interviewMethod: z.enum(['In-Person', 'Google Meet']).optional(),
  eventDate: z.date().optional(),
  eventTime: z.string().optional(),
  
}).superRefine((data, ctx) => {
    if (data.phoneScreenPassed === 'Yes') {
        if (!data.interviewPathway) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please select an interview pathway.",
                path: ["interviewPathway"],
            });
        }
        if (data.interviewPathway) {
             if (!data.interviewMethod) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "An interview method is required.",
                    path: ["interviewMethod"],
                });
            }
            if (!data.eventDate) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "An event date is required.",
                    path: ["eventDate"],
                });
            }
            if (!data.eventTime) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "An event time is required.",
                    path: ["eventTime"],
                });
            }
        }
    }
});

const orientationSchema = z.object({
    orientationDate: z.date({ required_error: 'An orientation date is required.' }),
    orientationTime: z.string().min(1, { message: 'An orientation time is required.' }),
});

type PhoneScreenFormData = z.infer<typeof phoneScreenSchema>;
type OrientationFormData = z.infer<typeof orientationSchema>;
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
  const [isOrientationSubmitting, startOrientationSubmitTransition] = useTransition();


  const { toast } = useToast();
  const db = firestore;
  const pathname = usePathname();

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
    },
  });
  
  const orientationForm = useForm<OrientationFormData>({
    resolver: zodResolver(orientationSchema),
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
      teletrackPin: '',
    }
  });

  const handleCancel = () => {
    setSelectedCaregiver(null);
    setExistingInterview(null);
    setExistingEmployee(null);
    setAiInsight(null);
    phoneScreenForm.reset({
      interviewNotes: '',
      candidateRating: 3,
      phoneScreenPassed: 'No',
      interviewPathway: undefined,
      interviewMethod: undefined,
      eventDate: undefined,
      eventTime: '',
    });
    orientationForm.reset();
    hiringForm.reset({
        caregiverProfileId: '',
        interviewId: '',
        inPersonInterviewDate: undefined,
        hireDate: new Date(),
        hiringComments: '',
        hiringManager: 'Lolita Pinto',
        startDate: new Date(),
        teletrackPin: '',
    });
    setAuthUrl(null);
    setSearchTerm('');
    setSearchResults([]);
  }

  useEffect(() => {
    handleCancel();
  }, [pathname]);

  useEffect(() => {
    if (selectedCaregiver && existingInterview) {
        const interviewDate = (existingInterview.interviewDateTime as any)?.toDate();
        hiringForm.reset({
            caregiverProfileId: selectedCaregiver.id,
            interviewId: existingInterview.id,
            inPersonInterviewDate: interviewDate,
            hireDate: existingEmployee ? (existingEmployee.hireDate as any).toDate() : new Date(),
            hiringComments: existingEmployee?.hiringComments || '',
            hiringManager: existingEmployee?.hiringManager || 'Lolita Pinto',
            startDate: existingEmployee ? (existingEmployee.startDate as any).toDate() : new Date(),
            teletrackPin: existingEmployee?.teletrackPin || '',
        });
    }
  }, [selectedCaregiver, existingInterview, existingEmployee, hiringForm]);

  const handleSearch = () => {
    if (!searchTerm.trim() || !allCaregivers) return;
    startSearchTransition(() => {
      const lowercasedTerm = searchTerm.toLowerCase();
      const results = allCaregivers.filter(
        (caregiver) =>
          caregiver.fullName.toLowerCase().includes(lowercasedTerm) ||
          (caregiver.phone && caregiver.phone.includes(searchTerm))
      );
      setSearchResults(results);
    });
  };

  const phoneScreenPassed = phoneScreenForm.watch('phoneScreenPassed');
  const interviewPathway = phoneScreenForm.watch('interviewPathway');
  
  useEffect(() => {
    if (interviewPathway === 'combined') {
      phoneScreenForm.setValue('interviewMethod', 'In-Person');
    } else if (phoneScreenForm.getValues('interviewMethod') === 'In-Person' && interviewPathway === 'separate') {
      phoneScreenForm.setValue('interviewMethod', undefined);
    }
  }, [interviewPathway, phoneScreenForm]);


  const getHiringFormVisibility = () => {
    if (existingEmployee) return true;
    if (existingInterview?.orientationScheduled) return true;
    return false;
  };
  const shouldShowHiringForm = getHiringFormVisibility();
  
  const handleSelectCaregiver = async (caregiver: CaregiverProfile) => {
    handleCancel();
    
    setSelectedCaregiver(caregiver);
    setSearchResults([]);
    setSearchTerm('');
    
    const interviewsRef = collection(db, 'interviews');
    const q = query(interviewsRef, where("caregiverProfileId", "==", caregiver.id));
    
    try {
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const interviewDoc = querySnapshot.docs[0];
            const interviewData = { ...interviewDoc.data(), id: interviewDoc.id } as Interview;
            
            const employeeRecord = allEmployees?.find(emp => emp.caregiverProfileId === caregiver.id);
            if (employeeRecord) {
                setExistingEmployee(employeeRecord);
            }
            
            if(!employeeRecord && interviewData.phoneScreenPassed === 'No'){
                 toast({
                    title: "Phone Screen Previously Failed",
                    description: "This candidate did not pass the phone screen. You may update the record if this was a mistake.",
                    duration: 5000,
                });
            }
            
            setExistingInterview(interviewData);

            const interviewDate = (interviewData.interviewDateTime as any)?.toDate();
            
            phoneScreenForm.reset({
                interviewNotes: interviewData.interviewNotes || '',
                candidateRating: interviewData.candidateRating || 3,
                phoneScreenPassed: interviewData.phoneScreenPassed as 'Yes' | 'No' || 'No',
                interviewPathway: interviewData.interviewPathway,
                interviewMethod: interviewData.interviewType as 'In-Person' | 'Google Meet' | undefined,
                eventDate: interviewDate ? toDate(interviewDate) : undefined,
                eventTime: interviewDate ? format(toDate(interviewDate), 'HH:mm') : '',
            });

            if(interviewData.orientationDateTime) {
                const orientationDate = (interviewData.orientationDateTime as any).toDate();
                 orientationForm.reset({
                    orientationDate: orientationDate,
                    orientationTime: format(orientationDate, 'HH:mm')
                });
            }

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
        const payload = {
            fullName: selectedCaregiver.fullName,
            yearsExperience: selectedCaregiver.yearsExperience,
            summary: selectedCaregiver.summary,
            canUseHoyerLift: selectedCaregiver.canUseHoyerLift,
            hasDementiaExperience: selectedCaregiver.hasDementiaExperience,
            hasHospiceExperience: selectedCaregiver.hasHospiceExperience,
            cna: selectedCaregiver.cna,
            hha: selectedCaregiver.hha,
            hca: selectedCaregiver.hca,
            availability: selectedCaregiver.availability,
            hasCar: selectedCaregiver.hasCar,
            validLicense: selectedCaregiver.validLicense,
            interviewNotes,
            candidateRating,
        };

        const result = await getAiInterviewInsights(payload);

        if (result.error) {
            throw new Error(result.error);
        }

        setAiInsight(result.aiGeneratedInsight);

      } catch (e: any) {
        console.error(e);
        toast({ title: "AI Error", description: `Failed to generate AI insights: ${e.message}`, variant: "destructive"});
      }
    });
  };
  
  const onPhoneScreenSubmit = (data: PhoneScreenFormData) => {
    if (!selectedCaregiver || !db) return;
  
    startSubmitTransition(async () => {
      let interviewId = existingInterview?.id;
      
      if (!interviewId) {
        try {
          const tempInterviewData = {
            caregiverProfileId: selectedCaregiver.id,
            caregiverUid: selectedCaregiver.uid,
            interviewType: "Phone",
            phoneScreenPassed: "N/A",
            interviewNotes: data.interviewNotes,
            candidateRating: data.candidateRating,
            aiGeneratedInsight: aiInsight || '',
            createdAt: Timestamp.now(),
          };
          const docRef = await addDoc(collection(db, 'interviews'), tempInterviewData);
          interviewId = docRef.id;
          setExistingInterview({ id: docRef.id, ...tempInterviewData} as Interview);
        } catch(e) {
            toast({ title: 'Error', description: 'Could not create initial interview record.', variant: 'destructive'});
            return;
        }
      }
  
      if (data.phoneScreenPassed === 'Yes' && data.eventDate && data.eventTime && data.interviewMethod && data.interviewPathway) {
          const [hours, minutes] = data.eventTime.split(':').map(Number);
          const eventDateTime = new Date(data.eventDate.setHours(hours, minutes));
  
          const result = await saveInterviewAndSchedule({
            caregiverProfile: selectedCaregiver,
            eventDateTime: eventDateTime,
            interviewId: interviewId,
            aiInsight: aiInsight || '',
            interviewType: data.interviewMethod,
            interviewNotes: data.interviewNotes,
            candidateRating: data.candidateRating,
            pathway: data.interviewPathway,
          });
  
          if (result.authUrl) {
            setAuthUrl(result.authUrl);
          } else {
            setAuthUrl(null);
          }
  
          toast({
            title: result.error ? 'Error' : 'Success',
            description: result.message,
            variant: result.error ? 'destructive' : 'default',
          });
          
          if (!result.error) {
             handleCancel();
          }

      } else { 
          const interviewDocData: any = {
            caregiverProfileId: selectedCaregiver.id,
            interviewType: 'Phone',
            interviewNotes: data.interviewNotes,
            candidateRating: data.candidateRating,
            phoneScreenPassed: data.phoneScreenPassed,
            aiGeneratedInsight: aiInsight || '',
            interviewDateTime: existingInterview?.id ? existingInterview.interviewDateTime : Timestamp.now(),
          };
          try {
            await updateDoc(doc(db, 'interviews', interviewId), interviewDocData);
            toast({ title: 'Success', description: 'Phone interview results updated.' });
            handleCancel();
          } catch(e) {
             toast({ title: 'Error', description: 'Could not update interview record.', variant: 'destructive'});
          }
      }
    });
  };

    const handleUpdateFinalInterviewStatus = async (status: 'Passed' | 'Failed') => {
        if (!existingInterview) return;

        startSubmitTransition(async () => {
            try {
                await updateDoc(doc(db, 'interviews', existingInterview.id), {
                    finalInterviewStatus: status
                });
                setExistingInterview(prev => prev ? { ...prev, finalInterviewStatus: status } : null);
                toast({ title: "Status Updated", description: `Final interview marked as ${status}.` });
                if(status === 'Failed') {
                    handleCancel();
                }
            } catch (e) {
                toast({ title: "Error", description: "Could not update interview status.", variant: "destructive" });
            }
        });
    };
    
    const onOrientationSubmit = (data: OrientationFormData) => {
        if (!selectedCaregiver || !existingInterview) return;

        startOrientationSubmitTransition(async () => {
             const [hours, minutes] = data.orientationTime.split(':').map(Number);
             const eventDateTime = new Date(data.orientationDate.setHours(hours, minutes));

            const result = await saveInterviewAndSchedule({
                caregiverProfile: selectedCaregiver,
                eventDateTime: eventDateTime,
                interviewId: existingInterview.id,
                aiInsight: aiInsight || '',
                interviewType: 'Orientation',
                interviewNotes: existingInterview.interviewNotes || '',
                candidateRating: existingInterview.candidateRating || 0,
                pathway: 'separate',
            });

             if (result.authUrl) {
                setAuthUrl(result.authUrl);
            } else {
                setAuthUrl(null);
            }
    
            toast({
                title: result.error ? 'Error' : 'Success',
                description: result.message,
                variant: result.error ? 'destructive' : 'default',
            });
            
            if (!result.error) {
                // Manually update local state to trigger hiring form visibility
                 setExistingInterview(prev => prev ? { ...prev, orientationScheduled: true, orientationDateTime: eventDateTime } : null);
            }
        });
    }

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
          teletrackPin: data.teletrackPin,
          createdAt: existingEmployee?.id ? undefined : Timestamp.now(),
        };

        if (data.inPersonInterviewDate) {
          employeeData.inPersonInterviewDate = Timestamp.fromDate(data.inPersonInterviewDate);
        }

        if (existingEmployee?.id) {
          await updateDoc(doc(db, 'caregiver_employees', existingEmployee.id), employeeData);
          toast({ title: 'Success', description: 'Employee record has been updated.' });
        } else {
          const colRef = collection(db, 'caregiver_employees');
          const docRef = await addDoc(colRef, employeeData).catch(serverError => {
              const permissionError = new FirestorePermissionError({
                  path: 'caregiver_employees',
                  operation: 'create',
                  requestResourceData: employeeData
              });
              errorEmitter.emit('permission-error', permissionError);
              throw serverError;
          });
          setExistingEmployee({ id: docRef.id, ...employeeData } as CaregiverEmployee);
          toast({ title: 'Success', description: 'Caregiver has been successfully marked as hired.' });
        }

      } catch (error) {
        toast({
          title: 'Error Saving Hiring Data',
          description: 'An error occurred while saving. Please check permissions.',
          variant: 'destructive',
        });
      }
    });
  };

  const handleLaunchMeet = () => {
    if (existingInterview?.googleMeetLink) {
        window.open(existingInterview.googleMeetLink, '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
    }
  }


  const isLoading = caregiversLoading || employeesLoading;
  const isPhoneScreenCompleted = existingInterview && existingInterview.phoneScreenPassed !== 'N/A';
  const isFinalInterviewPending = isPhoneScreenCompleted && existingInterview?.interviewPathway === 'separate' && existingInterview?.finalInterviewStatus === 'Pending';
  const showCompletedSeparateFlowSummary = existingInterview?.interviewPathway === 'separate' && existingInterview?.finalInterviewStatus === 'Passed' && existingInterview?.orientationScheduled;


  return (
    <div className="space-y-6">
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
        {(isLoading || isSearching) && <p className="text-sm text-muted-foreground mt-2">Loading...</p>}
        {searchResults.length > 0 && (
            <ul className="mt-4 border rounded-md divide-y">
            {searchResults.map((caregiver) => {
              const createdAt = (caregiver.createdAt as any)?.toDate();
              return (
                <li key={caregiver.id} className="p-2 hover:bg-muted">
                <button
                    onClick={() => handleSelectCaregiver(caregiver)}
                    className="w-full text-left flex justify-between items-center"
                >
                    <div>
                    <p className="font-semibold">{caregiver.fullName}</p>
                    <p className="text-sm text-muted-foreground">{caregiver.email}</p>
                    </div>
                    <div className='text-right'>
                      <p className="text-sm">{caregiver.phone}</p>
                      {createdAt && <p className="text-xs text-muted-foreground">Applied: {format(createdAt, "PPp")}</p>}
                    </div>
                </button>
                </li>
              )
            })}
            </ul>
        )}
        </CardContent>
      </Card>
      
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

      {selectedCaregiver && (
        <Card>
            <CardHeader>
                <CardTitle>Phone Screen: {selectedCaregiver.fullName}</CardTitle>
                <CardDescription>
                    {isPhoneScreenCompleted ? "This phone screen has been completed. Review the details below." : "Record the results of the phone interview."}
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
                                        <Textarea placeholder="Notes from the phone screen..." {...field} rows={6} disabled={isPhoneScreenCompleted} />
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
                                            disabled={isPhoneScreenCompleted}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-center">
                          <Button type="button" onClick={handleGenerateInsights} disabled={isAiPending || isPhoneScreenCompleted}>
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
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4" disabled={isPhoneScreenCompleted}>
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="Yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="No" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {phoneScreenPassed === 'Yes' && !isFinalInterviewPending && !existingInterview?.orientationScheduled && (
                            <Card className="bg-muted/50">
                                <CardHeader>
                                    <CardTitle>Next Step</CardTitle>
                                    <CardDescription>Select the hiring pathway and schedule the next event.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                     <FormField
                                        control={phoneScreenForm.control}
                                        name="interviewPathway"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                                <FormLabel>Interview Pathway</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col sm:flex-row gap-4" disabled={isPhoneScreenCompleted}>
                                                        <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="separate" /></FormControl><FormLabel className="font-normal">Separate Interview &amp; Orientation</FormLabel></FormItem>
                                                        <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="combined" /></FormControl><FormLabel className="font-normal">Combined Interview + Orientation</FormLabel></FormItem>
                                                    </RadioGroup>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    
                                    {interviewPathway && (
                                        <>
                                            {interviewPathway === 'separate' && (
                                                <FormField
                                                    control={phoneScreenForm.control}
                                                    name="interviewMethod"
                                                    render={({ field }) => (
                                                        <FormItem className="space-y-3">
                                                            <FormLabel>Final Interview Method</FormLabel>
                                                            <FormControl>
                                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4" disabled={isPhoneScreenCompleted}>
                                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                                        <FormControl><RadioGroupItem value="In-Person" /></FormControl>
                                                                        <FormLabel className="font-normal flex items-center gap-2"><Briefcase /> In-Person</FormLabel>
                                                                    </FormItem>
                                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                                        <FormControl><RadioGroupItem value="Google Meet" /></FormControl>
                                                                        <FormLabel className="font-normal flex items-center gap-2"><Video /> Google Meet</FormLabel>
                                                                    </FormItem>
                                                                </RadioGroup>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                            
                                            <div className="flex flex-col sm:flex-row gap-4 items-start">
                                                <FormField
                                                    control={phoneScreenForm.control}
                                                    name="eventDate"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-col flex-1">
                                                            <FormLabel>
                                                                {interviewPathway === 'separate' ? 'Final Interview Date' : 'Combined Session Date'}
                                                            </FormLabel>
                                                            <Popover>
                                                                <PopoverTrigger asChild>
                                                                <FormControl>
                                                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")} disabled={isPhoneScreenCompleted}>
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
                                                    name="eventTime"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-col flex-1">
                                                            <FormLabel>
                                                                {interviewPathway === 'separate' ? 'Final Interview Time' : 'Combined Session Time'}
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input type="time" {...field} disabled={isPhoneScreenCompleted} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <div className="flex justify-end gap-4">
                            <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                             <Button type="submit" disabled={isSubmitting || isPhoneScreenCompleted}>
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

    {isFinalInterviewPending && (
        <Card>
            <CardHeader>
                <CardTitle>Final Interview Status</CardTitle>
                <CardDescription>Update the status of the final interview for {selectedCaregiver?.fullName}.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center gap-4">
                <Button onClick={() => handleUpdateFinalInterviewStatus('Passed')} disabled={isSubmitting} variant="default">Pass</Button>
                <Button onClick={() => handleUpdateFinalInterviewStatus('Failed')} disabled={isSubmitting} variant="destructive">Fail</Button>
            </CardContent>
        </Card>
    )}

    {existingInterview?.interviewPathway === 'separate' && existingInterview?.finalInterviewStatus === 'Passed' && !existingInterview.orientationScheduled && (
         <Card>
            <CardHeader>
                <CardTitle>Schedule Orientation</CardTitle>
                <CardDescription>Schedule the 1.5-hour orientation session for {selectedCaregiver?.fullName}.</CardDescription>
            </CardHeader>
            <CardContent>
                 <Form {...orientationForm}>
                    <form onSubmit={orientationForm.handleSubmit(onOrientationSubmit)} className="space-y-6">
                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                            <FormField
                                control={orientationForm.control}
                                name="orientationDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col flex-1">
                                        <FormLabel>Orientation Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal w-full", !field.value && "text-muted-foreground")}>
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
                                control={orientationForm.control}
                                name="orientationTime"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col flex-1">
                                        <FormLabel>Orientation Time</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                         <div className="flex justify-end">
                            <Button type="submit" disabled={isOrientationSubmitting}>
                                {isOrientationSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GraduationCap className="mr-2 h-4 w-4" />}
                                Schedule Orientation
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )}

      {showCompletedSeparateFlowSummary && (
        <Card>
            <CardHeader>
                <CardTitle>Completed Steps</CardTitle>
                <CardDescription>Summary of the completed interview and orientation for {selectedCaregiver?.fullName}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <Briefcase className="h-4 w-4" />
                    <AlertTitle>Final Interview</AlertTitle>
                    <AlertDescription>
                        Status: <span className="font-semibold text-green-600">Passed</span>
                        <br />
                        Date: {existingInterview?.interviewDateTime ? format((existingInterview.interviewDateTime as any).toDate(), 'PPPp') : 'N/A'}
                    </AlertDescription>
                </Alert>
                <Alert>
                    <GraduationCap className="h-4 w-4" />
                    <AlertTitle>Orientation</AlertTitle>
                    <AlertDescription>
                        Status: <span className="font-semibold text-green-600">Scheduled</span>
                        <br />
                        Date: {existingInterview?.orientationDateTime ? format((existingInterview.orientationDateTime as any).toDate(), 'PPPp') : 'N/A'}
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
      )}


      {selectedCaregiver && shouldShowHiringForm && (
        <Card>
            <CardHeader>
                 <CardTitle>Hiring &amp; Onboarding: {selectedCaregiver?.fullName}</CardTitle>
                <CardDescription>
                    {existingEmployee ? "This caregiver has been hired. Review or update the details below." : "The candidate has passed all stages. Enter hiring details to complete onboarding."}
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
                                        <FormLabel>Interview Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={true}>
                                                    {field.value ? format(field.value, "PPP") : <span>N/A</span>}
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
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={!!existingEmployee}>
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
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")} disabled={!!existingEmployee}>
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
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!!existingEmployee}>
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
                            <FormField
                                control={hiringForm.control}
                                name="teletrackPin"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>TeleTrack PIN</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter PIN" {...field} />
                                        </FormControl>
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
                            {existingInterview?.interviewType === 'Google Meet' && existingInterview.googleMeetLink && (
                                <Button type="button" variant="outline" onClick={handleLaunchMeet}>
                                    <Video className="mr-2 h-4 w-4" />
                                    Launch Google Meet
                                </Button>
                            )}
                            <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                             <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                {existingEmployee ? 'Update Record' : 'Complete Hiring'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
      )}

    </div>
  );
}



    

    