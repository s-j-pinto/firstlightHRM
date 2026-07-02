
'use client';

import { useState, useMemo, useTransition, useEffect, useCallback } from 'react';
import { useForm, Controller, FormProvider } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from 'next/link';
import { collection, getDocs, setDoc, doc, updateDoc, Timestamp, query, where } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { CaregiverProfile, Interview, CaregiverEmployee, Appointment, InterviewQuestionsFormData, InterviewTransportationFormData } from '@/lib/types';
import { caregiverEmployeeSchema, requiredDateString, interviewQuestionsSchema, interviewTransportationSchema } from '@/lib/types';
import { saveInterviewAndSchedule, rejectCandidate, initiateOnboardingForms } from '@/lib/interviews.actions';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Sparkles, UserCheck, AlertCircle, ExternalLink, Briefcase, Video, GraduationCap, Phone, Star, MessageSquare, CheckCircle, XCircle, UserX, Save, FileText, FileCheck2, FileClock, ClipboardList, CheckSquare, Car } from 'lucide-react';
import { format, isDate, isValid, parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogContent, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DateInput } from './ui/date-input';
import { ScrollArea } from './ui/scroll-area';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';

const safeToDate = (value: any): Date | null => {
    if (!value) return null;
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate();
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
        return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }
    if (isDate(value)) {
        return value;
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
        return d;
    }
    return null;
};

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
    eventDate: requiredDateString,
    eventTime: z.string().min(1, { message: 'An event time is required.'}),
    includeReferenceForm: z.boolean().default(false).optional(),
});

const orientationSchema = z.object({
    orientationDate: requiredDateString,
    orientationTime: z.string().min(1, { message: 'An orientation time is required.' }),
    includeReferenceForm: z.boolean().default(false).optional(),
});

const skillsSchema = z.object({
    hasHospiceExperience: z.boolean().default(false),
    canWorkWithBedBound: z.boolean().default(false),
    canChangeBrief: z.boolean().default(false),
    canTransfer: z.boolean().default(false),
    canPrepareMeals: z.boolean().default(false),
    canDoBedBath: z.boolean().default(false),
    canUseHoyerLift: z.boolean().default(false),
    canUseGaitBelt: z.boolean().default(false),
    canUsePurwick: z.boolean().default(false),
    canEmptyCatheter: z.boolean().default(false),
    canEmptyColostomyBag: z.boolean().default(false),
    canGiveMedication: z.boolean().default(false),
    canTakeBloodPressure: z.boolean().default(false),
});

type TransportationFormData = {
  hasCar: boolean;
  validLicense: boolean;
  q_hasAutoInsurance?: string;
  q_movingViolations?: string;
  q_misdemeanorCharges?: string;
  q_ieTravelAreas?: string;
  q_preferredNotWorkAreas?: string;
}

const transportationSchema = z.object({
    hasCar: z.boolean(),
    validLicense: z.boolean(),
    q_hasAutoInsurance: z.string().optional(),
    q_movingViolations: z.string().optional(),
    q_misdemeanorCharges: z.string().optional(),
    q_ieTravelAreas: z.string().optional(),
    q_preferredNotWorkAreas: z.string().optional(),
});

type PhoneScreenFormData = z.infer<typeof phoneScreenSchema>;
type AssessmentFormData = z.infer<typeof assessmentSchema>;
type ScheduleEventFormData = z.infer<typeof scheduleEventSchema>;
type OrientationFormData = z.infer<typeof orientationSchema>;
type HiringFormData = z.infer<typeof caregiverEmployeeSchema>;
type SkillsFormData = z.infer<typeof skillsSchema>;

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

const skillsCheckboxes = [
    { id: "hasHospiceExperience", label: "Hospice patient experience?" },
    { id: "canWorkWithBedBound", label: "Work with Bed Bound clients?" },
    { id: "canChangeBrief", label: "Able to change briefs?" },
    { id: "canTransfer", label: "Able to Transfer (Transfer board?)" },
    { id: "canPrepareMeals", label: "Able to prepare meals (COOK OR REHEAT)?" },
    { id: "canDoBedBath", label: "Able to bed bath / shower assistance?" },
    { id: "canUseHoyerLift", label: "Able to use Hoyer Lift?" },
    { id: "canUseGaitBelt", label: "Able to use Gait Belt?" },
    { id: "canUsePurwick", label: "Able to use a Purwick?" },
    { id: "canEmptyCatheter", label: "Able to empty catherter?" },
    { id: "canEmptyColostomyBag", label: "Able to empty colostomy bag?" },
    { id: "canGiveMedication", label: "Able to give medication?" },
    { id: "canTakeBloodPressure", label: "Able to take blood Pressure?" },
] as const;

export default function ManageInterviewsClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<CaregiverProfile[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverProfile | null>(null);
  const [existingInterview, setExistingInterview] = useState<Interview | null>(null);
  const [existingEmployee, setExistingEmployee] = useState<CaregiverEmployee | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isQuestionsOpen, setIsQuestionsOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isTransportationOpen, setIsTransportationOpen] = useState(false);
  
  const [isAiPending, startAiTransition] = useTransition();
  const [isSearching, startSearchTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isOrientationSubmitting, startOrientationSubmitTransition] = useTransition();
  const [isScheduleSubmitting, startScheduleSubmitTransition] = useTransition();
  const [isRejecting, startRejectingTransition] = useTransition();
  const [isAssessmentSaving, startAssessmentSavingTransition] = useTransition();
  const [isOnboardingInitiating, startOnboardingInitiation] = useTransition();
  const [isQuestionsSaving, startQuestionsSavingTransition] = useTransition();
  const [isSkillsSaving, startSkillsSavingTransition] = useTransition();
  const [isTransportationSaving, startTransportationSavingTransition] = useTransition();

  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const caregiverProfilesRef = useMemoFirebase(() => db ? collection(db, "caregiver_profiles") : null, [db]);
  const { data: allCaregivers, isLoading: caregiversLoading } = useCollection<CaregiverProfile>(caregiverProfilesRef);

  const employeesRef = useMemoFirebase(() => db ? collection(db, 'caregiver_employees') : null, [db]);
  const { data: allEmployees, isLoading: employeesLoading } = useCollection<CaregiverEmployee>(employeesRef);
  
  const phoneScreenForm = useForm<PhoneScreenFormData>({
    resolver: zodResolver(phoneScreenSchema),
    defaultValues: {
      interviewNotes: '',
      phoneScreenPassed: 'Yes',
    },
  });

  const assessmentForm = useForm<AssessmentFormData>({
      resolver: zodResolver(assessmentSchema),
      defaultValues: {
          candidateRating: 'C',
          finalInterviewNotes: '',
      },
  });

  const interviewQuestionsForm = useForm<InterviewQuestionsFormData>({
      resolver: zodResolver(interviewQuestionsSchema),
      defaultValues: {
        q_decideBecomeCaregiver: '',
        q_rewardingChallenging: '',
        q_strengthsWeaknesses: '',
        q_specializedTraining: '',
        q_careerGoals: '',
        q_dementiaExperience: '',
        q_clientUpsetHome: '',
        q_clientTellingLeave: '',
        q_clientCombative: '',
        q_clientHittingScratching: '',
        q_deceasedSpouse: '',
        q_difficultSituation: '',
        q_clientRefusal: '',
        q_criticismFeedback: '',
        q_medicalEmergencyNoOffice: '',
        q_clientNotes: '',
      }
  });

  const skillsForm = useForm<SkillsFormData>({
      resolver: zodResolver(skillsSchema),
      defaultValues: {
          hasHospiceExperience: false,
          canWorkWithBedBound: false,
          canChangeBrief: false,
          canTransfer: false,
          canPrepareMeals: false,
          canDoBedBath: false,
          canUseHoyerLift: false,
          canUseGaitBelt: false,
          canUsePurwick: false,
          canEmptyCatheter: false,
          canEmptyColostomyBag: false,
          canGiveMedication: false,
          canTakeBloodPressure: false,
      }
  });

  const transportationForm = useForm<TransportationFormData>({
      resolver: zodResolver(transportationSchema),
      defaultValues: {
          hasCar: false,
          validLicense: false,
          q_hasAutoInsurance: '',
          q_movingViolations: '',
          q_misdemeanorCharges: '',
          q_ieTravelAreas: '',
          q_preferredNotWorkAreas: '',
      }
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
      inPersonInterviewDate: '',
      hireDate: format(new Date(), 'MM/dd/yyyy'),
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
      phoneScreenPassed: 'Yes',
    });
    assessmentForm.reset({
        candidateRating: 'C',
        finalInterviewNotes: '',
    });
    interviewQuestionsForm.reset();
    skillsForm.reset();
    transportationForm.reset();
    scheduleEventForm.reset({ includeReferenceForm: false });
    orientationForm.reset({ includeReferenceForm: false });
    hiringForm.reset({
        caregiverProfileId: '',
        interviewId: '',
        inPersonInterviewDate: '',
        hireDate: format(new Date(), 'MM/dd/yyyy'),
        hiringComments: '',
        hiringManager: 'Lolita Pinto',
        teletrackPin: '',
    });
    setAuthUrl(null);
    setSearchTerm('');
    setSearchResults([]);
    router.replace(pathname);
  }, [hiringForm, orientationForm, phoneScreenForm, assessmentForm, interviewQuestionsForm, skillsForm, transportationForm, scheduleEventForm, router, pathname]);

  const handleSelectCaregiver = useCallback(async (caregiver: CaregiverProfile) => {
    handleCancel();
    router.replace(pathname);
    
    setSelectedCaregiver(caregiver);
    setSearchResults([]);
    setSearchTerm('');
    
    skillsForm.reset({
        hasHospiceExperience: caregiver.hasHospiceExperience || false,
        canWorkWithBedBound: caregiver.canWorkWithBedBound || false,
        canChangeBrief: caregiver.canChangeBrief || false,
        canTransfer: caregiver.canTransfer || false,
        canPrepareMeals: caregiver.canPrepareMeals || false,
        canDoBedBath: caregiver.canDoBedBath || false,
        canUseHoyerLift: caregiver.canUseHoyerLift || false,
        canUseGaitBelt: caregiver.canUseGaitBelt || false,
        canUsePurwick: caregiver.canUsePurwick || false,
        canEmptyCatheter: caregiver.canEmptyCatheter || false,
        canEmptyColostomyBag: caregiver.canEmptyColostomyBag || false,
        canGiveMedication: caregiver.canGiveMedication || false,
        canTakeBloodPressure: caregiver.canTakeBloodPressure || false,
    });

    if (!db) return;
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
            
            setExistingInterview(interviewData);

            const interviewDate = interviewData.interviewDateTime ? safeToDate(interviewData.interviewDateTime) : undefined;
            
            phoneScreenForm.reset({
                interviewNotes: interviewData.interviewNotes || '',
                phoneScreenPassed: interviewData.phoneScreenPassed as 'Yes' | 'No' || 'Yes',
            });

            assessmentForm.reset({
                candidateRating: interviewData.candidateRating || 'C',
                finalInterviewNotes: interviewData.finalInterviewNotes || '',
            });

            interviewQuestionsForm.reset({
                q_decideBecomeCaregiver: interviewData.q_decideBecomeCaregiver || '',
                q_rewardingChallenging: interviewData.q_rewardingChallenging || '',
                q_strengthsWeaknesses: interviewData.q_strengthsWeaknesses || '',
                q_specializedTraining: interviewData.q_specializedTraining || '',
                q_careerGoals: interviewData.q_careerGoals || '',
                q_dementiaExperience: interviewData.q_dementiaExperience || '',
                q_clientUpsetHome: interviewData.q_clientUpsetHome || '',
                q_clientTellingLeave: interviewData.q_clientTellingLeave || '',
                q_clientCombative: interviewData.q_clientCombative || '',
                q_clientHittingScratching: interviewData.q_clientHittingScratching || '',
                q_deceasedSpouse: interviewData.q_deceasedSpouse || '',
                q_difficultSituation: interviewData.q_difficultSituation || '',
                q_clientRefusal: interviewData.q_clientRefusal || '',
                q_criticismFeedback: interviewData.q_criticismFeedback || '',
                q_medicalEmergencyNoOffice: interviewData.q_medicalEmergencyNoOffice || '',
                q_clientNotes: interviewData.q_clientNotes || '',
            });

            transportationForm.reset({
                hasCar: caregiver.hasCar === 'yes',
                validLicense: caregiver.validLicense === 'yes',
                q_hasAutoInsurance: interviewData.q_hasAutoInsurance || '',
                q_movingViolations: interviewData.q_movingViolations || '',
                q_misdemeanorCharges: interviewData.q_misdemeanorCharges || '',
                q_ieTravelAreas: interviewData.q_ieTravelAreas || '',
                q_preferredNotWorkAreas: interviewData.q_preferredNotWorkAreas || '',
            });

            scheduleEventForm.reset({
                interviewPathway: interviewData.interviewPathway || undefined,
                interviewMethod: interviewData.interviewType as 'In-Person' | 'Google Meet' | 'Orientation' | undefined,
                eventDate: interviewDate ? format(interviewDate, 'MM/dd/yyyy') : '',
                eventTime: interviewDate ? format(interviewDate, 'HH:mm') : '',
                includeReferenceForm: false,
            });

            if(interviewData.orientationDateTime) {
                const orientationDate = safeToDate(interviewData.orientationDateTime);
                if (orientationDate) {
                    orientationForm.reset({
                        orientationDate: format(orientationDate, 'MM/dd/yyyy'),
                        orientationTime: format(orientationDate, 'HH:mm')
                    });
                }
            }

            if(interviewData.aiGeneratedInsight) {
                setAiInsight(interviewData.aiGeneratedInsight);
            }
        } else {
             transportationForm.reset({
                hasCar: caregiver.hasCar === 'yes',
                validLicense: caregiver.validLicense === 'yes',
                q_hasAutoInsurance: '',
                q_movingViolations: '',
                q_misdemeanorCharges: '',
                q_ieTravelAreas: '',
                q_preferredNotWorkAreas: '',
            });
        }
    } catch (error) {
        console.error("Error fetching interview data:", error);
    }
  }, [allEmployees, db, handleCancel, orientationForm, phoneScreenForm, assessmentForm, interviewQuestionsForm, skillsForm, transportationForm, scheduleEventForm, router, pathname, toast]);

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
        const interviewDate = existingInterview.interviewDateTime ? safeToDate(existingInterview.interviewDateTime) : undefined;
        
        let orientationDate: Date | null = null;
        if (existingInterview.orientationDateTime) {
            orientationDate = safeToDate(existingInterview.orientationDateTime);
        }
        
        const offerLetterHireDate = selectedCaregiver.hireDate ? safeToDate(selectedCaregiver.hireDate) : null;
        const finalHireDate = existingEmployee?.hireDate ? safeToDate(existingEmployee.hireDate) : (offerLetterHireDate || orientationDate || new Date());

        hiringForm.reset({
            caregiverProfileId: selectedCaregiver.id,
            interviewId: existingInterview.id,
            inPersonInterviewDate: interviewDate ? format(interviewDate, 'MM/dd/yyyy') : '',
            hireDate: finalHireDate ? format(finalHireDate, 'MM/dd/yyyy') : '',
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
    if (!selectedCaregiver) return;

    if (data.phoneScreenPassed === 'No') {
        startRejectingTransition(async () => {
            const result = await rejectCandidate({
                caregiverId: selectedCaregiver.id,
                interviewId: existingInterview?.id || null,
                reason: "Failed Phone Screen",
                notes: data.interviewNotes,
                caregiverName: selectedCaregiver.fullName,
                caregiverEmail: selectedCaregiver.email,
            });
            if (result.error) {
                toast({ title: 'Error', description: result.message, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: "Candidate marked as 'Failed Phone Screen'." });
                handleCancel();
            }
        });
    } else {
        startSubmitTransition(async () => {
            if (!db) return;
            let interviewId = existingInterview?.id;
            let interviewDocRef;
            
            const interviewPayload: Partial<Interview> = {
                caregiverProfileId: selectedCaregiver.id,
                caregiverUid: selectedCaregiver.uid,
                interviewType: "Phone" as const,
                phoneScreenPassed: 'Yes' as const,
                interviewNotes: data.interviewNotes,
                candidateRating: assessmentForm.getValues('candidateRating'),
                aiGeneratedInsight: aiInsight || '',
                lastUpdatedAt: Timestamp.now(),
            };
            
            try {
                if (interviewId) {
                    interviewDocRef = doc(db, 'interviews', interviewId);
                    await updateDoc(interviewDocRef, interviewPayload);
                } else {
                    interviewDocRef = doc(collection(db, 'interviews'));
                    interviewId = interviewDocRef.id;
                    await setDoc(interviewDocRef, { ...interviewPayload, createdAt: Timestamp.now() });
                }

                setExistingInterview(prev => ({ ...(prev || { id: interviewId! }), ...interviewPayload } as Interview));
                toast({ title: 'Success', description: "Phone interview results saved." });

            } catch (serverError) {
                const permissionError = new FirestorePermissionError({
                    path: interviewDocRef ? interviewDocRef.path : collection(db, 'interviews').path,
                    operation: interviewId ? 'update' : 'create',
                    requestResourceData: interviewPayload,
                });
                errorEmitter.emit("permission-error", permissionError);
            }
        });
    }
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

  const onQuestionsSubmit = async (data: InterviewQuestionsFormData) => {
      if (!existingInterview?.id || !db) return;
      startQuestionsSavingTransition(async () => {
          const interviewDocRef = doc(db, 'interviews', existingInterview.id);
          try {
              await updateDoc(interviewDocRef, { ...data, lastUpdatedAt: Timestamp.now() });
              setExistingInterview(prev => prev ? { ...prev, ...data } : null);
              toast({ title: 'Success', description: 'Interview questions saved.' });
              setIsQuestionsOpen(false);
          } catch (error) {
              console.error("Error saving interview questions:", error);
              toast({ title: "Error", description: "Could not save interview questions.", variant: "destructive" });
          }
      });
  }

  const onSkillsSubmit = async (data: SkillsFormData) => {
      if (!selectedCaregiver || !db) return;
      startSkillsSavingTransition(async () => {
          try {
              const profileRef = doc(db, 'caregiver_profiles', selectedCaregiver.id);
              updateDocumentNonBlocking(profileRef, data);
              toast({ title: 'Success', description: 'Caregiver skills and experience updated.' });
              setIsSkillsOpen(false);
          } catch (error) {
              console.error("Error saving skills:", error);
              toast({ title: "Error", description: "Could not save skills and experience.", variant: "destructive" });
          }
      });
  }

  const onTransportationSubmit = async (data: TransportationFormData) => {
      if (!selectedCaregiver || !db) return;
      
      startTransportationSavingTransition(async () => {
          const profileRef = doc(db, 'caregiver_profiles', selectedCaregiver.id);
          const interviewData = {
              q_hasAutoInsurance: data.q_hasAutoInsurance || '',
              q_movingViolations: data.q_movingViolations || '',
              q_misdemeanorCharges: data.q_misdemeanorCharges || '',
              q_ieTravelAreas: data.q_ieTravelAreas || '',
              q_preferredNotWorkAreas: data.q_preferredNotWorkAreas || '',
              lastUpdatedAt: Timestamp.now(),
          };

          try {
              // Update Profile
              updateDocumentNonBlocking(profileRef, {
                  hasCar: data.hasCar ? 'yes' : 'no',
                  validLicense: data.validLicense ? 'yes' : 'no',
              });

              // Update Interview (if exists)
              if (existingInterview?.id) {
                const interviewDocRef = doc(db, 'interviews', existingInterview.id);
                await updateDoc(interviewDocRef, interviewData);
                setExistingInterview(prev => prev ? { ...prev, ...interviewData } : null);
              } else {
                  // If no interview, we just saved the profile.
                  // We might want to create a phone screen or just warn.
              }

              toast({ title: 'Success', description: 'Transportation information updated.' });
              setIsTransportationOpen(false);
          } catch (error) {
              console.error("Error saving transportation details:", error);
              toast({ title: "Error", description: "Could not save transportation information.", variant: "destructive" });
          }
      });
  }


  const onScheduleEventSubmit = async (data: ScheduleEventFormData) => {
    if (!selectedCaregiver || !existingInterview) return;

    startScheduleSubmitTransition(async () => {
       const result = await saveInterviewAndSchedule({
         caregiverProfile: {
           fullName: selectedCaregiver.fullName || '',
           email: selectedCaregiver.email || '',
         },
         eventDate: data.eventDate,
         eventTime: data.eventTime,
         interviewId: existingInterview.id,
         aiInsight: aiInsight || existingInterview.aiGeneratedInsight || '',
         interviewType: data.interviewMethod,
         interviewNotes: phoneScreenForm.getValues('interviewNotes'),
         candidateRating: assessmentForm.getValues('candidateRating'),
         pathway: data.interviewPathway,
         finalInterviewStatus: 'Pending',
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
        if (!existingInterview || !db || !selectedCaregiver) return;

        startSubmitTransition(async () => {
            const interviewDocRef = doc(db, 'interviews', existingInterview.id);
            const { finalInterviewNotes } = assessmentForm.getValues();
            const updateData = { 
                finalInterviewStatus: status,
                finalInterviewNotes: finalInterviewNotes || '',
             };
            
            updateDoc(interviewDocRef, updateData)
              .then(async () => {
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
                caregiverProfile: {
                    fullName: selectedCaregiver.fullName || '',
                    email: selectedCaregiver.email || '',
                },
                eventDate: data.orientationDate,
                eventTime: data.orientationTime,
                interviewId: existingInterview.id,
                aiInsight: aiInsight || '',
                interviewType: 'Orientation',
                interviewNotes: existingInterview.interviewNotes || '',
                candidateRating: assessmentForm.getValues('candidateRating'),
                pathway: 'separate',
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
                const [month, day, year] = data.orientationDate.split('/');
                const isoDate = `${year}-${month}-${day}`;
                const zonedTime = fromZonedTime(`${isoDate}T${data.orientationTime}`, 'America/Los_Angeles');

                 setExistingInterview(prev => prev ? { 
                    ...prev, 
                    orientationScheduled: true, 
                    orientationDateTime: zonedTime,
                    finalInterviewStatus: data.includeReferenceForm ? 'Pending reference checks' : prev.finalInterviewStatus
                 } : null);
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
        hireDate: Timestamp.fromDate(new Date(data.hireDate)),
        teletrackPin: data.teletrackPin,
      };

      const applicantData = {
        fullName: selectedCaregiver.fullName,
        address: selectedCaregiver.address,
        city: selectedCaregiver.city,
        state: selectedCaregiver.state,
        zip: selectedCaregiver.zip,
        phone: selectedCaregiver.phone,
        driversLicenseNumber: selectedCaregiver.driversLicenseNumber,
        email: selectedCaregiver.email,
        dob: selectedCaregiver.dob,
        ssn: selectedCaregiver.ssn,
        hireDate: data.hireDate,
        emergencyContact1_name: selectedCaregiver.emergencyContact1_name,
        emergencyContact1_relation: selectedCaregiver.emergencyContact1_relation,
        emergencyContact1_phone: selectedCaregiver.emergencyContact1_phone,
        emergencyContact1_address: selectedCaregiver.emergencyContact1_address,
        emergencyContact1_city: selectedCaregiver.emergencyContact1_city,
        emergencyContact1_state: selectedCaregiver.emergencyContact1_state,
        emergencyContact1_zip: selectedCaregiver.emergencyContact1_zip,
        emergencyContact2_name: selectedCaregiver.emergencyContact2_name,
        emergencyContact2_relation: selectedCaregiver.emergencyContact2_relation,
        emergencyContact2_phone: selectedCaregiver.emergencyContact2_phone,
        emergencyContact2_address: selectedCaregiver.emergencyContact2_address,
        emergencyContact2_city: selectedCaregiver.emergencyContact2_city,
        emergencyContact2_state: selectedCaregiver.emergencyContact2_state,
        emergencyContact2_zip: selectedCaregiver.emergencyContact2_zip,
      };

      if (data.inPersonInterviewDate) {
        employeeData.inPersonInterviewDate = Timestamp.fromDate(new Date(data.inPersonInterviewDate));
      }

      if (existingEmployee?.id) {
        const employeeDocRef = doc(db, 'caregiver_employees', existingEmployee.id);
        updateDoc(employeeDocRef, employeeData).then(async () => {
          const githubResult = await triggerTeletrackImport(applicantData, data.teletrackPin);
          if (githubResult.success) {
              toast({ title: 'Success', description: 'Employee record updated and TeleTrack import re-triggered.' });
          } else {
              toast({ title: 'Update Partially Successful', description: `Employee record updated, but failed to re-trigger TeleTrack import: ${githubResult.error}`, variant: 'destructive' });
          }
        }).catch(serverError => {
          const permissionError = new FirestorePermissionError({
              path: employeeDocRef.path,
              operation: "update",
              requestResourceData: employeeData,
          });
          errorEmitter.emit("permission-error", permissionError);
        });
      } else {
        const employeeDocRef = doc(db, 'caregiver_employees', selectedCaregiver.id);
        const finalEmployeeData = { ...employeeData, createdAt: Timestamp.now() };
        
        setDoc(employeeDocRef, finalEmployeeData).then(async () => {
          const githubResult = await triggerTeletrackImport(applicantData, data.teletrackPin);
          if (githubResult.success) {
              toast({ title: 'Success', description: 'Caregiver has been successfully hired and TeleTrack applicant created.' });
          } else {
              toast({ title: 'Hiring Partially Successful', description: `Caregiver hired, but failed to create TeleTrack applicant: ${githubResult.error}`, variant: 'destructive' });
          }
          setExistingEmployee({ id: selectedCaregiver.id, ...finalEmployeeData } as CaregiverEmployee);
        }).catch(serverError => {
          const permissionError = new FirestorePermissionError({
              path: employeeDocRef.path,
              operation: "create",
              requestResourceData: finalEmployeeData,
          });
          errorEmitter.emit("permission-error", permissionError);
        });
      }
    });
  };
    
  const handleRejection = (reason: string, notes: string) => {
    if (!selectedCaregiver) return;
    startRejectingTransition(async () => {
        const result = await rejectCandidate({
            caregiverId: selectedCaregiver.id,
            interviewId: existingInterview?.id || null,
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
    if (!existingInterview?.id || !db) return;

    startSubmitTransition(async () => {
        const interviewDocRef = doc(db, 'interviews', existingInterview.id);
        const updateData = { finalInterviewStatus: 'Passed' };
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
                                      <Button type="submit" disabled={isSubmitting || isRejecting}>
                                          {isSubmitting || isRejecting ? (
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
                                                <FormItem className="flex-1">
                                                    <FormLabel>{interviewPathway === 'separate' ? 'Final Interview Date (MM/DD/YYYY)' : 'Combined Session Date (MM/DD/YYYY)'}</FormLabel>
                                                    <FormControl>
                                                        <DateInput name="eventDate" />
                                                    </FormControl>
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
                                        <div className="flex flex-col gap-4 mb-4">
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                className="w-full"
                                                onClick={() => setIsQuestionsOpen(true)}
                                            >
                                                <ClipboardList className="mr-2 h-4 w-4" />
                                                In Person Interview Qs
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                className="w-full"
                                                onClick={() => setIsSkillsOpen(true)}
                                            >
                                                <CheckSquare className="mr-2 h-4 w-4" />
                                                Skills and Experience
                                            </Button>
                                            <Button 
                                                type="button" 
                                                variant="outline" 
                                                className="w-full"
                                                onClick={() => setIsTransportationOpen(true)}
                                            >
                                                <Car className="mr-2 h-4 w-4" />
                                                Transportation
                                            </Button>
                                            <FormField
                                                control={assessmentForm.control}
                                                name="finalInterviewNotes"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>In-Person Interview Notes</FormLabel>
                                                        <FormControl>
                                                            <Textarea placeholder="Enter notes from the in-person/video interview..." {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
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
                                            {isAssessmentSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2" />}
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
                                            <FormItem className="flex-1">
                                                <FormLabel>Orientation Date (MM/DD/YYYY)</FormLabel>
                                                <FormControl>
                                                    <DateInput name="orientationDate" />
                                                </FormControl>
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
                                        Date: {(() => {
                                            const orientDate = safeToDate(existingInterview.orientationDateTime);
                                            return orientDate ? format(orientDate, 'PPpp') : 'Invalid Date';
                                        })()}
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
                                    className="bg-accent text-accent-foreground hover:bg-accent/90"
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
                                                        <FormLabel>Interview Date (MM/DD/YYYY)</FormLabel>
                                                        <FormControl><DateInput name="inPersonInterviewDate" disabled /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={hiringForm.control}
                                                name="hireDate"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel>Hire Date (MM/DD/YYYY)</FormLabel>
                                                        <FormControl><DateInput name="hireDate" /></FormControl>
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
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div tabIndex={0}>
                                                        <Button type="submit" disabled={isSubmitting || !selectedCaregiver?.hcs501EmployeeSignature}>
                                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                                            {existingEmployee ? 'Update Record' : 'Complete Hiring'}
                                                        </Button>
                                                    </div>
                                                </TooltipTrigger>
                                                {!selectedCaregiver?.hcs501EmployeeSignature && (
                                                    <TooltipContent>
                                                        <p>Candidate must complete the HCS 501 form before hiring.</p>
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        </TooltipProvider>
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

      <Dialog open={isQuestionsOpen} onOpenChange={setIsQuestionsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>In-Person Interview Questions & Answers</DialogTitle>
                <DialogDescription>
                    Record the candidate's responses to our standardized interview questions.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 pr-4">
                <FormProvider {...interviewQuestionsForm}>
                    <form className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <FormField
                            control={interviewQuestionsForm.control}
                            name="q_decideBecomeCaregiver"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What made you decide to become a caregiver?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={interviewQuestionsForm.control}
                            name="q_rewardingChallenging"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What do you find most rewarding and most challenging about caregiving?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_strengthsWeaknesses"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What are your greatest strengths and weaknesses?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_specializedTraining"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Do you have any specialized training or certifications?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_careerGoals"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What are your career goals?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_dementiaExperience"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">How much experience do you have with dementia?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_clientUpsetHome"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What would you do if client wants to go home and is very upset?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_clientTellingLeave"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What if client was telling you to leave?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_clientCombative"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What if client is combative?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_clientHittingScratching"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What if client is hitting or trying to scratch you?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_deceasedSpouse"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What if client asks where spouse is (who died years ago.)? Do you tell client spouse is dead, or say he went out for a bit and will be back later.</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_difficultSituation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Describe a difficult or stressful situation you have experienced while caregiving. How did you handle it?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_clientRefusal"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">What would you do if a client refused to cooperate with daily tasks, such as eating or bathing?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_criticismFeedback"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">How do you respond to criticism or feedback from a client or their family? Example: You said "How are you today hon" and client doesn't want to be called hon. OR they accuse you of taking something, Or say they don't want that lunch.</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_medicalEmergencyNoOffice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">How would you handle a medical emergency if the office could not be reached?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={interviewQuestionsForm.control}
                            name="q_clientNotes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Do you write client notes at end of shift? What do you include in the client notes?</FormLabel>
                                    <FormControl><Textarea {...field} rows={1} className="min-h-0" /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </form>
                </FormProvider>
            </ScrollArea>
            <DialogFooter className="mt-6">
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                <Button onClick={interviewQuestionsForm.handleSubmit(onQuestionsSubmit)} disabled={isQuestionsSaving}>
                    {isQuestionsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2" />}
                    Save Form
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSkillsOpen} onOpenChange={setIsSkillsOpen}>
          <DialogContent className="max-w-4xl">
              <DialogHeader>
                  <DialogTitle>Skills and Experience</DialogTitle>
                  <DialogDescription>
                      Review and update the candidate's skills and experience during the in-person interview.
                  </DialogDescription>
              </DialogHeader>
              <FormProvider {...skillsForm}>
                  <form onSubmit={skillsForm.handleSubmit(onSkillsSubmit)} className="space-y-6 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          {skillsCheckboxes.map(skill => (
                              <FormField
                                  key={skill.id}
                                  control={skillsForm.control}
                                  name={skill.id as keyof SkillsFormData}
                                  render={({ field }) => (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                          <FormControl>
                                              <Checkbox
                                                  checked={field.value}
                                                  onCheckedChange={field.onChange}
                                              />
                                          </FormControl>
                                          <div className="space-y-1 leading-none">
                                              <FormLabel className="font-normal text-xs">
                                                  {skill.label}
                                              </FormLabel>
                                          </div>
                                      </FormItem>
                                  )}
                              />
                          ))}
                      </div>
                      <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                          <Button type="submit" disabled={isSkillsSaving}>
                              {isSkillsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2" />}
                              Save Form
                          </Button>
                      </DialogFooter>
                  </form>
              </FormProvider>
          </DialogContent>
      </Dialog>

      <Dialog open={isTransportationOpen} onOpenChange={setIsTransportationOpen}>
          <DialogContent className="max-w-4xl">
              <DialogHeader>
                  <DialogTitle>Transportation Information</DialogTitle>
                  <DialogDescription>
                      Verify vehicle and licensing status, and record geographic preferences.
                  </DialogDescription>
              </DialogHeader>
              <FormProvider {...transportationForm}>
                  <form onSubmit={transportationForm.handleSubmit(onTransportationSubmit)} className="space-y-6 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <FormField
                              control={transportationForm.control}
                              name="hasCar"
                              render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                      <FormControl>
                                          <Checkbox
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                          />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                          <FormLabel className="font-normal">Do you have a reliable vehicle?</FormLabel>
                                      </div>
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={transportationForm.control}
                              name="validLicense"
                              render={({ field }) => (
                                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                      <FormControl>
                                          <Checkbox
                                              checked={field.value}
                                              onCheckedChange={field.onChange}
                                          />
                                      </FormControl>
                                      <div className="space-y-1 leading-none">
                                          <FormLabel className="font-normal">Do you have a valid driver's license or valid California State ID ?</FormLabel>
                                      </div>
                                  </FormItem>
                              )}
                          />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                          <FormField
                              control={transportationForm.control}
                              name="q_hasAutoInsurance"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Do you have auto insurance ?</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={transportationForm.control}
                              name="q_movingViolations"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Any moving violations within the last 10 years ?</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={transportationForm.control}
                              name="q_misdemeanorCharges"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Misdemeanor Charges ?</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={transportationForm.control}
                              name="q_ieTravelAreas"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>What areas of the IE are you willing to travel to?</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                          <FormField
                              control={transportationForm.control}
                              name="q_preferredNotWorkAreas"
                              render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Particular geographic area you prefer not to work ?</FormLabel>
                                      <FormControl><Input {...field} /></FormControl>
                                      <FormMessage />
                                  </FormItem>
                              )}
                          />
                      </div>

                      <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                          <Button type="submit" disabled={isTransportationSaving}>
                              {isTransportationSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2" />}
                              Save Form
                          </Button>
                      </DialogFooter>
                  </form>
              </FormProvider>
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
         <RadioGroup onValueChange={reason => setReason(reason)} value={reason}>
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
