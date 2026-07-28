'use client';

import { useState, useTransition, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { collection, getDocs, setDoc, doc, updateDoc, Timestamp, query, where, limit, getDoc, addDoc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import type { CaregiverProfile, Interview, CaregiverEmployee, InterviewQuestionsFormData, OnboardingSignatures } from '@/lib/types';
import { caregiverEmployeeSchema, requiredDateString, interviewQuestionsSchema, interviewTransportationSchema } from '@/lib/types';
import { saveInterviewAndSchedule, rejectCandidate, initiateOnboardingForms } from '@/lib/interviews.actions';
import { getAiInterviewInsights } from '@/lib/ai.actions';
import { triggerTeletrackImport } from '@/lib/github.actions';
import { searchCandidatesAction } from '@/lib/caregiver.actions';

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
import { Loader2, Search, Sparkles, UserCheck, CheckCircle, Save, FileText, FileCheck2, ClipboardList, CheckSquare, Car, Calendar as CalendarIcon } from 'lucide-react';
import { format, isDate, isValid, parse } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from './ui/alert';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Dialog, DialogFooter, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { DateInput } from './ui/date-input';
import { ScrollArea } from './ui/scroll-area';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Badge } from './ui/badge';
import Link from 'next/link';

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
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            return d;
        }
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

const transportationFormSchema = z.object({
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
type TransportationFormData = z.infer<typeof transportationFormSchema>;

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

const situationQuestionsList = [
    { id: 'q_decideBecomeCaregiver', label: 'What made you decide to become a caregiver?' },
    { id: 'q_rewardingChallenging', label: 'What do you find most rewarding and most challenging about caregiving?' },
    { id: 'q_strengthsWeaknesses', label: 'What are your strengths and weaknesses as a caregiver?' },
    { id: 'q_specializedTraining', label: 'Do you have any specialized training or certifications (e.g., dementia, hospice, first aid)?' },
    { id: 'q_careerGoals', label: 'What are your long-term career goals in the healthcare field?' },
    { id: 'q_dementiaExperience', label: 'How much experience do you have with dementia?' },
    { id: 'q_clientUpsetHome', label: 'What would you do if client wants to go home and is very upset?' },
    { id: 'q_clientTellingLeave', label: 'What if client was telling you to leave?' },
    { id: 'q_clientCombative', label: 'What if client is combative?' },
    { id: 'q_clientHittingScratching', label: 'What if client is hitting or trying to scratch you?' },
    { id: 'q_deceasedSpouse', label: 'What if client asks where spouse is (who died years ago.)?' },
    { id: 'q_difficultSituation', label: 'Describe a difficult or stressful situation you have experienced while caregiving. How did you handle it?' },
    { id: 'q_clientRefusal', label: 'What would you do if a client refused to cooperate with daily tasks, such as eating or bathing?' },
    { id: 'q_criticismFeedback', label: 'How do you respond to criticism or feedback from a client or their family?' },
    { id: 'q_medicalEmergencyNoOffice', label: 'How would you handle a medical emergency if the office could not be reached?' },
    { id: 'q_clientNotes', label: 'Do you write client notes at end of shift? What do you include in the client notes?' },
] as const;

export default function ManageInterviewsClient() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
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

  const signaturesRef = useMemoFirebase(
    () => (selectedCaregiver && db ? doc(db, `caregiver_profiles/${selectedCaregiver.id}/signatures`, 'onboarding_main') : null),
    [selectedCaregiver, db]
  );
  const { data: signaturesData } = useDoc<OnboardingSignatures>(signaturesRef);
  
  const phoneScreenForm = useForm<PhoneScreenFormData>({
    resolver: zodResolver(phoneScreenSchema),
    defaultValues: { interviewNotes: '', phoneScreenPassed: 'Yes' },
  });

  const assessmentForm = useForm<AssessmentFormData>({
      resolver: zodResolver(assessmentSchema),
      defaultValues: { candidateRating: 'C', finalInterviewNotes: '' },
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
      resolver: zodResolver(transportationFormSchema),
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
        interviewPathway: 'separate',
        interviewMethod: 'In-Person',
        eventDate: '',
        eventTime: '',
        includeReferenceForm: false
    },
  });
  
  const orientationForm = useForm<OrientationFormData>({
    resolver: zodResolver(orientationSchema),
    defaultValues: {
        orientationDate: '',
        orientationTime: '',
        includeReferenceForm: false
    }
  });

  const hiringForm = useForm<HiringFormData>({
    resolver: zodResolver(caregiverEmployeeSchema),
    defaultValues: {
      hireDate: format(new Date(), 'MM/dd/yyyy'),
      hiringManager: 'Lolita Pinto',
      teletrackPin: '',
      hiringComments: '',
    }
  });

  const handleSelectCaregiver = useCallback(async (caregiver: { id: string }) => {
    if (!db) return;

    try {
        const profileSnap = await getDoc(doc(db, 'caregiver_profiles', caregiver.id));
        if (!profileSnap.exists()) {
            toast({ title: "Error", description: "Candidate profile not found.", variant: "destructive" });
            return;
        }
        const fullProfile = { ...profileSnap.data(), id: caregiver.id } as CaregiverProfile;
        setSelectedCaregiver(fullProfile);

        const interviewsCollRef = collection(db, 'interviews');
        const interviewQ = query(interviewsCollRef, where("caregiverProfileId", "==", caregiver.id), limit(1));
        const interviewSnapshot = await getDocs(interviewQ);

        if (!interviewSnapshot.empty) {
            const interviewDoc = interviewSnapshot.docs[0];
            const interviewData = { ...interviewDoc.data(), id: interviewDoc.id } as Interview;
            setExistingInterview(interviewData);

            const employeesCollRef = collection(db, 'caregiver_employees');
            const empDoc = await getDoc(doc(employeesCollRef, caregiver.id));
            if (empDoc.exists()) {
                setExistingEmployee({ ...empDoc.data(), id: empDoc.id } as CaregiverEmployee);
            }

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

            skillsForm.reset({
                hasHospiceExperience: !!fullProfile.hasHospiceExperience,
                canWorkWithBedBound: !!fullProfile.canWorkWithBedBound,
                canChangeBrief: !!fullProfile.canChangeBrief,
                canTransfer: !!fullProfile.canTransfer,
                canPrepareMeals: !!fullProfile.canPrepareMeals,
                canDoBedBath: !!fullProfile.canDoBedBath,
                canUseHoyerLift: !!fullProfile.canUseHoyerLift,
                canUseGaitBelt: !!fullProfile.canUseGaitBelt,
                canUsePurwick: !!fullProfile.canUsePurwick,
                canEmptyCatheter: !!fullProfile.canEmptyCatheter,
                canEmptyColostomyBag: !!fullProfile.canEmptyColostomyBag,
                canGiveMedication: !!fullProfile.canGiveMedication,
                canTakeBloodPressure: !!fullProfile.canTakeBloodPressure,
            });

            transportationForm.reset({
                hasCar: fullProfile.hasCar === 'yes',
                validLicense: fullProfile.validLicense === 'yes',
                q_hasAutoInsurance: interviewData.q_hasAutoInsurance || '',
                q_movingViolations: interviewData.q_movingViolations || '',
                q_misdemeanorCharges: interviewData.q_misdemeanorCharges || '',
                q_ieTravelAreas: interviewData.q_ieTravelAreas || '',
                q_preferredNotWorkAreas: interviewData.q_preferredNotWorkAreas || '',
            });

            scheduleEventForm.reset({
                interviewPathway: interviewData.interviewPathway || 'separate',
                interviewMethod: interviewData.interviewType as 'In-Person' | 'Google Meet' || 'In-Person',
                eventDate: interviewDate ? format(interviewDate, 'MM/dd/yyyy') : '',
                eventTime: interviewDate ? format(interviewDate, 'HH:mm') : '',
                includeReferenceForm: false,
            });

            if(interviewData.orientationDateTime) {
                const orientationDate = safeToDate(interviewData.orientationDateTime);
                if (orientationDate) {
                    orientationForm.reset({
                        orientationDate: format(orientationDate, 'MM/dd/yyyy'),
                        orientationTime: format(orientationDate, 'HH:mm'),
                        includeReferenceForm: false
                    });
                }
            }
            if(interviewData.aiGeneratedInsight) setAiInsight(interviewData.aiGeneratedInsight);
        } else {
            setExistingInterview(null);
            setExistingEmployee(null);
            setAiInsight(null);
            phoneScreenForm.reset({ interviewNotes: '', phoneScreenPassed: 'Yes' });
            assessmentForm.reset({ candidateRating: 'C', finalInterviewNotes: '' });
        }
    } catch (error) {
        console.error("Error fetching detailed candidate data:", error);
    }
  }, [db, phoneScreenForm, assessmentForm, interviewQuestionsForm, skillsForm, transportationForm, scheduleEventForm, orientationForm, toast]);

  const handleSearch = useCallback((overrideTerm?: string) => {
    const term = overrideTerm || searchTerm;
    if (!term.trim()) return;

    startSearchTransition(async () => {
      const response = await searchCandidatesAction({ namePrefix: term, limit: 20 });
      if (response.results) {
          setSearchResults(response.results);
          if (response.results.length === 1 && term.includes(' ')) {
              const candidate = response.results[0];
              if (candidate.fullName.toLowerCase() === term.toLowerCase()) {
                  handleSelectCaregiver(candidate);
              }
          }
      }
    });
  }, [searchTerm, handleSelectCaregiver]);

  useEffect(() => {
    const candidateId = searchParams.get('candidateId');
    if (candidateId && !selectedCaregiver) {
        handleSelectCaregiver({ id: candidateId } as any);
    } else {
        const searchParam = searchParams.get('search');
        if (searchParam && !selectedCaregiver) {
            setSearchTerm(searchParam);
            handleSearch(searchParam);
        }
    }
  }, [searchParams, selectedCaregiver, handleSearch, handleSelectCaregiver]);

  const handleCancel = useCallback(() => {
    setSelectedCaregiver(null);
    setExistingInterview(null);
    setExistingEmployee(null);
    setAiInsight(null);
    phoneScreenForm.reset({ interviewNotes: '', phoneScreenPassed: 'Yes' });
    assessmentForm.reset({ candidateRating: 'C', finalInterviewNotes: '' });
    interviewQuestionsForm.reset({
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
    });
    skillsForm.reset({
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
    });
    transportationForm.reset({
        hasCar: false,
        validLicense: false,
        q_hasAutoInsurance: '',
        q_movingViolations: '',
        q_misdemeanorCharges: '',
        q_ieTravelAreas: '',
        q_preferredNotWorkAreas: '',
    });
    scheduleEventForm.reset({
        interviewPathway: 'separate',
        interviewMethod: 'In-Person',
        eventDate: '',
        eventTime: '',
        includeReferenceForm: false
    });
    orientationForm.reset({
        orientationDate: '',
        orientationTime: '',
        includeReferenceForm: false
    });
    hiringForm.reset({
        hireDate: format(new Date(), 'MM/dd/yyyy'),
        hiringManager: 'Lolita Pinto',
        teletrackPin: '',
        hiringComments: '',
    });
    setAuthUrl(null);
    setSearchTerm('');
    setSearchResults([]);
    router.replace(pathname);
  }, [hiringForm, orientationForm, phoneScreenForm, assessmentForm, interviewQuestionsForm, skillsForm, transportationForm, scheduleEventForm, router, pathname]);


  const interviewPathway = scheduleEventForm.watch('interviewPathway');
  useEffect(() => { if (interviewPathway === 'combined') scheduleEventForm.setValue('interviewMethod', 'In-Person'); }, [interviewPathway, scheduleEventForm]);

  const isPhoneScreenCompleted = !!existingInterview?.interviewNotes;
  const isFinalInterviewPending = existingInterview?.finalInterviewStatus === 'Pending' || existingInterview?.finalInterviewStatus === 'Pending reference checks';
  const isProcessActive = !existingInterview?.rejectionReason && !existingEmployee;
  const isEventEditable = isPhoneScreenCompleted && isProcessActive && !existingInterview?.orientationScheduled && existingInterview?.finalInterviewStatus !== 'Passed';
  const isOrientationEditable = existingInterview?.finalInterviewStatus === 'Passed' && !existingInterview?.orientationScheduled && isProcessActive;
  const areNotesEditable = isPhoneScreenCompleted && isProcessActive;

  const handleInitiateOnboarding = () => {
      if (!existingInterview?.id) return;
      startOnboardingInitiation(async () => {
          const result = await initiateOnboardingForms(existingInterview.id);
          if (result.success) toast({ title: 'Success', description: result.success });
          else toast({ title: 'Error', description: result.error, variant: 'destructive'});
      });
  };

  const shouldShowHiringForm = !existingEmployee && existingInterview?.finalInterviewStatus !== 'Rejected at Orientation' && (existingInterview?.orientationScheduled || existingInterview?.finalInterviewStatus === 'Passed') && existingInterview?.finalInterviewStatus !== 'Pending reference checks';

  const getOnboardingStatus = () => {
    if (!existingInterview?.onboardingFormsInitiated) return null;
    const completedForms = onboardingFormCompletionKeys.filter(key => {
        const isCompletedInProfile = !!(selectedCaregiver as any)[key];
        const isCompletedInSignatures = signaturesData ? !!(signaturesData as any)[key] : false;
        return isCompletedInProfile || isCompletedInSignatures;
    }).length;
    if (completedForms === onboardingFormCompletionKeys.length) return { text: "Completed", icon: CheckCircle, color: "text-green-500" };
    if (completedForms > 0) return { text: `Started (${completedForms}/${onboardingFormCompletionKeys.length})`, icon: FileText, color: "text-yellow-500" };
    return { text: "Initiated", icon: FileText, color: "text-blue-500" };
  };
  const onboardingStatus = getOnboardingStatus();

  const handleGenerateInsights = () => {
    if (!selectedCaregiver) return;
    const { interviewNotes } = phoneScreenForm.getValues();
    if (!interviewNotes) {
      toast({ title: "Missing Information", description: "Please provide interview notes before generating insights.", variant: "destructive" });
      return;
    }
    startAiTransition(async () => {
        const result = await getAiInterviewInsights({ ...selectedCaregiver, interviewNotes, candidateRating: assessmentForm.getValues('candidateRating') });
        if (result.error) toast({ title: "AI Error", description: result.error, variant: "destructive"});
        else setAiInsight(result.aiGeneratedInsight || null);
    });
  };
  
  const onPhoneScreenSubmit = async (data: PhoneScreenFormData) => {
    if (!selectedCaregiver) return;
    if (data.phoneScreenPassed === 'No') {
        startRejectingTransition(async () => {
            const result = await rejectCandidate({ caregiverId: selectedCaregiver.id, interviewId: existingInterview?.id || null, reason: "Failed Phone Screen", notes: data.interviewNotes, caregiverName: selectedCaregiver.fullName, caregiverEmail: selectedCaregiver.email });
            if (!result.error) { toast({ title: 'Success', description: "Candidate marked as 'Failed Phone Screen'." }); handleCancel(); }
        });
    } else {
        startSubmitTransition(async () => {
            if (!db) return;
            let interviewId = existingInterview?.id;
            const interviewPayload: Partial<Interview> = { caregiverProfileId: selectedCaregiver.id, caregiverUid: selectedCaregiver.uid, interviewType: "Phone", phoneScreenPassed: 'Yes', interviewNotes: data.interviewNotes, candidateRating: assessmentForm.getValues('candidateRating'), aiGeneratedInsight: aiInsight || '', lastUpdatedAt: Timestamp.now() };
            if (interviewId) await updateDoc(doc(db, 'interviews', interviewId), interviewPayload);
            else { const ref = await addDoc(collection(db, 'interviews'), { ...interviewPayload, createdAt: Timestamp.now() }); interviewId = ref.id; }
            setExistingInterview(prev => ({ ...(prev || { id: interviewId! }), ...interviewPayload } as Interview));
            toast({ title: 'Success', description: "Phone interview results saved." });
        });
    }
  };

  const onAssessmentSubmit = async (data: AssessmentFormData) => {
    if (!selectedCaregiver || !db || !existingInterview?.id) return;
    startAssessmentSavingTransition(async () => {
        const updateData = { candidateRating: data.candidateRating, finalInterviewNotes: data.finalInterviewNotes || '', lastUpdatedAt: Timestamp.now() };
        await updateDoc(doc(db, 'interviews', existingInterview.id), updateData);
        setExistingInterview(prev => prev ? { ...prev, ...updateData } : null);
        toast({ title: 'Success', description: 'Candidate assessment updated.' });
    });
  };

  const onQuestionsSubmit = async (data: InterviewQuestionsFormData) => {
      if (!existingInterview?.id || !db) return;
      startQuestionsSavingTransition(async () => {
          await updateDoc(doc(db, 'interviews', existingInterview.id), { ...data, lastUpdatedAt: Timestamp.now() });
          setExistingInterview(prev => prev ? { ...prev, ...data } : null);
          toast({ title: 'Success', description: 'Interview questions saved.' });
          setIsQuestionsOpen(false);
      });
  }

  const onSkillsSubmit = async (data: SkillsFormData) => {
      if (!selectedCaregiver || !db) return;
      startSkillsSavingTransition(async () => {
          updateDocumentNonBlocking(doc(db, 'caregiver_profiles', selectedCaregiver.id), data);
          toast({ title: 'Success', description: 'Caregiver skills and experience updated.' });
          setIsSkillsOpen(false);
      });
  }

  const onTransportationSubmit = async (data: TransportationFormData) => {
      if (!selectedCaregiver || !db) return;
      startTransportationSavingTransition(async () => {
          updateDocumentNonBlocking(doc(db, 'caregiver_profiles', selectedCaregiver.id), { hasCar: data.hasCar ? 'yes' : 'no', validLicense: data.validLicense ? 'yes' : 'no' });
          if (existingInterview?.id) {
            const updateData = { q_hasAutoInsurance: data.q_hasAutoInsurance, q_movingViolations: data.q_movingViolations, q_misdemeanorCharges: data.q_misdemeanorCharges, q_ieTravelAreas: data.q_ieTravelAreas, q_preferredNotWorkAreas: data.q_preferredNotWorkAreas, lastUpdatedAt: Timestamp.now() };
            await updateDoc(doc(db, 'interviews', existingInterview.id), updateData);
            setExistingInterview(prev => prev ? { ...prev, ...updateData } : null);
          }
          toast({ title: 'Success', description: 'Transportation information updated.' });
          setIsTransportationOpen(false);
      });
  }

  const onScheduleEventSubmit = async (data: ScheduleEventFormData) => {
    if (!selectedCaregiver || !existingInterview) return;
    startScheduleSubmitTransition(async () => {
       const result = await saveInterviewAndSchedule({ caregiverProfile: { fullName: selectedCaregiver.fullName, email: selectedCaregiver.email }, ...data, interviewId: existingInterview.id, aiInsight: aiInsight || existingInterview.aiGeneratedInsight || '', interviewType: data.interviewMethod, interviewNotes: phoneScreenForm.getValues('interviewNotes'), candidateRating: assessmentForm.getValues('candidateRating'), pathway: data.interviewPathway, googleEventId: existingInterview.googleEventId, previousPathway: existingInterview.interviewPathway });
       if (result.authUrl) setAuthUrl(result.authUrl);
       toast({ title: result.error ? 'Error' : 'Success', description: result.message, variant: result.error ? 'destructive' : 'default' });
       if (!result.error) handleCancel();
    });
  }

  const handleUpdateFinalInterviewStatus = async (status: 'Passed' | 'Failed') => {
      if (!existingInterview || !db) return;
      startSubmitTransition(async () => {
          const updateData = { finalInterviewStatus: status, finalInterviewNotes: assessmentForm.getValues('finalInterviewNotes') || '' };
          await updateDoc(doc(db, 'interviews', existingInterview.id), updateData);
          setExistingInterview(prev => prev ? { ...prev, ...updateData } : null);
          toast({ title: "Status Updated", description: `Final interview marked as ${status}.` });
          if(status === 'Failed') handleCancel();
      });
  };
    
  const onOrientationSubmit = (data: OrientationFormData) => {
      if (!selectedCaregiver || !existingInterview) return;
      startOrientationSubmitTransition(async () => {
          const result = await saveInterviewAndSchedule({ caregiverProfile: { fullName: selectedCaregiver.fullName, email: selectedCaregiver.email }, eventDate: data.orientationDate, eventTime: data.orientationTime, interviewId: existingInterview.id, aiInsight: aiInsight || '', interviewType: 'Orientation', interviewNotes: existingInterview.interviewNotes || '', candidateRating: assessmentForm.getValues('candidateRating'), pathway: 'separate', googleEventId: existingInterview.googleEventId, previousPathway: existingInterview.interviewPathway, includeReferenceForm: data.includeReferenceForm });
          if (result.authUrl) setAuthUrl(result.authUrl);
          toast({ title: result.error ? 'Error' : 'Success', description: result.message, variant: result.error ? 'destructive' : 'default' });
      });
  }

  const onHiringSubmit = (data: HiringFormData) => {
    if (!selectedCaregiver || !existingInterview || !db) return;
    startSubmitTransition(async () => {
      const employeeData = { caregiverProfileId: selectedCaregiver.id, interviewId: existingInterview.id, hiringManager: data.hiringManager, hiringComments: data.hiringComments, hireDate: Timestamp.fromDate(new Date(data.hireDate)), teletrackPin: data.teletrackPin, createdAt: Timestamp.now() };
      await setDoc(doc(db, 'caregiver_employees', selectedCaregiver.id), employeeData);
      await triggerTeletrackImport(selectedCaregiver, data.teletrackPin);
      toast({ title: 'Success', description: 'Caregiver hired and TeleTrack import triggered.' });
      setExistingEmployee({ id: selectedCaregiver.id, ...employeeData } as any);
    });
  };
    
  const handleRejection = (reason: string, notes: string) => {
    if (!selectedCaregiver) return;
    startRejectingTransition(async () => {
        const result = await rejectCandidate({ caregiverId: selectedCaregiver.id, interviewId: existingInterview?.id || null, reason, notes, caregiverName: selectedCaregiver.fullName, caregiverEmail: selectedCaregiver.email });
        if (!result.error) { toast({ title: 'Success', description: result.message }); handleCancel(); }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle>Interview Management</CardTitle>
                <CardDescription>Search for an applicant to begin or continue their interview process.</CardDescription>
            </div>
             {selectedCaregiver && <Button variant="outline" size="sm" onClick={handleCancel}>Switch Candidate</Button>}
        </div>
        </CardHeader>
        <CardContent>
        {!selectedCaregiver && (
            <div className="space-y-4">
                <div className="flex gap-2">
                    <Input placeholder="Enter name or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
                    <Button onClick={() => handleSearch()} disabled={isSearching || !searchTerm.trim()}>{isSearching ? <Loader2 className="animate-spin" /> : <Search />}<span className="ml-2">Search</span></Button>
                </div>
                {searchResults.length > 0 ? (
                    <ul className="border rounded-md divide-y">
                        {searchResults.map((caregiver) => (
                            <li key={caregiver.id} className="p-3 hover:bg-muted cursor-pointer flex justify-between items-center" onClick={() => handleSelectCaregiver(caregiver as any)}>
                                <div className="flex items-center gap-3">
                                    <div><p className="font-semibold">{caregiver.fullName}</p><p className="text-xs text-muted-foreground">{caregiver.email}</p></div>
                                    {caregiver.master360Saved && <CheckCircle className="h-4 w-4 text-blue-500" title="Master 360 Saved" />}
                                </div>
                                <div className='text-right'><Badge variant="outline">{caregiver.hiringStatus || 'Applied'}</Badge></div>
                            </li>
                        ))}
                    </ul>
                ) : !isSearching && searchTerm.trim() !== '' && (
                    <div className="p-8 text-center text-muted-foreground border rounded-md border-dashed">
                        No candidates found. Try a different name or full email address.
                    </div>
                )}
            </div>
        )}
        </CardContent>
      </Card>
      
      {selectedCaregiver && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
             <div className="space-y-6">
              <Card>
                  <CardHeader>
                      <CardTitle>Phone Screen: {selectedCaregiver.fullName}</CardTitle>
                      <CardDescription>{isPhoneScreenCompleted ? "Phone screen results reviewed." : "Record phone interview notes."}</CardDescription>
                  </CardHeader>
                  <CardContent>
                      {isPhoneScreenCompleted ? (
                          <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2"><span className="font-semibold">Status:</span> {existingInterview?.phoneScreenPassed === 'Yes' ? <Badge className="bg-green-500">Passed</Badge> : <Badge className="bg-red-500">Failed</Badge>}</div>
                                  <Button asChild variant="link" size="sm" className="h-auto p-0 text-accent font-normal">
                                      <Link href={`/candidate-hiring-forms?candidateId=${selectedCaregiver.id}`}>
                                          <FileText className="mr-1 h-4 w-4" />
                                          Go to Hiring Forms (Master 360)
                                      </Link>
                                  </Button>
                              </div>
                              {existingInterview?.interviewNotes && <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">{existingInterview.interviewNotes}</div>}
                              {existingInterview?.aiGeneratedInsight && <Alert className="bg-accent/5 border-accent/20"><Sparkles className="h-4 w-4 text-accent" /><AlertDescription className="text-xs mt-2">{existingInterview.aiGeneratedInsight}</AlertDescription></Alert>}
                          </div>
                      ) : (
                          <Form {...phoneScreenForm}>
                              <form onSubmit={phoneScreenForm.handleSubmit(onPhoneScreenSubmit)} className="space-y-6">
                                  <FormField 
                                    control={phoneScreenForm.control} 
                                    name="interviewNotes" 
                                    render={({ field }) => ( 
                                      <FormItem>
                                          <div className="flex justify-between items-end">
                                              <FormLabel>Interview Notes</FormLabel>
                                              <Button asChild variant="link" size="sm" className="h-auto p-0 text-accent font-normal">
                                                  <Link href={`/candidate-hiring-forms?candidateId=${selectedCaregiver.id}`}>
                                                      <FileText className="mr-1 h-4 w-4" />
                                                      Go to Hiring Forms (Master 360)
                                                  </Link>
                                              </Button>
                                          </div>
                                          <FormControl><Textarea placeholder="Notes..." {...field} rows={4} /></FormControl>
                                          <FormMessage />
                                      </FormItem> 
                                    )} 
                                  />
                                  <div className="flex justify-center"><Button type="button" onClick={handleGenerateInsights} disabled={isAiPending}>{isAiPending ? <Loader2 className="animate-spin" /> : <Sparkles />}<span className="ml-2">Generate AI Summary</span></Button></div>
                                  <FormField control={phoneScreenForm.control} name="phoneScreenPassed" render={({ field }) => ( <FormItem><FormLabel>Passed?</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4"><FormItem className="flex items-center space-x-2"><RadioGroupItem value="Yes" /><span>Yes</span></FormItem><FormItem className="flex items-center space-x-2"><RadioGroupItem value="No" /><span>No</span></FormItem></RadioGroup></FormControl><FormMessage /></FormItem> )} />
                                  <div className="flex justify-end"><Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin mr-2" />}Save Results</Button></div>
                              </form>
                          </Form>
                      )}
                  </CardContent>
              </Card>

              {isEventEditable && (
                <Card>
                    <CardHeader><CardTitle>Next Step: Final Interview</CardTitle></CardHeader>
                    <CardContent>
                        <Form {...scheduleEventForm}>
                            <form onSubmit={scheduleEventForm.handleSubmit(onScheduleEventSubmit)} className="space-y-4">
                                <FormField control={scheduleEventForm.control} name="interviewPathway" render={({ field }) => ( <FormItem><FormLabel>Pathway</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select pathway..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="separate">Separate Interview & Orientation</SelectItem><SelectItem value="combined">Combined Session</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                <FormField control={scheduleEventForm.control} name="interviewMethod" render={({ field }) => ( 
                                    <FormItem>
                                        <FormLabel>Method</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={interviewPathway === 'combined'}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="In-Person">In-Person</SelectItem>
                                                <SelectItem value="Google Meet">Google Meet</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem> 
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={scheduleEventForm.control} name="eventDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={scheduleEventForm.control} name="eventTime" render={({ field }) => ( <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                <div className="flex justify-end"><Button type="submit" disabled={isScheduleSubmitting}>{isScheduleSubmitting && <Loader2 className="animate-spin mr-2" />}Schedule</Button></div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
              )}

              {isOrientationEditable && (
                  <Card>
                      <CardHeader><CardTitle>Next Step: Schedule Orientation</CardTitle></CardHeader>
                      <CardContent>
                          <Form {...orientationForm}>
                              <form onSubmit={orientationForm.handleSubmit(onOrientationSubmit)} className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                      <FormField control={orientationForm.control} name="orientationDate" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                                      <FormField control={orientationForm.control} name="orientationTime" render={({ field }) => ( <FormItem><FormLabel>Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                  </div>
                                  <div className="flex justify-end"><Button type="submit" disabled={isOrientationSubmitting}>{isOrientationSubmitting && <Loader2 className="animate-spin mr-2" />}Schedule Orientation</Button></div>
                              </form>
                          </Form>
                      </CardContent>
                  </Card>
              )}
            </div>
            
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Candidate Assessment</CardTitle></CardHeader>
                    <CardContent>
                        <Form {...assessmentForm}>
                            <form onSubmit={assessmentForm.handleSubmit(onAssessmentSubmit)} className="space-y-4">
                                <FormField control={assessmentForm.control} name="candidateRating" render={({ field }) => ( <FormItem><FormLabel>Rating</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{ratingOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                {areNotesEditable && (
                                    <div className="grid grid-cols-1 gap-2 pt-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsQuestionsOpen(true)}><ClipboardList className="mr-2 h-4 w-4" />Situations</Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsSkillsOpen(true)}><CheckSquare className="mr-2 h-4 w-4" />Skills & Exp</Button>
                                        <Button type="button" variant="outline" size="sm" onClick={() => setIsTransportationOpen(true)}><Car className="mr-2 h-4 w-4" />Transportation</Button>
                                        <FormField control={assessmentForm.control} name="finalInterviewNotes" render={({ field }) => ( <FormItem><FormLabel>Interview Notes</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    {isProcessActive && <Button type="button" variant="destructive" onClick={() => setIsRejectDialogOpen(true)} size="sm">Reject</Button>}
                                    <Button type="submit" disabled={isAssessmentSaving} size="sm"><Save className="mr-2 h-4 w-4" />Save</Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                {isFinalInterviewPending && (
                    <Card className="bg-accent/5">
                        <CardHeader><CardTitle>Decision</CardTitle></CardHeader>
                        <CardContent className="flex justify-center gap-4"><Button onClick={() => handleUpdateFinalInterviewStatus('Passed')} disabled={isSubmitting}>Pass</Button><Button onClick={() => handleUpdateFinalInterviewStatus('Failed')} variant="destructive" disabled={isSubmitting}>Fail</Button></CardContent>
                    </Card>
                )}

                {shouldShowHiringForm && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Hire & Onboard</CardTitle>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {existingInterview?.onboardingFormsInitiated && (
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={`/candidate-hiring-forms?candidateId=${selectedCaregiver.id}`}>
                                            <FileCheck2 className="mr-2 h-4 w-4" />
                                            View Hiring Forms
                                        </Link>
                                    </Button>
                                )}
                                <Button onClick={handleInitiateOnboarding} disabled={existingInterview?.onboardingFormsInitiated} size="sm">
                                    <FileText className="mr-2 h-4 w-4"/>
                                    {existingInterview?.onboardingFormsInitiated ? 'Docs Initiated' : 'Initiate Docs'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Form {...hiringForm}>
                                <form onSubmit={hiringForm.handleSubmit(onHiringSubmit)} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={hiringForm.control} name="hireDate" render={({ field }) => ( <FormItem><FormLabel>Hire Date</FormLabel><FormControl><DateInput {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={hiringForm.control} name="teletrackPin" render={({ field }) => ( <FormItem><FormLabel>TeleTrack PIN</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <Button type="submit" className="w-full" disabled={isSubmitting || !signaturesData?.hcs501EmployeeSignature}><UserCheck className="mr-2 h-4 w-4" />Hire Candidate</Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                )}
            </div>
          </div>
      )}

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}><DialogContent><DialogHeader><DialogTitle>Reject Candidate</DialogTitle></DialogHeader><RejectCandidateForm onSubmit={handleRejection} isPending={isRejecting} /></DialogContent></Dialog>
      
      <Dialog open={isQuestionsOpen} onOpenChange={setIsQuestionsOpen}>
        <DialogContent className="sm:max-w-[80vw] max-h-[90vh]">
            <DialogHeader><DialogTitle>Situation Questions</DialogTitle></DialogHeader>
            <ScrollArea className="flex-1">
                <Form {...interviewQuestionsForm}>
                    <form onSubmit={interviewQuestionsForm.handleSubmit(onQuestionsSubmit)} className="space-y-4 p-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {situationQuestionsList.map((question) => (
                                <FormField key={question.id} control={interviewQuestionsForm.control} name={question.id as any} render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs">{question.label}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            ))}
                        </div>
                        <DialogFooter><Button type="submit" disabled={isQuestionsSaving}>{isQuestionsSaving && <Loader2 className="animate-spin mr-2" />}Save Questions</Button></DialogFooter>
                    </form>
                </Form>
            </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={isSkillsOpen} onOpenChange={setIsSkillsOpen}>
        <DialogContent className="sm:max-w-[600px]">
            <DialogHeader><DialogTitle>Skills & Experience</DialogTitle></DialogHeader>
            <Form {...skillsForm}>
                <form onSubmit={skillsForm.handleSubmit(onSkillsSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {skillsCheckboxes.map(item => (
                            <FormField key={item.id} control={skillsForm.control} name={item.id as any} render={({ field }) => (
                                <FormItem className="flex items-center space-x-2 space-y-0 p-2 border rounded"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal text-xs">{item.label}</FormLabel></FormItem>
                            )} />
                        ))}
                    </div>
                    <DialogFooter><Button type="submit" disabled={isSkillsSaving}>{isSkillsSaving && <Loader2 className="animate-spin mr-2" />}Save Skills</Button></DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransportationOpen} onOpenChange={setIsTransportationOpen}>
        <DialogContent className="sm:max-w-2xl">
            <DialogHeader><DialogTitle>Transportation Information</DialogTitle></DialogHeader>
            <Form {...transportationForm}>
                <form onSubmit={transportationForm.handleSubmit(onTransportationSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={transportationForm.control} name="hasCar" render={({ field }) => ( <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Has Car</FormLabel></FormItem> )} />
                        <FormField control={transportationForm.control} name="validLicense" render={({ field }) => ( <FormItem className="flex items-center space-x-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Valid License</FormLabel></FormItem> )} />
                    </div>
                    <FormField control={transportationForm.control} name="q_hasAutoInsurance" render={({ field }) => ( <FormItem><FormLabel>Auto Insurance</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={transportationForm.control} name="q_movingViolations" render={({ field }) => ( <FormItem><FormLabel>Moving Violations</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={transportationForm.control} name="q_misdemeanorCharges" render={({ field }) => ( <FormItem><FormLabel>Misdemeanor Charges</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={transportationForm.control} name="q_ieTravelAreas" render={({ field }) => ( <FormItem><FormLabel>Travel Areas</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={transportationForm.control} name="q_preferredNotWorkAreas" render={({ field }) => ( <FormItem><FormLabel>Preferred NOT to work areas</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <DialogFooter><Button type="submit" disabled={isTransportationSaving}>{isTransportationSaving && <Loader2 className="animate-spin mr-2" />}Save Transportation</Button></DialogFooter>
                </form>
            </Form>
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
      <RadioGroup onValueChange={setReason} value={reason} className="space-y-2">
          {rejectionReasons.map((r, i) => (<div key={i} className="flex items-center space-x-2"><RadioGroupItem value={r} id={`r-${i}`} /><Label htmlFor={`r-${i}`}>{r}</Label></div>))}
      </RadioGroup>
      <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Rejection notes..." />
      <DialogFooter><Button variant="destructive" disabled={isPending || !reason} onClick={() => onSubmit(reason, notes)}>{isPending && <Loader2 className="animate-spin mr-2" />}Confirm</Button></DialogFooter>
    </div>
  );
}
