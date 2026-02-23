

"use client";

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from 'zod';
import Link from 'next/link';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { CaregiverProfile, Interview, CaregiverEmployee } from '@/lib/types';
import { caregiverEmployeeSchema } from '@/lib/types';
import { saveInterviewAndSchedule, rejectCandidateAfterOrientation, initiateOnboardingForms } from '@/lib/interviews.actions';
import { getAiInterviewInsights } from '@/lib/ai.actions';
import { triggerTeletrackImport } from '@/lib/github.actions';


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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Calendar as CalendarIcon, Sparkles, UserCheck, AlertCircle, ExternalLink, Briefcase, Video, GraduationCap, Phone, Star, MessageSquare, CheckCircle, XCircle, UserX, Save, FileText, FileCheck2, FileClock } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogContent, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';


const phoneScreenSchema = z.object({
  interviewNotes: z.string().min(1, "Interview notes are required."),
  phoneScreenPassed: z.enum(['Yes', 'No']),
});

const assessmentSchema = z.object({
  candidateRating: z.string({ required_error: 'A rating is required.' }),
  finalInterviewNotes: z.string().optional(),
});

const scheduleEventSchema = z.object({
    interviewPathway: z.enum(['separate', 'combined']),
    interviewMethod: z.enum(['In-Person', 'Google Meet']),
    eventDate: z.date({ required_error: "An event date is required."}),
    eventTime: z.string().min(1, { message: 'An event time is required.'}),
    includeReferenceForm: z.boolean().default(false).optional(),
});

const orientationSchema = z.object({
    orientationDate: z.date({ required_error: 'An orientation date is required.' }),
    orientationTime: z.string().min(1, { message: 'An orientation time is required.' }),
    includeReferenceForm: z.boolean().default(false).optional(),
});

type PhoneScreenFormData = z.infer<typeof phoneScreenSchema>;
type AssessmentFormData = z.infer<typeof assessmentSchema>;
type ScheduleEventFormData = z.infer<typeof scheduleEventSchema>;
type OrientationFormData = z.infer<typeof orientationSchema>;
type HiringFormData = z.infer<typeof caregiverEmployeeSchema>;

const ratingOptions = [
    { value: 'A', label: 'Excellent candidate; ready for hire' },
    { value: 'B', label: 'Good candidate; minor training needed' },
    { value: 'C', label: 'Average; may require supervision' },
    { value: 'D', label: 'Below average; limited suitability' },
    { value: 'F', label: 'Not recommended for hire' },
];

const rejectionReasons = [
    "Insufficient docs provided.",
    "Pay rate too low",
    "Invalid References provided.",
    "Not a good fit (attitude, soft skills etc)",
    "CG ghosted appointment",
    "Candidate withdrew application",
    "Took another Job",
];

const onboardingFormCompletionKeys: (keyof CaregiverProfile)[] = [
    'arbitrationAgreementSignature',
    'drugAlcoholPolicySignature',
    'jobDescriptionSignature',
    'clientAbandonmentSignature',
    'orientationAgreementSignature'
];

const safeToDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return undefined;
};


export default function ManageInterviewsClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CaregiverProfile[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverProfile | null>(null);
  const [existingInterview, setExistingInterview] = useState<Interview | null>(null);
  const [existingEmployee, setExistingEmployee] = useState<CaregiverEmployee | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  
  const [isAiPending, startAiTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isOrientationSubmitting, startOrientationSubmitTransition] = useTransition();
  const [isScheduleSubmitting, startScheduleSubmitTransition] = useTransition();
  const [isRejecting, startRejectingTransition] = useTransition();
  const [isAssessmentSaving, startAssessmentSavingTransition] = useTransition();
  const [isOnboardingInitiating, startOnboardingInitiation] = useTransition();


  const { toast } = useToast();
  const db = firestore;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const caregiverProfilesRef = useMemoFirebase(() => collection(db, 'caregiver_profiles'), [db]);
  const { data: allCaregivers, isLoading: caregiversLoading } = useCollection<CaregiverProfile>(caregiverProfilesRef);

  const employeesRef = useMemoFirebase(() => collection(db, 'caregiver_employees'), [db]);
  const { data: allEmployees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesRef);
  
  const phoneScreenForm = useForm<PhoneScreenFormData>({
    resolver: zodResolver(phoneScreenSchema),
    defaultValues: {
      interviewNotes: '',
      phoneScreenPassed: 'No',
    },
  });

  const assessmentForm = useForm<AssessmentFormData>({
      resolver: zodResolver(assessmentSchema),
      defaultValues: {
          candidateRating: 'C',
          finalInterviewNotes: '',
      },
  });

  const scheduleEventForm = useForm<ScheduleEventFormData>({
    resolver: zodResolver(scheduleEventSchema),
    defaultValues: {
      includeReferenceForm: false,
    },
  });
  
  const orientationForm = useForm<OrientationFormData>({
    resolver: zodResolver(orientationSchema),
    defaultValues: {
      includeReferenceForm: false,
    }
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
      teletrackPin: '',
    }
  });

  const handleCancel = useCallback(() => {
    setSelectedCaregiver(null);
    setExistingInterview(null);
    setExistingEmployee(null);
    setAiInsight(null);
    phoneScreenForm.reset({
      interviewNotes: '',
      phoneScreenPassed: 'No',
    });
    assessmentForm.reset({
        candidateRating: 'C',
        finalInterviewNotes: '',
    });
    scheduleEventForm.reset({ includeReferenceForm: false });
    orientationForm.reset({ includeReferenceForm: false });
    hiringForm.reset({
        caregiverProfileId: '',
        interviewId: '',
        inPersonInterviewDate: undefined,
        hireDate: new Date(),
        hiringComments: '',
        hiringManager: 'Lolita Pinto',
        teletrackPin: '',
    });
    setAuthUrl(null);
    setSearchTerm('');
    setSearchResults([]);
    router.replace(pathname);
  }, [hiringForm, orientationForm, phoneScreenForm, assessmentForm, scheduleEventForm, router, pathname]);

  const handleSelectCaregiver = useCallback(async (caregiver: CaregiverProfile) => {
    handleCancel(); // Reset everything first
    router.replace(pathname); // Clear URL params
    
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

            const interviewDate = interviewData.interviewDateTime ? (interviewData.interviewDateTime as any).toDate() : undefined;
            
            phoneScreenForm.reset({
                interviewNotes: interviewData.interviewNotes || '',
                phoneScreenPassed: interviewData.phoneScreenPassed as 'Yes' | 'No' || 'No',
            });

            assessmentForm.reset({
                candidateRating: interviewData.candidateRating || 'C',
                finalInterviewNotes: interviewData.finalInterviewNotes || '',
            });

            scheduleEventForm.reset({
                interviewPathway: interviewData.interviewPathway || undefined,
                interviewMethod: interviewData.interviewType as 'In-Person' | 'Google Meet' | 'Orientation' | undefined,
                eventDate: interviewDate,
                eventTime: interviewDate ? format(interviewDate, 'HH:mm') : '',
                includeReferenceForm: false,
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
  }, [allEmployees, db, handleCancel, orientationForm, phoneScreenForm, assessmentForm, scheduleEventForm, router, pathname, toast]);

  useEffect(() => {
    const searchFromUrl = searchParams.get('search');
    if (searchFromUrl && allCaregivers && !selectedCaregiver) {
      const decodedSearch = decodeURIComponent(searchFromUrl);
      setSearchTerm(decodedSearch);
      
      const results = allCaregivers.filter(
        (caregiver) =>
          caregiver.fullName.toLowerCase().includes(decodedSearch.toLowerCase())
      );
      
      if (results.length === 1) {
        handleSelectCaregiver(results[0]);
      } else {
        setSearchResults(results);
      }
    }
  }, [searchParams, allCaregivers, selectedCaregiver, handleSelectCaregiver]);

  useEffect(() => {
    if (selectedCaregiver && existingInterview) {
        const interviewDate = existingInterview.interviewDateTime ? (existingInterview.interviewDateTime as any).toDate() : undefined;
        
        let orientationDate: Date | null = null;
        if (existingInterview.orientationDateTime) {
            if (typeof (existingInterview.orientationDateTime as any).toDate === 'function') {
                orientationDate = (existingInterview.orientationDateTime as any).toDate();
            } else if (existingInterview.orientationDateTime instanceof Date) {
                orientationDate = existingInterview.orientationDateTime;
            }
        }
        
        const offerLetterHireDate = selectedCaregiver.hireDate ? safeToDate(selectedCaregiver.hireDate) : null;

        hiringForm.reset({
            caregiverProfileId: selectedCaregiver.id,
            interviewId: existingInterview.id,
            inPersonInterviewDate: interviewDate,
            hireDate: existingEmployee ? (existingEmployee.hireDate as any).toDate() : offerLetterHireDate || orientationDate || new Date(),
            hiringComments: existingEmployee?.hiringComments || '',
            hiringManager: existingEmployee?.hiringManager || 'Lolita Pinto',
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

  const interviewPathway = scheduleEventForm.watch('interviewPathway');
  
  useEffect(() => {
    if (interviewPathway === 'combined') {
      scheduleEventForm.setValue('interviewMethod', 'In-Person');
    } else if (scheduleEventForm.getValues('interviewMethod') === 'In-Person' && interviewPathway === 'separate') {
      scheduleEventForm.setValue('interviewMethod', undefined);
    }
  }, [interviewPathway, scheduleEventForm]);


  const getHiringFormVisibility = () => {
    if (existingEmployee) return false;
    if (existingInterview?.finalInterviewStatus === 'Rejected at Orientation') return false;
    if (existingInterview?.orientationScheduled && existingInterview.finalInterviewStatus !== 'Pending reference checks') return true;
    return false;
  };
  const shouldShowHiringForm = getHiringFormVisibility();
  
  const getSummaryVisibility = () => {
    if (existingEmployee) return true;
    if (existingInterview?.rejectionReason) return true;
    if (existingInterview?.orientationScheduled) return true;
    return false;
  }
  const shouldShowCompletedSummary = getSummaryVisibility();

  const getOnboardingStatus = () => {
    if (!existingInterview?.onboardingFormsInitiated) {
        return null;
    }
    const completedForms = onboardingFormCompletionKeys.filter(key => !!selectedCaregiver?.[key]).length;
    if (completedForms === onboardingFormCompletionKeys.length) {
        return { text: "Completed", icon: FileCheck2, color: "text-green-500" };
    }
    if (completedForms > 0) {
        return { text: `Started (${completedForms}/${onboardingFormCompletionKeys.length})`, icon: FileText, color: "text-yellow-500" };
    }
    return { text: "Initiated", icon: FileText, color: "text-blue-500" };
  };
  const onboardingStatus = getOnboardingStatus();


  const handleGenerateInsights = () => {
    if (!selectedCaregiver) return;
    const { interviewNotes } = phoneScreenForm.getValues();
    
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
            candidateRating: assessmentForm.getValues('candidateRating'),
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
  
  const onPhoneScreenSubmit = async (data: PhoneScreenFormData) => {
    if (!selectedCaregiver || !db) return;

    startSubmitTransition(async () => {
      let interviewId = existingInterview?.id;
      let interviewDocRef;
      
      const interviewPayload = {
        caregiverProfileId: selectedCaregiver.id,
        caregiverUid: selectedCaregiver.uid,
        interviewType: "Phone",
        phoneScreenPassed: data.phoneScreenPassed,
        interviewNotes: data.interviewNotes,
        candidateRating: assessmentForm.getValues('candidateRating'),
        aiGeneratedInsight: aiInsight || '',
        createdAt: Timestamp.now(),
        lastUpdatedAt: Timestamp.now(),
      };
      
      try {
        if (interviewId) {
          interviewDocRef = doc(db, 'interviews', interviewId);
          await updateDoc(interviewDocRef, interviewPayload);
        } else {
          const interviewsCollection = collection(db, 'interviews');
          const docRef = await addDoc(interviewsCollection, interviewPayload);
          interviewId = docRef.id;
          interviewDocRef = docRef;
        }

        setExistingInterview({ ...interviewPayload, id: interviewId } as Interview);
        let toastMessage = 'Phone interview results saved.';
        
        if (data.phoneScreenPassed === 'Yes') {
          const teletrackPin = hiringForm.getValues('teletrackPin');
          
          if (!selectedCaregiver) return;

          const applicantData = {
              fullName: selectedCaregiver.fullName,
              address: selectedCaregiver.address,
              city: selectedCaregiver.city,
              state: selectedCaregiver.state,
              zip: selectedCaregiver.zip,
              phone: selectedCaregiver.phone,
              driversLicenseNumber: selectedCaregiver.driversLicenseNumber,
              email: selectedCaregiver.email,
          };
  
          const githubResult = await triggerTeletrackImport(applicantData, teletrackPin);
          if (githubResult.success) {
            toastMessage += " and TeleTrack new applicant created successfully";
          } else {
            toastMessage += ` but failed to create TeleTrack applicant: ${githubResult.error}`;
          }
        }

        toast({ title: 'Success', description: toastMessage });

        if (data.phoneScreenPassed === 'No') {
          handleCancel();
        }
      } catch(serverError) {
          const permissionError = new FirestorePermissionError({
            path: interviewDocRef ? interviewDocRef.path : collection(db, 'interviews').path,
            operation: interviewId ? 'update' : 'create',
            requestResourceData: interviewPayload,
          });
          errorEmitter.emit("permission-error", permissionError);
      }
    });
  };

  const onAssessmentSubmit = async (data: AssessmentFormData) => {
    if (!selectedCaregiver || !db) return;
    if (!existingInterview?.id) {
        toast({ title: "Error", description: "An interview must be created first. Save the phone screen results before updating the assessment.", variant: "destructive"});
        return;
    }

    startAssessmentSavingTransition(async () => {
        const interviewDocRef = doc(db, 'interviews', existingInterview.id);
        const updateData = {
            candidateRating: data.candidateRating,
            finalInterviewNotes: data.finalInterviewNotes || '',
            lastUpdatedAt: Timestamp.now(),
        };

        try {
            await updateDoc(interviewDocRef, updateData);
            setExistingInterview(prev => prev ? { ...prev, ...updateData } : null);
            toast({ title: 'Success', description: 'Candidate assessment updated.' });
        } catch (serverError) {
            const permissionError = new FirestorePermissionError({
              path: interviewDocRef.path,
              operation: "update",
              requestResourceData: updateData,
            });
            errorEmitter.emit("permission-error", permissionError);
        }
    });
  };


  const onScheduleEventSubmit = async (data: ScheduleEventFormData) => {
    if (!selectedCaregiver || !existingInterview) return;

    startScheduleSubmitTransition(async () => {
       const result = await saveInterviewAndSchedule({
         caregiverProfile: selectedCaregiver,
         eventDate: format(data.eventDate, 'yyyy-MM-dd'),
         eventTime: data.eventTime,
         interviewId: existingInterview.id,
         aiInsight: aiInsight || existingInterview.aiGeneratedInsight || '',
         interviewType: data.interviewMethod,
         interviewNotes: phoneScreenForm.getValues('interviewNotes'),
         candidateRating: assessmentForm.getValues('candidateRating'),
         pathway: data.interviewPathway,
         finalInterviewStatus: existingInterview.finalInterviewStatus,
         googleEventId: existingInterview.googleEventId,
         previousPathway: existingInterview.interviewPathway,
         includeReferenceForm: data.includeReferenceForm,
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
    });
  }

    const handleUpdateFinalInterviewStatus = async (status: 'Passed' | 'Failed') => {
        if (!existingInterview) return;

        startSubmitTransition(async () => {
            const interviewDocRef = doc(db, 'interviews', existingInterview.id);
            const { finalInterviewNotes } = assessmentForm.getValues();
            const updateData = { 
                finalInterviewStatus: status,
                finalInterviewNotes: finalInterviewNotes || '',
             };
            
            updateDoc(interviewDocRef, updateData)
              .then(() => {
                setExistingInterview(prev => prev ? { ...prev, ...updateData } : null);
                toast({ title: "Status Updated", description: `Final interview marked as ${status}.` });
                if(status === 'Failed') {
                    handleCancel();
                }
              })
              .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                  path: interviewDocRef.path,
                  operation: "update",
                  requestResourceData: updateData,
                });
                errorEmitter.emit("permission-error", permissionError);
              });
        });
    };
    
    const onOrientationSubmit = (data: OrientationFormData) => {
        if (!selectedCaregiver || !existingInterview) return;

        startOrientationSubmitTransition(async () => {
            const result = await saveInterviewAndSchedule({
                caregiverProfile: selectedCaregiver,
                eventDate: format(data.orientationDate, 'yyyy-MM-dd'),
                eventTime: data.orientationTime,
                interviewId: existingInterview.id,
                aiInsight: aiInsight || '',
                interviewType: 'Orientation',
                interviewNotes: existingInterview.interviewNotes || '',
                candidateRating: assessmentForm.getValues('candidateRating'),
                pathway: 'separate', // Orientation is always a separate event logically
                googleEventId: existingInterview.googleEventId,
                previousPathway: existingInterview.interviewPathway,
                includeReferenceForm: data.includeReferenceForm,
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
                 setExistingInterview(prev => prev ? { ...prev, orientationScheduled: true, orientationDateTime: fromZonedTime(`${format(data.orientationDate, 'yyyy-MM-dd')}T${data.orientationTime}`, 'America/Los_Angeles') } : null);
            }
        });
    }

    const onHiringSubmit = (data: HiringFormData) => {
        if (!selectedCaregiver || !existingInterview || !db) return;

        startSubmitTransition(async () => {
          const employeeData: { [key: string]: any } = {
            caregiverProfileId: selectedCaregiver.id,
            interviewId: existingInterview.id,
            hiringManager: data.hiringManager,
            hiringComments: data.hiringComments,
            hireDate: Timestamp.fromDate(data.hireDate),
            teletrackPin: data.teletrackPin,
            createdAt: existingEmployee?.id ? undefined : Timestamp.now(),
          };

          if (data.inPersonInterviewDate) {
            employeeData.inPersonInterviewDate = Timestamp.fromDate(data.inPersonInterviewDate);
          }

          if (existingEmployee?.id) {
            const employeeDocRef = doc(db, 'caregiver_employees', existingEmployee.id);
            updateDoc(employeeDocRef, employeeData)
              .then(() => {
                toast({ title: 'Success', description: 'Employee record has been updated.' });
              })
              .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                  path: employeeDocRef.path,
                  operation: "update",
                  requestResourceData: employeeData,
                });
                errorEmitter.emit("permission-error", permissionError);
              });
          } else {
            const employeesCollection = collection(db, 'caregiver_employees');
            addDoc(employeesCollection, employeeData)
              .then(docRef => {
                setExistingEmployee({ id: docRef.id, ...employeeData } as CaregiverEmployee);
                toast({ title: 'Success', description: 'Caregiver has been successfully marked as hired.' });
              })
              .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                  path: employeesCollection.path,
                  operation: "create",
                  requestResourceData: employeeData,
                });
                errorEmitter.emit("permission-error", permissionError);
              });
          }
        });
    };
    
    const handleRejection = (reason: string, notes: string) => {
        if (!existingInterview?.id || !selectedCaregiver) return;
        startRejectingTransition(async () => {
            const result = await rejectCandidateAfterOrientation({
                interviewId: existingInterview.id,
                reason,
                notes,
                caregiverName: selectedCaregiver.fullName,
                caregiverEmail: selectedCaregiver.email,
            });
            if (result.error) {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.message });
                setIsRejectDialogOpen(false);
                handleCancel();
            }
        });
    };

  const handleLaunchMeet = () => {
    if (existingInterview?.googleMeetLink) {
        window.open(existingInterview.googleMeetLink, '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
    }
  }
  
  const handleApproveReferences = () => {
    if (!existingInterview?.id) return;

    startSubmitTransition(async () => {
        const interviewDocRef = doc(db, 'interviews', existingInterview.id);
        const updateData = { finalInterviewStatus: 'Passed' }; // Move status forward
        try {
            await updateDoc(interviewDocRef, updateData);
            setExistingInterview(prev => prev ? { ...prev, ...updateData } : null);
            toast({ title: "Success", description: "Reference checks approved. You can now proceed to hire." });
        } catch (serverError) {
             const permissionError = new FirestorePermissionError({
                path: interviewDocRef.path,
                operation: "update",
                requestResourceData: updateData,
            });
            errorEmitter.emit("permission-error", permissionError);
        }
    });
};

  const handleInitiateOnboarding = () => {
    if (!existingInterview?.id) return;
    startOnboardingInitiation(async () => {
        const result = await initiateOnboardingForms(existingInterview.id);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        } else {
            toast({ title: 'Success', description: result.success });
            setExistingInterview(prev => prev ? { ...prev, onboardingFormsInitiated: true } : null);
        }
    });
  };


  const isLoading = caregiversLoading || employeesLoading;
  const isPhoneScreenCompleted = !!existingInterview;
  
  const isEventEditable = 
    isPhoneScreenCompleted &&
    existingInterview.phoneScreenPassed === 'Yes' &&
    !existingEmployee &&
    (
        (existingInterview?.interviewPathway === 'separate' && !existingInterview?.orientationScheduled) ||
        (existingInterview?.interviewPathway === 'combined') ||
        !existingInterview?.interviewPathway
    );

  const isFinalInterviewPending = isPhoneScreenCompleted && existingInterview?.interviewPathway === 'separate' && existingInterview?.finalInterviewStatus === 'Pending';

  const isProcessActive = selectedCaregiver && !existingEmployee && existingInterview?.finalInterviewStatus !== 'Rejected at Orientation' && existingInterview?.finalInterviewStatus !== 'Process Terminated' && existingInterview?.finalInterviewStatus !== 'No Show' && !existingInterview?.rejectionReason;
  
  const areNotesEditable = isProcessActive && isPhoneScreenCompleted && existingInterview.phoneScreenPassed === 'Yes';


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>Search for a Caregiver</CardTitle>
                <CardDescription>
                    Search by full name or phone number to begin the interview process.
                </CardDescription>
            </div>
             {selectedCaregiver && (
                <Button variant="outline" size="sm" onClick={handleCancel}>
                    Clear Selection & Start Over
                </Button>
            )}
        </div>
        </CardHeader>
        <CardContent>
        <div className="flex gap-2">
            <Input
            placeholder="Enter name or phone number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
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
                After you authorize, Google will redirect you. Copy the &apos;code&apos; from the new URL, then go to{' '}
                <Link href="/admin/settings" className="underline font-semibold">Admin Settings</Link> to paste it and generate a new refresh token.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {selectedCaregiver && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
             <div className="space-y-6">
              <Card>
                  <CardHeader>
                      <div className="flex justify-between items-start">
                          <div>
                              <CardTitle>Interview Process: {selectedCaregiver.fullName}</CardTitle>
                              <CardDescription>
                                  {isPhoneScreenCompleted ? "The phone screen has been completed. Review or update details below." : "Record the results of the phone interview."}
                              </CardDescription>
                          </div>
                      </div>
                  </CardHeader>
                  <CardContent>
                      {isPhoneScreenCompleted && existingInterview?.phoneScreenPassed !== 'N/A' && existingInterview.phoneScreenPassed !== undefined ? (
                          <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                  <span className="font-semibold">Phone Screen Status:</span>
                                  {existingInterview?.phoneScreenPassed === 'Yes' ? (
                                      <span className="flex items-center gap-1 text-green-600 font-medium"><CheckCircle className="h-4 w-4"/> Passed</span>
                                  ) : (
                                      <span className="flex items-center gap-1 text-red-600 font-medium"><XCircle className="h-4 w-4"/> Failed</span>
                                  )}
                              </div>
                              {existingInterview?.interviewNotes && (
                                  <div>
                                      <h4 className="font-semibold flex items-center gap-2"><MessageSquare/> Phone Screen Notes</h4>
                                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap border p-3 rounded-md bg-background/50">{existingInterview.interviewNotes}</p>
                                  </div>
                              )}
                              {existingInterview.aiGeneratedInsight && (
                                <Alert>
                                    <Sparkles className="h-4 w-4" />
                                    <AlertTitle>AI-Generated Insight</AlertTitle>
                                    <AlertDescription className="space-y-4 mt-2 whitespace-pre-wrap">
                                        <p className='text-sm text-foreground'>{existingInterview.aiGeneratedInsight}</p>
                                    </AlertDescription>
                                </Alert>
                              )}
                          </div>
                      ) : (
                          <Form {...phoneScreenForm}>
                              <form onSubmit={phoneScreenForm.handleSubmit(onPhoneScreenSubmit)} className="space-y-8">
                                  <FormField
                                      control={phoneScreenForm.control}
                                      name="interviewNotes"
                                      render={({ field }) => (
                                          <FormItem>
                                              <FormLabel>Interview Notes</FormLabel>
                                              <FormControl>
                                                  <Textarea placeholder="Notes from the phone screen..." {...field} rows={4} />
                                              </FormControl>
                                              <FormMessage />
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
                                  <div className="flex justify-end">
                                      <Button type="submit" disabled={isSubmitting}>
                                          {isSubmitting ? (
                                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                          ) : (
                                              <UserCheck className="mr-2 h-4 w-4" />
                                          )}
                                          Save Phone Screen
                                      </Button>
                                  </div>
                              </form>
                          </Form>
                      )}
                  </CardContent>
              </Card>

              {isEventEditable && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Next Step: Schedule Event</CardTitle>
                        <CardDescription>Select the hiring pathway and schedule the next event.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...scheduleEventForm}>
                            <form onSubmit={scheduleEventForm.handleSubmit(onScheduleEventSubmit)} className="space-y-6">
                                <FormField
                                    control={scheduleEventForm.control}
                                    name="interviewPathway"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>Interview Pathway</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col sm:flex-row gap-4">
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
                                        {interviewPathway === 'separate' ? (
                                            <FormField
                                                control={scheduleEventForm.control}
                                                name="interviewMethod"
                                                render={({ field }) => (
                                                    <FormItem className="space-y-3">
                                                        <FormLabel>Final Interview Method</FormLabel>
                                                        <FormControl>
                                                            <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4">
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
                                        ) : (
                                            <FormField
                                            control={scheduleEventForm.control}
                                            name="interviewMethod"
                                            render={({ field }) => (
                                                <FormItem className="space-y-3">
                                                    <FormLabel>Final Interview Method</FormLabel>
                                                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4" disabled={true}>
                                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                                            <FormControl><RadioGroupItem value="In-Person" /></FormControl>
                                                            <FormLabel className="font-normal flex items-center gap-2"><Briefcase /> In-Person</FormLabel>
                                                        </FormItem>
                                                    </RadioGroup>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                            />
                                        )}
                                        
                                        <div className="flex flex-col sm:flex-row gap-4 items-start">
                                            <FormField
                                                control={scheduleEventForm.control}
                                                name="eventDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col flex-1">
                                                        <FormLabel>
                                                            {interviewPathway === 'separate' ? 'Final Interview Date' : 'Combined Session Date'}
                                                        </FormLabel>
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
                                                                <Calendar
                                                                    mode="single"
                                                                    selected={field.value}
                                                                    onSelect={field.onChange}
                                                                    initialFocus
                                                                    footer={
                                                                        <div className="flex gap-2 p-2 border-t">
                                                                            <Button size="sm" variant="ghost" type="button" onClick={() => field.onChange(new Date())}>Today</Button>
                                                                            <Button size="sm" variant="ghost" type="button" onClick={() => field.onChange(addDays(new Date(), 1))}>Tomorrow</Button>
                                                                            <Button size="sm" variant="ghost" type="button" onClick={() => field.onChange(addDays(new Date(), 7))}>Next Week</Button>
                                                                        </div>
                                                                    }
                                                                />
                                                            </PopoverContent>
                                                        </Popover>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={scheduleEventForm.control}
                                                name="eventTime"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col flex-1">
                                                        <FormLabel>
                                                            {interviewPathway === 'separate' ? 'Final Interview Time' : 'Combined Session Time'}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input type="time" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                         <FormField
                                            control={scheduleEventForm.control}
                                            name="includeReferenceForm"
                                            render={({ field }) => (
                                                <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                                    <FormControl>
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                    </FormControl>
                                                    <div className="space-y-1 leading-none">
                                                        <FormLabel>
                                                            Include Reference Form in confirmation email
                                                        </FormLabel>
                                                    </div>
                                                </FormItem>
                                            )}
                                        />
                                    </>
                                )}
                                <div className="flex justify-end">
                                    <Button type="submit" disabled={isScheduleSubmitting}>
                                        {isScheduleSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                        Schedule Event
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
              )}
            </div>
            
            <div className="space-y-6">
                {selectedCaregiver && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Overall Candidate Assessment</CardTitle>
                            <CardDescription>This rating and notes can be updated at any point in the process.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...assessmentForm}>
                                <form onSubmit={assessmentForm.handleSubmit(onAssessmentSubmit)} className="space-y-6">
                                    
                                    <FormField
                                        control={assessmentForm.control}
                                        name="candidateRating"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Candidate Rating</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {ratingOptions.map(option => (
                                                    <FormItem key={option.value} className="flex items-center space-x-3 space-y-0 p-3 border rounded-md has-[:checked]:bg-accent/10 has-[:checked]:border-accent">
                                                        <FormControl><RadioGroupItem value={option.value} /></FormControl>
                                                        <FormLabel className="font-normal text-sm">{option.label}</FormLabel>
                                                    </FormItem>
                                                ))}
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    
                                     {areNotesEditable && (
                                        <FormField
                                            control={assessmentForm.control}
                                            name="finalInterviewNotes"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Final Interview Notes</FormLabel>
                                                    <FormControl>
                                                        <Textarea placeholder="Enter notes from the in-person/video interview..." {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                     )}

                                    <div className="flex justify-between items-center pt-2">
                                        {isProcessActive && (
                                            <Button type="button" variant="destructive" onClick={() => setIsRejectDialogOpen(true)}>
                                                <UserX className="mr-2 h-4 w-4" />
                                                Reject Candidate
                                            </Button>
                                        )}
                                        <div className="flex-grow"></div>
                                        <Button type="submit" disabled={isAssessmentSaving}>
                                            {isAssessmentSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                            Save Assessment
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
                            <CardTitle>Final Interview Decision</CardTitle>
                            <CardDescription>Update the status of the final interview for {selectedCaregiver?.fullName}.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex justify-center gap-4 pt-2">
                                <Button onClick={() => handleUpdateFinalInterviewStatus('Passed')} disabled={isSubmitting} variant="default">Pass</Button>
                                <Button onClick={() => handleUpdateFinalInterviewStatus('Failed')} disabled={isSubmitting} variant="destructive">Fail</Button>
                            </div>
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
                                                            <Calendar
                                                                mode="single"
                                                                selected={field.value}
                                                                onSelect={field.onChange}
                                                                initialFocus
                                                                footer={
                                                                    <div className="flex gap-2 p-2 border-t">
                                                                        <Button size="sm" variant="ghost" type="button" onClick={() => field.onChange(new Date())}>Today</Button>
                                                                        <Button size="sm" variant="ghost" type="button" onClick={() => field.onChange(addDays(new Date(), 1))}>Tomorrow</Button>
                                                                        <Button size="sm" variant="ghost" type="button" onClick={() => field.onChange(addDays(new Date(), 7))}>Next Week</Button>
                                                                    </div>
                                                                }
                                                            />
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
                                    <FormField
                                        control={orientationForm.control}
                                        name="includeReferenceForm"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4">
                                                <FormControl>
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <div className="space-y-1 leading-none">
                                                    <FormLabel>
                                                        Include Reference Form in confirmation email
                                                    </FormLabel>
                                                </div>
                                            </FormItem>
                                        )}
                                    />
                                    <div className="flex justify-end items-center">
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

                {selectedCaregiver && shouldShowCompletedSummary && (
                     <Card>
                        <CardHeader>
                            <CardTitle>Completed Steps</CardTitle>
                            <CardDescription>Summary of the completed process for {selectedCaregiver?.fullName}.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {existingInterview?.rejectionReason && (
                                <Alert variant="destructive">
                                    <UserX className="h-4 w-4" />
                                    <AlertTitle>Candidate Rejected</AlertTitle>
                                    <AlertDescription>
                                        Reason: <span className="font-semibold">{existingInterview.rejectionReason}</span>
                                        <br />
                                        Date: {existingInterview.rejectionDate ? format((existingInterview.rejectionDate as any).toDate(), 'PP') : 'N/A'}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {existingInterview?.interviewDateTime && (
                                <Alert>
                                    <Briefcase className="h-4 w-4" />
                                    <AlertTitle>Final Interview</AlertTitle>
                                    <AlertDescription>
                                        Status: <span className="font-semibold text-green-600">Passed</span>
                                        <br />
                                        Date: {format((existingInterview.interviewDateTime as any).toDate(), 'PPpp')}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {existingInterview?.finalInterviewStatus === 'Pending reference checks' && (
                                <Alert variant="default" className="bg-yellow-100 border-yellow-300">
                                    <FileClock className="h-4 w-4 text-yellow-800"/>
                                    <AlertTitle className="text-yellow-800">Pending Reference Checks</AlertTitle>
                                    <AlertDescription className="text-yellow-700">
                                        The candidate has been sent the reference check forms.
                                        <Button onClick={handleApproveReferences} size="sm" className="mt-2" disabled={isSubmitting}>Approve References & Proceed</Button>
                                    </AlertDescription>
                                </Alert>
                            )}
                            {existingInterview?.orientationDateTime && (
                                <Alert>
                                    <GraduationCap className="h-4 w-4" />
                                    <AlertTitle>Orientation</AlertTitle>
                                    <AlertDescription>
                                        Status: <span className="font-semibold text-green-600">Scheduled</span>
                                        <br />
                                        Date: {format((existingInterview.orientationDateTime instanceof Date ? existingInterview.orientationDateTime : (existingInterview.orientationDateTime as any).toDate()), 'PPpp')}
                                    </AlertDescription>
                                </Alert>
                            )}
                            {existingEmployee && (
                                <Alert>
                                    <UserCheck className="h-4 w-4" />
                                    <AlertTitle>Hiring Complete</AlertTitle>
                                    <AlertDescription>
                                        Hired On: <span className="font-semibold">{format((existingEmployee.hireDate as any).toDate(), 'PP')}</span>
                                        <br />
                                        Hiring Manager: <span className="font-semibold">{existingEmployee.hiringManager}</span>
                                        <br />
                                        TeleTrack PIN: <span className="font-semibold">{existingEmployee.teletrackPin}</span>
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>
                )}


                {selectedCaregiver && shouldShowHiringForm && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Hiring &amp; Onboarding: {selectedCaregiver?.fullName}</CardTitle>
                             <CardDescription>
                                The candidate has passed all stages. Enter hiring details to complete onboarding.
                            </CardDescription>
                            <div className="flex items-center gap-4 pt-2">
                                <Button
                                    type="button"
                                    onClick={handleInitiateOnboarding}
                                    disabled={isOnboardingInitiating || !existingInterview || existingInterview.onboardingFormsInitiated}
                                    className="bg-accent hover:bg-accent/90"
                                >
                                    {isOnboardingInitiating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                    {existingInterview?.onboardingFormsInitiated ? 'Onboarding Initiated' : 'Initiate Onboarding Forms'}
                                </Button>
                                {onboardingStatus && selectedCaregiver && (
                                    <Link
                                        href={`/candidate-hiring-forms?candidateId=${selectedCaregiver.id}`}
                                        className="flex items-center gap-2 text-sm font-medium hover:underline"
                                    >
                                        <onboardingStatus.icon className={cn("h-5 w-5", onboardingStatus.color)} />
                                        <span className={cn(onboardingStatus.color)}>
                                            Onboarding Forms Status: {onboardingStatus.text}
                                        </span>
                                    </Link>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <Form {...hiringForm}>
                                <form onSubmit={hiringForm.handleSubmit(onHiringSubmit)} className="space-y-8 pt-4">
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
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
                                                            <Input placeholder="Enter PIN" {...field} value={field.value || ''} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
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
          </div>
      )}


      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Candidate: {selectedCaregiver?.fullName}</DialogTitle>
            <DialogDescription>
              Select a reason for rejection and add any final notes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <RejectCandidateForm onSubmit={handleRejection} isPending={isRejecting} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RejectCandidateForm({ onSubmit, isPending }: { onSubmit: (reason: string, notes: string) => void; isPending: boolean; }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4 pt-4">
      <div className="space-y-2">
        <Label>Reason for Rejection</Label>
         <RadioGroup onValueChange={setReason} value={reason}>
          {rejectionReasons.map((r, i) => (
            <div key={i} className="flex items-center space-x-3 space-y-0">
              <RadioGroupItem value={r} id={`reason-${i}`} />
              <Label htmlFor={`reason-${i}`} className="font-normal">{r}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      <div className="space-y-2">
        <Label>Rejection Notes</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add any specific details here..."
        />
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
        <Button type="button" variant="destructive" disabled={isPending || !reason} onClick={() => onSubmit(reason, notes)}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm Rejection
        </Button>
      </DialogFooter>
    </div>
  );
}
