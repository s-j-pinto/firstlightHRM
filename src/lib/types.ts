
import { z } from "zod";

export const generalInfoSchema = z.object({
  uid: z.string().optional(),
  createdAt: z.date().optional(),
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(10, "Phone number must be at least 10 digits."),
  address: z.string().min(5, "Address is required."),
  city: z.string().min(2, "City is required."),
  state: z.string().min(2, "State is required."),
  driversLicenseNumber: z.string().optional(),
  zip: z.string().min(5, "Zip code is required."),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
});

export const experienceSchema = z.object({
  yearsExperience: z.coerce.number().min(0, "Years of experience is required."),
  previousRoles: z.string().optional(),
  summary: z.string().optional(),
  canChangeBrief: z.boolean().optional().default(false),
  canTransfer: z.boolean().optional().default(false),
  canPrepareMeals: z.boolean().optional().default(false),
  canDoBedBath: z.boolean().optional().default(false),
  canUseHoyerLift: z.boolean().optional().default(false),
  canUseGaitBelt: z.boolean().optional().default(false),
  canUsePurwick: z.boolean().optional().default(false),
  canEmptyCatheter: z.boolean().optional().default(false),
  canEmptyColostomyBag: z.boolean().optional().default(false),
  canGiveMedication: z.boolean().optional().default(false),
  canTakeBloodPressure: z.boolean().optional().default(false),
  hasDementiaExperience: z.boolean().optional().default(false),
  hasHospiceExperience: z.boolean().optional().default(false),
});

export const certificationsSchema = z.object({
  hca: z.boolean().default(false),
  hha: z.boolean().default(false),
  cna: z.boolean().default(false),
  liveScan: z.boolean().default(false),
  otherLanguages: z.string().optional(),
  negativeTbTest: z.boolean().default(false),
  cprFirstAid: z.boolean().default(false),
  canWorkWithCovid: z.boolean().default(false),
  covidVaccine: z.boolean().default(false),
  cnaLicense: z.string().optional(),
  otherCertifications: z.string().optional(),
});

export const availabilitySchema = z.object({
  availability: z.object({
    monday: z.array(z.string()),
    tuesday: z.array(z.string()),
    wednesday: z.array(z.string()),
    thursday: z.array(z.string()),
    friday: z.array(z.string()),
    saturday: z.array(z.string()),
    sunday: z.array(z.string()),
  }).refine(val => Object.values(val).some(shifts => shifts.length > 0), {
    message: "Please select at least one shift.",
    path: ['sunday']
  }),
});

export const transportationSchema = z.object({
  hasCar: z.enum(["yes", "no"], { required_error: "Please select an option." }),
  validLicense: z.enum(["yes", "no"], { required_error: "Please select an option." }),
});

export const caregiverFormSchema = generalInfoSchema
  .merge(experienceSchema)
  .merge(certificationsSchema)
  .merge(availabilitySchema)
  .merge(transportationSchema);

export type CaregiverProfile = z.infer<typeof caregiverFormSchema> & { id: string };

export const appointmentSchema = z.object({
  caregiverId: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  preferredTimes: z.array(z.date()).optional(),
  inviteSent: z.boolean().optional(),
  appointmentStatus: z.string().optional(),
  cancelReason: z.string().optional(),
  cancelDateTime: z.date().optional(),
  createdAt: z.date().optional(),
});

export type Appointment = z.infer<typeof appointmentSchema> & { id: string };

export const interviewSchema = z.object({
  caregiverProfileId: z.string(),
  caregiverUid: z.string().optional(),
  interviewDateTime: z.date().optional(),
  interviewType: z.enum(["Phone", "In-Person", "Google Meet", "Orientation"]).optional(),
  interviewPathway: z.enum(["separate", "combined"]).optional(),
  interviewNotes: z.string().optional(),
  candidateRating: z.string().optional(),
  phoneScreenPassed: z.enum(["Yes", "No", "N/A"]),
  aiGeneratedInsight: z.string().optional(),
  googleMeetLink: z.string().optional(),
  googleEventId: z.string().optional(),
  createdAt: z.date().optional(),
  finalInterviewStatus: z.enum(['Passed', 'Failed', 'Pending', 'Rejected at Orientation', 'No Show']).optional(),
  finalInterviewNotes: z.string().optional(),
  orientationScheduled: z.boolean().optional(),
  orientationDateTime: z.date().optional(),
  rejectionReason: z.string().optional(),
  rejectionNotes: z.string().optional(),
  rejectionDate: z.date().optional(),
});

export type Interview = z.infer<typeof interviewSchema> & { id: string };

export const caregiverEmployeeSchema = z.object({
  caregiverProfileId: z.string().min(1, 'Caregiver Profile ID is required.'),
  interviewId: z.string().min(1, 'Interview ID is required.'),
  inPersonInterviewDate: z.coerce.date().optional(),
  hireDate: z.coerce.date(),
  hiringComments: z.string().optional(),
  hiringManager: z.string(),
  teletrackPin: z.string().min(1, 'TeleTrack PIN is required.'),
});

export type CaregiverEmployee = z.infer<typeof caregiverEmployeeSchema> & { id: string };

export const clientSchema = z.object({
  "Client Name": z.string(),
  "DOB": z.string().optional(),
  "Address": z.string(),
  "aptUnit": z.string().optional(),
  "City": z.string(),
  "Zip": z.string(),
  "Mobile": z.string(),
  "Email": z.string().optional(),
  "ContactName": z.string().optional(),
  "ContactMobile": z.string().optional(),
  status: z.enum(["Active", "Inactive"]),
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
});

export type Client = z.infer<typeof clientSchema> & { id: string };

export const activeCaregiverSchema = z.object({
  "Name": z.string(),
  "dob": z.string().optional(),
  "Address": z.string().optional(),
  "Apt": z.string().optional(),
  "City": z.string().optional(),
  "State": z.string().optional(),
  "Zip": z.string().optional(),
  "Mobile": z.string().optional(),
  "Hire Date": z.string().optional(),
  "Email": z.string().email(),
  "Drivers Lic": z.string().optional(),
  "Caregiver Lic": z.string().optional(),
  "TTiD-PIN": z.string().optional(),
  status: z.enum(["Active", "Inactive"]),
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
});

export type ActiveCaregiver = z.infer<typeof activeCaregiverSchema> & { id: string };

export const careLogTemplateSchema = z.object({
  name: z.string().min(3, "Template name must be at least 3 characters."),
  description: z.string().optional(),
  subsections: z.array(z.string()).min(1, "At least one subsection must be selected."),
});
export type CareLogTemplate = z.infer<typeof careLogTemplateSchema> & { id: string, createdAt: any, lastUpdatedAt: any };

export const careLogGroupSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  caregiverEmails: z.array(z.string().email()),
  careLogTemplateId: z.string().optional(),
  clientAccessEnabled: z.boolean().default(false),
  status: z.enum(["Active", "Inactive"]).optional(),
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
});

export type CareLogGroup = z.infer<typeof careLogGroupSchema> & { id: string };

export const careLogSchema = z.object({
  careLogGroupId: z.string(),
  caregiverId: z.string().email("Caregiver ID must be a valid email."),
  caregiverName: z.string(),
  shiftDateTime: z.any().optional(),
  shiftEndDateTime: z.any().optional(),
  logNotes: z.string().optional(),
  templateData: z.any().optional(),
  logImages: z.array(z.string()).optional(), // Array of data URIs
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
}).refine(data => data.logNotes || data.templateData, {
  message: "Either log notes or template data must be provided.",
  path: ["logNotes"],
});

export type CareLog = z.infer<typeof careLogSchema> & { id: string };

export const clientCareRequestSchema = z.object({
    clientId: z.string(),
    clientName: z.string(),
    clientEmail: z.string().email(),
    preferredDateTime: z.any(),
    duration: z.string(),
    reason: z.string(),
    preferredCaregiver: z.string().optional(),
    urgency: z.string(),
    status: z.enum(["pending", "reviewed", "scheduled", "denied"]),
    createdAt: z.any(),
    adminNotes: z.string().optional(),
});
export type ClientCareRequest = z.infer<typeof clientCareRequestSchema> & { id: string };

export const videoCheckinRequestSchema = z.object({
    clientId: z.string(),
    clientName: z.string(),
    clientEmail: z.string().email(),
    requestedBy: z.string(),
    notes: z.string().optional(),
    status: z.enum(['pending', 'scheduled', 'completed']),
    createdAt: z.any(),
    caregiverEmail: z.string().email().optional(),
    scheduledAt: z.any().optional(),
    googleMeetLink: z.string().url().optional(),
});
export type VideoCheckinRequest = z.infer<typeof videoCheckinRequestSchema> & { id: string };

const clientSignupDraftSchema = z.object({
  clientName: z.string().min(1, { message: "Client Name is required." }),
  clientCity: z.string().min(1, { message: "City is required." }),
  clientState: z.string().min(1, { message: "State is required." }),
  clientPhone: z.string().min(1, { message: "Phone is required." }),
  clientEmail: z.string().email({ message: "A valid client email is required to send the signature link." }),
});

export const clientSignupFormSchema = clientSignupDraftSchema.extend({
  // Office Use Only
  officeTodaysDate: z.date().optional(),
  officeReferralDate: z.date().optional(),
  officeInitialContactDate: z.date().optional(),

  // Client Information
  clientAddress: z.string().optional(),
  clientPostalCode: z.string().optional(),
  clientSSN: z.string().optional(),
  clientDOB: z.string().optional(),
  
  // Emergency Contact
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactHomePhone: z.string().optional(),
  emergencyContactWorkPhone: z.string().optional(),
  secondEmergencyContactName: z.string().optional(),
  secondEmergencyContactRelationship: z.string().optional(),
  secondEmergencyContactPhone: z.string().optional(),

  // Service and Schedule
  homemakerCompanion: z.boolean().optional(),
  personalCare: z.boolean().optional(),
  daysPerWeek: z.string().optional(),
  hoursPerDay: z.string().optional(),
  contractStartDate: z.date().optional(),

  // Payments
  hourlyRate: z.coerce.number().optional(),
  minimumHoursPerShift: z.coerce.number().optional(),
  rateCardDate: z.date().optional(),
  
  // Terms and Conditions
  policyNumber: z.string().optional(),
  policyPeriod: z.string().optional(),
  clientInitials: z.string().optional(),
  receivedPrivacyPractices: z.boolean().optional(),
  receivedClientRights: z.boolean().optional(),
  receivedTransportationWaiver: z.boolean().optional(),
  receivedPaymentAgreement: z.boolean().optional(),

  // Signatures
  clientSignature: z.string().optional(),
  clientPrintedName: z.string().optional(),
  clientSignatureDate: z.date().optional(),
  clientRepresentativeSignature: z.string().optional(),
  clientRepresentativePrintedName: z.string().optional(),
  clientRepresentativeSignatureDate: z.date().optional(),
  firstLightRepresentativeSignature: z.string().optional(),
  firstLightRepresentativeTitle: z.string().optional(),
  firstLightRepresentativeSignatureDate: z.date().optional(),

  // Home Care Service Plan
  companionCare_mealPreparation: z.boolean().optional(),
  companionCare_cleanKitchen: z.boolean().optional(),
  companionCare_assistWithLaundry: z.boolean().optional(),
  companionCare_dustFurniture: z.boolean().optional(),
  companionCare_assistWithEating: z.boolean().optional(),
  companionCare_provideAlzheimersRedirection: z.boolean().optional(),
  companionCare_assistWithHomeManagement: z.boolean().optional(),
  companionCare_preparationForBathing: z.boolean().optional(),
  companionCare_groceryShopping: z.boolean().optional(),
  companionCare_cleanBathrooms: z.boolean().optional(),
  companionCare_changeBedLinens: z.boolean().optional(),
  companionCare_runErrands: z.boolean().optional(),
  companionCare_escortAndTransportation: z.boolean().optional(),
  companionCare_provideRemindersAndAssistWithToileting: z.boolean().optional(),
  companionCare_provideRespiteCare: z.boolean().optional(),
  companionCare_stimulateMentalAwareness: z.boolean().optional(),
  companionCare_assistWithDressingAndGrooming: z.boolean().optional(),
  companionCare_assistWithShavingAndOralCare: z.boolean().optional(),
  companionCare_other: z.string().optional(),
  personalCare_provideAlzheimersCare: z.boolean().optional(),
  personalCare_provideMedicationReminders: z.boolean().optional(),
  personalCare_assistWithDressingGrooming: z.boolean().optional(),
  personalCare_assistWithBathingHairCare: z.boolean().optional(),
  personalCare_assistWithFeedingSpecialDiets: z.boolean().optional(),
  personalCare_assistWithMobilityAmbulationTransfer: z.boolean().optional(),
  personalCare_assistWithIncontinenceCare: z.boolean().optional(),
  personalCare_assistWithOther: z.string().optional(),
  servicePlanClientInitials: z.string().optional(),

  // Payment Agreement
  agreementClientName: z.string().optional(),
  agreementClientSignature: z.string().optional(),
  agreementSignatureDate: z.date().optional(),
  agreementRelationship: z.string().optional(),
  agreementRepSignature: z.string().optional(),
  agreementRepDate: z.date().optional(),

  // Transportation Waiver
  transportationWaiverClientSignature: z.string().optional(),
  transportationWaiverClientPrintedName: z.string().optional(),
  transportationWaiverWitnessSignature: z.string().optional(),
  transportationWaiverDate: z.date().optional(),
});
export type ClientSignupFormData = z.infer<typeof clientSignupFormSchema>;

// Stricter schema for finalization
export const finalizationSchema = clientSignupFormSchema.extend({
  hourlyRate: z.coerce.number().min(1, "Hourly rate is required."),
  minimumHoursPerShift: z.coerce.number().min(1, "Minimum hours per shift is required."),
  rateCardDate: z.date({ required_error: "Rate card date is required." }),
  clientInitials: z.string().min(1, "Client initials for the hiring clause are required."),

  receivedPrivacyPractices: z.literal(true, { errorMap: () => ({ message: "Must be acknowledged" }) }),
  receivedClientRights: z.literal(true, { errorMap: () => ({ message: "Must be acknowledged" }) }),
  receivedPaymentAgreement: z.literal(true, { errorMap: () => ({ message: "Must be acknowledged" }) }),

  firstLightRepresentativeSignature: z.string().min(1, "FirstLight representative signature is required."),
  firstLightRepresentativeTitle: z.string().min(1, "FirstLight representative title is required."),
  firstLightRepresentativeSignatureDate: z.date({ required_error: "Date is required." }),
  
  servicePlanClientInitials: z.string().min(1, "Client initials for the service plan are required."),
  
  agreementClientName: z.string().min(1, "Client name for payment agreement is required."),
  agreementRepSignature: z.string().min(1, "FirstLight representative signature for payment agreement is required."),
  agreementRepDate: z.date({ required_error: "Date for payment agreement is required." }),
}).superRefine((data, ctx) => {
    if (data.clientSignature?.trim() === '' && data.clientRepresentativeSignature?.trim() === '') {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either client or representative signature is required in the Acknowledgement section.",
            path: ["clientSignature"], 
        });
    }
    if (data.clientSignature && (!data.clientPrintedName || !data.clientSignatureDate)) {
        if (!data.clientPrintedName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Printed name is required.", path: ["clientPrintedName"] });
        if (!data.clientSignatureDate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date is required.", path: ["clientSignatureDate"] });
    }
    if (data.clientRepresentativeSignature && (!data.clientRepresentativePrintedName || !data.clientRepresentativeSignatureDate)) {
        if (!data.clientRepresentativePrintedName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Representative printed name is required.", path: ["clientRepresentativePrintedName"] });
        if (!data.clientRepresentativeSignatureDate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date is required.", path: ["clientRepresentativeSignatureDate"] });
    }
   if (!data.agreementClientSignature) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Client signature for payment agreement is required.", path: ["agreementClientSignature"] });
   }
   if (data.agreementClientSignature && !data.agreementSignatureDate) {
     ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date is required.", path: ["agreementSignatureDate"] });
   }
   if(data.receivedTransportationWaiver) {
    if (!data.transportationWaiverClientSignature) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Client signature is required for the waiver.", path: ["transportationWaiverClientSignature"] });
    if (!data.transportationWaiverClientPrintedName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Printed name is required for the waiver.", path: ["transportationWaiverClientPrintedName"] });
    if (!data.transportationWaiverWitnessSignature) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Witness signature is required for the waiver.", path: ["transportationWaiverWitnessSignature"] });
    if (!data.transportationWaiverDate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date is required for the waiver.", path: ["transportationWaiverDate"] });
   }
});


// Defines the schema for the data that will be passed into the AI prompt.
// It accepts either an image data URI or plain text content.
export const ExtractCareLogInputSchema = z.object({
  imageDataUri: z.string().describe(
    "A photo of a handwritten care log, as a data URI that must include a " +
    "MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ).optional(),
  textContent: z.string().describe(
    "The plain text content of a care log note."
  ).optional(),
}).refine(data => data.imageDataUri || data.textContent, {
  message: 'Either imageDataUri or textContent must be provided.',
});
export type ExtractCareLogInput = z.infer<typeof ExtractCareLogInputSchema>;

// Defines the schema for the expected output from the AI model.
export const ExtractCareLogOutputSchema = z.object({
  shiftDateTime: z.string().datetime().describe(
    "The exact start date and time of the shift, extracted from the notes. " +
    "This must be in a valid ISO 8601 format (e.g., '2024-07-29T14:30:00Z'). " +
    "If no date or time can be found, use the current date and time."
  ),
  extractedText: z.string().describe('The full, raw text extracted from the provided content.'),
});
export type ExtractCareLogOutput = z.infer<typeof ExtractCareLogOutputSchema>;

export interface GeneratedField {
  fieldName: string;
  label: string;
  fieldType: 'text' | 'email' | 'tel' | 'date' | 'number' | 'checkbox' | 'radio' | 'select' | 'textarea' | 'signature';
  required: boolean;
  options?: string[];
}

export interface FormBlock {
  type: 'heading' | 'paragraph' | 'html' | 'fields';
  content?: string;
  level?: number;
  rows?: {
    columns: {
      fields?: GeneratedField[];
    }[];
  }[];
}

export interface GeneratedForm {
  id?: string;
  formName: string;
  blocks: FormBlock[];
  formData: any;
}

export const initialContactSchema = z.object({
    clientName: z.string(),
    clientAddress: z.string(),
    source: z.string(),
    createdAt: z.any(),
    lastUpdatedAt: z.any(),
    followUpHistory: z.array(z.any()).optional(),
    inHomeVisitSet: z.enum(["Yes", "No"]).optional(),
    sendFollowUpCampaigns: z.boolean().optional(),
    status: z.string().optional(),
    clientDepositAmount: z.coerce.number().optional(),
});
export type InitialContact = z.infer<typeof initialContactSchema> & { id: string, smsFollowUpSent?: boolean, clientPhone?: string };

export const campaignTemplateSchema = z.object({
    name: z.string(),
    description: z.string().optional(),
    type: z.enum(['email', 'sms']),
    intervalDays: z.number().min(0),
    intervalHours: z.number().min(0).optional(),
    subject: z.string().optional(),
    body: z.string(),
    sendImmediatelyFor: z.array(z.string()).optional(),
    createdAt: z.any(),
    lastUpdatedAt: z.any(),
});
export type CampaignTemplate = z.infer<typeof campaignTemplateSchema> & { id: string };

export const referralSchema = z.object({
    referrerClientId: z.string(),
    referralCodeUsed: z.string(),
    newClientInitialContactId: z.string(),
    newClientName: z.string(),
    status: z.enum(['Pending', 'Converted', 'Rewarded']),
    rewardId: z.string().optional(),
    createdAt: z.any(),
});
export type Referral = z.infer<typeof referralSchema> & { id: string };

export const rewardSchema = z.object({
    clientId: z.string(),
    referralId: z.string(),
    rewardType: z.enum(['Discount', 'Free Hours']),
    amount: z.number(),
    description: z.string(),
    status: z.enum(['Available', 'Applied', 'Expired']),
    createdAt: z.any(),
    appliedAt: z.any().optional(),
});
export type Reward = z.infer<typeof rewardSchema> & { id: string };

export const referralProfileSchema = z.object({
    clientId: z.string(),
    referralCode: z.string(),
    createdAt: z.any(),
});
export type ReferralProfile = z.infer<typeof referralProfileSchema> & { id: string };


export const clientSignupStatusSchema = z.enum([
    "Initial Phone Contact Completed",
    "Incomplete",
    "Pending Client Signatures",
    "Client Signatures Completed",
    "Signed and Published",
    "Archived"
]);

export const levelOfCareSchema = z.object({
    level_0_independent_in_emergency: z.boolean().optional(),
    level_0_able_to_negotiate_stairs: z.boolean().optional(),
    level_0_able_to_bathe: z.boolean().optional(),
    level_0_able_to_dress: z.boolean().optional(),
    level_0_able_to_groom: z.boolean().optional(),
    level_0_able_to_transfer_and_ambulate: z.boolean().optional(),
    level_0_able_to_use_toilet: z.boolean().optional(),
    level_0_take_medications: z.boolean().optional(),
    level_0_able_to_prepare_and_eat_meals: z.boolean().optional(),
    level_0_light_housekeeping: z.boolean().optional(),
    level_0_able_to_plan_social_activities: z.boolean().optional(),
    level_0_little_to_no_family_concern: z.boolean().optional(),
    level_1_able_to_respond_in_emergency: z.boolean().optional(),
    level_1_ambulates_independently: z.boolean().optional(),
    level_1_infrequent_falls: z.boolean().optional(),
    level_1_independent_to_verbal_reminders: z.boolean().optional(),
    level_1_continent_bladder_bowel: z.boolean().optional(),
    level_1_independent_baths: z.boolean().optional(),
    level_1_meal_prep_assistance_helpful: z.boolean().optional(),
    level_1_housekeeping_assistance_helpful: z.boolean().optional(),
    level_1_some_encouragement_for_social_activities: z.boolean().optional(),
    level_1_oriented_to_self: z.boolean().optional(),
    level_1_little_memory_impairment: z.boolean().optional(),
    level_1_family_slightly_concerned: z.boolean().optional(),
    level_2_may_need_assistance_in_emergency: z.boolean().optional(),
    level_2_transfer_stand_by_assist: z.boolean().optional(),
    level_2_needs_reminders_for_adls: z.boolean().optional(),
    level_2_medication_management_helpful: z.boolean().optional(),
    level_2_some_incontinence_assistance: z.boolean().optional(),
    level_2_some_bathing_assistance: z.boolean().optional(),
    level_2_some_meal_prep_planning_assistance: z.boolean().optional(),
    level_2_some_housekeeping_assistance: z.boolean().optional(),
    level_2_reminders_encourage_participation: z.boolean().optional(),
    level_2_mild_memory_impairment: z.boolean().optional(),
    level_2_sometimes_disoriented: z.boolean().optional(),
    level_2_family_concerned: z.boolean().optional(),
    level_3_needs_assistance_in_emergency: z.boolean().optional(),
    level_3_transfer_one_person_assist: z.boolean().optional(),
    level_3_verbal_cues_to_hands_on_assist: z.boolean().optional(),
    level_3_medication_management: z.boolean().optional(),
    level_3_incontinence_management: z.boolean().optional(),
    level_3_needs_bathing_assistance: z.boolean().optional(),
    level_3_meal_prep_assistance_needed: z.boolean().optional(),
    level_3_housekeeping_assistance_needed: z.boolean().optional(),
    level_3_encouragement_escort_to_social_activities: z.boolean().optional(),
    level_3_impaired_memory: z.boolean().optional(),
    level_3_poor_orientation: z.boolean().optional(),
    level_3_mild_confusion: z.boolean().optional(),
    level_3_family_very_concerned: z.boolean().optional(),
    level_4_needs_supervision_in_emergency: z.boolean().optional(),
    level_4_transfer_two_person_or_mechanical_lift: z.boolean().optional(),
    level_4_hands_on_assistance_with_adls: z.boolean().optional(),
    level_4_medication_management: z.boolean().optional(),
    level_4_behavior_management: z.boolean().optional(),
    level_4_bathing_assistance: z.boolean().optional(),
    level_4_verbal_cues_hands_on_assistance_to_eat: z.boolean().optional(),
    level_4_needs_housekeeping: z.boolean().optional(),
    level_4_encouragement_escort_or_one_on_one: z.boolean().optional(),
    level_4_needs_24_hour_supervision: z.boolean().optional(),
    level_4_needs_skilled_services: z.boolean().optional(),
    level_4_severe_cognitive_and_memory_impairment: z.boolean().optional(),
  });
export type LevelOfCareFormData = z.infer<typeof levelOfCareSchema>;

export const smsMessageSchema = z.object({
    text: z.string(),
    direction: z.enum(['inbound', 'outbound']),
    timestamp: z.any(),
});
export type SmsMessage = z.infer<typeof smsMessageSchema> & { id: string };

