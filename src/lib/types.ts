
import { z } from "zod";

const isValidDate = (dateString: string): boolean => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    return false;
  }
  const [month, day, year] = dateString.split('/').map(Number);
  if (month < 1 || month > 12 || year < 1900 || year > 2100) {
    return false;
  }
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

export const dateString = z.string()
  .optional()
  .or(z.literal(''))
  .refine(val => !val || isValidDate(val), {
    message: "Invalid date. Please use MM/DD/YYYY format.",
  });

export const requiredDateString = z.string()
  .min(1, 'Date is required.')
  .refine(isValidDate, {
    message: "Invalid date. Please use MM/DD/YYYY format.",
  });
  
export const allstarVisitSchema = z.object({
  serviceDate: dateString,
  timeIn: z.string().optional(),
  timeOut: z.string().optional(),
  patientName: z.string().trim().optional(),
  patientSignature: z.string().optional(),
  typeOfVisit: z.enum(["Follow-up", "SOC", "ROC", "Recert", "Discharge"]).optional(),
});
export type AllstarVisit = z.infer<typeof allstarVisitSchema>;

export const allstarRouteSheetSchema = allstarVisitSchema.extend({
  employeeName: z.string().trim().optional(),
  title: z.enum(["Caregiver", "HCA"]).optional(),
  employeeSignature: z.string().optional(),
  dateSubmitted: dateString,
  checkedBy: z.string().trim().optional(),
  checkedDate: dateString,
  remarks: z.string().trim().optional(),
});
export type AllstarRouteSheetFormData = z.infer<typeof allstarRouteSheetSchema>;

export const careLogFormSchema = z.object({
    logNotes: z.string().optional(),
});

export const initialContactSchema = z.object({
  clientName: z.string().trim().min(1, "Client's Name is required."),
  source: z.string().trim().min(1, "Source is required."),
  clientAddress: z.string().trim().min(1, "Client's Address is required."),
  dateOfBirth: dateString,
  rateOffered: z.coerce.number().nonnegative("Rate cannot be negative").optional(),
  milageOffered: z.coerce.number().nonnegative("Mileage cannot be negative").optional(),
  clientDepositAmount: z.coerce.number().optional(),
  city: z.string().trim().min(1, "City is required."),
  zip: z.string().trim().min(1, "Zip code is required."),
  clientPhone: z.string().trim().min(1, "Client's Phone is required."),
  clientEmail: z.string().trim().toLowerCase().email("A valid email is required."),
  mainContact: z.string().trim().min(1, "Main Contact is required."),
  allergies: z.string().trim().optional(),
  pets: z.string().trim().optional(),
  dateOfHomeVisit: dateString,
  timeOfVisit: z.string().trim().optional(),
  referredBy: z.string().trim().optional(),
  referralCode: z.string().trim().optional(),
  promptedCall: z.string().trim().min(1, "This field is required."),
  estimatedHours: z.string().trim().optional(),
  estimatedStartDate: dateString,
  inHomeVisitSet: z.enum(["Yes", "No"]).optional(),
  inHomeVisitSetNoReason: z.string().trim().optional(),
  sendFollowUpCampaigns: z.boolean().optional(),
  medicalIns: z.string().trim().optional(),
  dnr: z.boolean().optional(),
  va: z.string().trim().optional(),
  hasPoa: z.enum(["Yes", "No"]).optional(),
  ltci: z.string().trim().optional(),
  contactPhone: z.string().trim().min(1, "Contact Phone is required."),
  languagePreference: z.string().trim().optional(),
  additionalEmail: z.string().trim().toLowerCase().email("Please enter a valid email.").optional().or(z.literal('')),
  createdAt: z.any().optional(),
  createdBy: z.string().trim().optional(),
  clientIsBedridden: z.enum(["Yes", "No"]).optional(),
  clientUsesHoyerLift: z.enum(["Yes", "No"]).optional(),
  smokingEnvironment: z.enum(["Yes", "No"]).optional(),
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
  companionCare_other: z.string().trim().optional(),
  personalCare_provideAlzheimersCare: z.boolean().optional(),
  personalCare_provideMedicationReminders: z.boolean().optional(),
  personalCare_assistWithDressingGrooming: z.boolean().optional(),
  personalCare_assistWithBathingHairCare: z.boolean().optional(),
  personalCare_assistWithFeedingSpecialDiets: z.boolean().optional(),
  personalCare_assistWithMobilityAmbulationTransfer: z.boolean().optional(),
  personalCare_assistWithIncontinenceCare: z.boolean().optional(),
  personalCare_assistWithOther: z.string().trim().optional(),
}).superRefine((data, ctx) => {
    if (data.inHomeVisitSet === "Yes") {
        if (!data.dateOfHomeVisit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Date of Home Visit is required when a visit is set.",
                path: ["dateOfHomeVisit"],
            });
        }
        if (!data.timeOfVisit) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Time of Visit is required when a visit is set.",
                path: ["timeOfVisit"],
            });
        }
    }
});

export const generalInfoSchema = z.object({
  uid: z.string().optional(),
  createdAt: z.any().optional(),
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters."),
  email: z.string().trim().toLowerCase().email("Invalid email address."),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits."),
  address: z.string().trim().min(5, "Address is required."),
  city: z.string().trim().min(2, "City is required."),
  state: z.string().trim().min(2, "State is required."),
  driversLicenseNumber: z.string().trim().optional(),
  zip: z.string().trim().min(5, "Zip code is required."),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
});

export const experienceSchema = z.object({
  yearsExperience: z.coerce.number().min(0, "Years of experience is required and cannot be negative."),
  previousRoles: z.string().trim().optional(),
  summary: z.string().trim().min(1, "Experience summary is required."),
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
  liveScan: z.boolean().default(false),
  otherLanguages: z.string().trim().optional(),
  negativeTbTest: z.boolean().default(false),
  cprFirstAid: z.boolean().default(false),
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

export const hcs501Object = z.object({
  perId: z.string().trim().optional(),
  hireDate: dateString,
  separationDate: dateString,
  fullName: z.string().trim().nonempty("Full name is required."),
  phone: z.string().trim().nonempty("Phone is required."),
  address: z.string().trim().nonempty("Address is required."),
  city: z.string().trim().nonempty("City is required."),
  state: z.string().trim().nonempty("State is required."),
  zip: z.string().trim().nonempty("Zip code is required."),
  dob: requiredDateString,
  ssn: z.string().trim().optional().refine((val) => {
    if (!val) return true; 
    return /^\d{3}-\d{2}-\d{4}$/.test(val);
  }, {
    message: "Invalid Social Security Number format. Expected XXX-XX-XXXX.",
  }),
  tbDate: dateString,
  tbResults: z.string().trim().optional(),
  additionalTbDates: z.string().trim().optional(),
  alternateNames: z.string().trim().optional(),
  validLicense: z.enum(["yes", "no"], { required_error: "This field is required." }),
  driversLicenseNumber: z.string().trim().optional(),
  titleOfPosition: z.string().trim().nonempty("Title of Position is required."),
  hcs501Notes: z.string().trim().optional(),
  hcs501EmployeeSignature: z.string().nonempty("Signature is required."),
  hcs501SignatureDate: requiredDateString,
});

const cdlRefinement = (data: { validLicense?: "yes" | "no"; driversLicenseNumber?: string; }) => {
    if (data.validLicense === 'yes') {
        return !!data.driversLicenseNumber && data.driversLicenseNumber.length > 0;
    }
    return true;
};
const cdlRefinementParams = {
    message: "Driver's license number is required if you have a valid license.",
    path: ['driversLicenseNumber'],
};

export const hcs501Schema = hcs501Object.refine(cdlRefinement, cdlRefinementParams);

export const hcs501AdminSchema = hcs501Object.extend({
    perId: z.string().trim().min(1, "Employee's PER ID is required."),
    hireDate: requiredDateString,
    tbDate: requiredDateString,
    tbResults: z.string().trim().nonempty("Results of last TB test are required."),
}).refine(cdlRefinement, cdlRefinementParams);

export type Hcs501FormData = z.infer<typeof hcs501AdminSchema>;

export const emergencyContactSchema = z.object({
  emergencyContact1_name: z.string().trim().min(1, "Name for first contact is required."),
  emergencyContact1_relation: z.string().trim().min(1, "Relation for first contact is required."),
  emergencyContact1_phone: z.string().trim().min(1, "Phone for first contact is required."),
  emergencyContact1_address: z.string().trim().min(1, "Address for first contact is required."),
  emergencyContact1_city: z.string().trim().min(1, "City for first contact is required."),
  emergencyContact1_state: z.string().trim().min(1, "State for first contact is required."),
  emergencyContact1_zip: z.string().trim().min(1, "Zip for first contact is required."),
  emergencyContact2_name: z.string().trim().optional(),
  emergencyContact2_relation: z.string().trim().optional(),
  emergencyContact2_phone: z.string().trim().optional(),
  emergencyContact2_address: z.string().trim().optional(),
  emergencyContact2_city: z.string().trim().optional(),
  emergencyContact2_state: z.string().trim().optional(),
  emergencyContact2_zip: z.string().trim().optional(),
});
export type EmergencyContactFormData = z.infer<typeof emergencyContactSchema>;

export const lic508Object = z.object({
  convictedInCalifornia: z.enum(["yes", "no"], { required_error: "This selection is required." }),
  convictedOutOfState: z.enum(["yes", "no"], { required_error: "This selection is required." }),
  livedOutOfStateLast5Years: z.enum(["yes", "no"], { required_error: "This selection is required." }),
  outOfStateHistory: z.string().trim().optional(),
  lic508Signature: z.string().min(1, "Signature is required."),
  lic508SignatureDate: dateString,
  ssn: z.string()
    .trim()
    .min(1, "Social Security Number is required.")
    .regex(/^\d{3}-\d{2}-\d{4}$/, "Invalid Social Security Number format. Expected XXX-XX-XXXX."),
  driversLicenseNumber: z.string().trim().min(1, "Driver's License is required."),
  dob: dateString,
});

export const lic508Schema = lic508Object.refine(data => {
    if (data.livedOutOfStateLast5Years === 'yes') {
        return !!data.outOfStateHistory && data.outOfStateHistory.length > 0;
    }
    return true;
}, {
    message: "Please list the states you have lived in.",
    path: ['outOfStateHistory'],
});

export type Lic508FormData = z.infer<typeof lic508Schema>;

export const soc341aSchema = z.object({
  soc341aSignature: z.string().min(1, "Signature is required."),
  soc341aSignatureDate: requiredDateString,
});
export type Soc341aFormData = z.infer<typeof soc341aSchema>;

export const referenceVerification1Object = z.object({
  applicantSignature1: z.string().min(1, "Signature is required."),
  applicantSignatureDate1: requiredDateString,
  company1: z.string().trim().min(1, "Company name is required."),
  supervisorName1: z.string().trim().min(1, "Supervisor's name is required."),
  emailOrFax1: z.string().trim().min(1, "Email or Fax is required."),
  phone1: z.string().trim().min(1, "Phone number is required."),
  employmentDates1: z.string().trim().min(1, "Dates of employment are required."),
  position1: z.string().trim().min(1, "Position is required."),
  startingSalary1: z.string().trim().min(1, "Starting salary is required."),
  endingSalary1: z.string().trim().min(1, "Ending salary is required."),
  teamworkRating1: z.string({ required_error: "Rating is required." }),
  dependabilityRating1: z.string({ required_error: "Rating is required." }),
  initiativeRating1: z.string({ required_error: "Rating is required." }),
  qualityRating1: z.string({ required_error: "Rating is required." }),
  customerServiceRating1: z.string({ required_error: "Rating is required." }),
  overallPerformanceRating1: z.string({ required_error: "Rating is required." }),
  resignationStatus1: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  dischargedStatus1: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  laidOffStatus1: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  eligibleForRehire1: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  wasDisciplined1: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  disciplineExplanation1: z.string().trim().optional(),
});

export const referenceVerification1Schema = referenceVerification1Object.refine(data => {
    if (data.wasDisciplined1 === 'Yes') {
        return !!data.disciplineExplanation1 && data.disciplineExplanation1.length > 0;
    }
    return true;
}, {
    message: "Explanation is required if you were disciplined.",
    path: ['disciplineExplanation1'],
});
export type ReferenceVerification1FormData = z.infer<typeof referenceVerification1Schema>;

export const referenceVerification2Object = z.object({
  applicantSignature2: z.string().min(1, "Signature is required."),
  applicantSignatureDate2: requiredDateString,
  company2: z.string().trim().min(1, "Company name is required."),
  supervisorName2: z.string().trim().min(1, "Supervisor's name is required."),
  emailOrFax2: z.string().trim().min(1, "Email or Fax is required."),
  phone2: z.string().trim().min(1, "Phone number is required."),
  employmentDates2: z.string().trim().min(1, "Dates of employment are required."),
  position2: z.string().trim().min(1, "Position is required."),
  startingSalary2: z.string().trim().min(1, "Starting salary is required."),
  endingSalary2: z.string().trim().min(1, "Ending salary is required."),
  teamworkRating2: z.string({ required_error: "Rating is required." }),
  dependabilityRating2: z.string({ required_error: "Rating is required." }),
  initiativeRating2: z.string({ required_error: "Rating is required." }),
  qualityRating2: z.string({ required_error: "Rating is required." }),
  customerServiceRating2: z.string({ required_error: "Rating is required." }),
  overallPerformanceRating2: z.string({ required_error: "Rating is required." }),
  resignationStatus2: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  dischargedStatus2: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  laidOffStatus2: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  eligibleForRehire2: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  wasDisciplined2: z.enum(["Yes", "No"], { required_error: "This selection is required." }),
  disciplineExplanation2: z.string().trim().optional(),
});

export const referenceVerification2Schema = referenceVerification2Object.refine(data => {
    if (data.wasDisciplined2 === 'Yes') {
        return !!data.disciplineExplanation2 && data.disciplineExplanation2.length > 0;
    }
    return true;
}, {
    message: "Explanation is required if you were disciplined.",
    path: ['disciplineExplanation2'],
});
export type ReferenceVerification2FormData = z.infer<typeof referenceVerification2Schema>;

export const arbitrationAgreementSchema = z.object({
  applicantPrintedName: z.string().trim().min(1, "Printed name is required."),
  arbitrationAgreementSignature: z.string().min(1, "Signature is required."),
  arbitrationAgreementSignatureDate: requiredDateString,
});
export type ArbitrationAgreementFormData = z.infer<typeof arbitrationAgreementSchema>;

export const drugAlcoholPolicySchema = z.object({
  drugAlcoholPolicySignature: z.string().min(1, "Signature is required."),
  drugAlcoholPolicySignatureDate: requiredDateString,
  drugAlcoholPolicyEmployeePrintedName: z.string().trim().min(1, "Printed name is required."),
  drugAlcoholPolicyRepSignature: z.string().optional(),
  drugAlcoholPolicyRepDate: dateString,
  oralSalivaTestResult: z.enum(['Negative', 'Positive']).optional(),
  oralSalivaPositiveDrug: z.string().trim().optional(),
  bloodTestResult: z.enum(['Negative', 'Positive']).optional(),
  bloodTestPositiveDrug: z.string().trim().optional(),
});
export type DrugAlcoholPolicyFormData = z.infer<typeof drugAlcoholPolicySchema>;

export const drugAlcoholPolicyAdminSchema = drugAlcoholPolicySchema;

export const hcaJobDescriptionSchema = z.object({
  jobDescriptionSignature: z.string().min(1, "Signature is required."),
  jobDescriptionSignatureDate: requiredDateString,
});
export type HcaJobDescriptionFormData = z.infer<typeof hcaJobDescriptionSchema>;

export const clientAbandonmentSchema = z.object({
    clientAbandonmentPrintedName: z.string().trim().min(1, "Printed name is required."),
    clientAbandonmentSignature: z.string().min(1, "Signature is required."),
    clientAbandonmentSignatureDate: requiredDateString,
    clientAbandonmentWitnessSignature: z.string().optional(),
});
export type ClientAbandonmentFormData = z.infer<typeof clientAbandonmentSchema>;

export const clientAbandonmentAdminSchema = clientAbandonmentSchema;

export const employeeOrientationAgreementSchema = z.object({
  orientationAgreementEmployeeName: z.string().trim().min(1, "Printed name is required."),
  orientationAgreementSignature: z.string().min(1, "Signature is required."),
  orientationAgreementSignatureDate: requiredDateString,
  orientationAgreementWitnessSignature: z.string().optional(),
  orientationAgreementWitnessDate: dateString,
});
export type EmployeeOrientationAgreementFormData = z.infer<typeof employeeOrientationAgreementSchema>;

export const employeeOrientationAgreementAdminSchema = employeeOrientationAgreementSchema;


export const acknowledgmentFormSchema = z.object({
  acknowledgmentEmployeeName: z.string().trim().min(1, "Printed name is required."),
  acknowledgmentSignature: z.string().min(1, "Signature is required."),
  acknowledgmentSignatureDate: requiredDateString,
});
export type AcknowledgmentFormData = z.infer<typeof acknowledgmentFormSchema>;

export const confidentialityAgreementSchema = z.object({
  confidentialityAgreementEmployeeSignature: z.string().min(1, "Signature is required."),
  confidentialityAgreementEmployeeSignatureDate: requiredDateString,
  confidentialityAgreementRepSignature: z.string().optional(),
  confidentialityAgreementRepDate: dateString,
});
export type ConfidentialityAgreementFormData = z.infer<typeof confidentialityAgreementSchema>;

export const confidentialityAgreementAdminSchema = confidentialityAgreementSchema;

export const trainingAcknowledgementSchema = z.object({
  trainingAcknowledgementEmployeeName: z.string().trim().min(1, "Printed name is required."),
  trainingAcknowledgementSignature: z.string().min(1, "Signature is required."),
  trainingAcknowledgementSignatureDate: requiredDateString,
});
export type TrainingAcknowledgementFormData = z.infer<typeof trainingAcknowledgementSchema>;

export const offerLetterSchema = z.object({
  offerLetterSignature: z.string().min(1, "Acceptance signature is required."),
  offerLetterSignatureDate: requiredDateString,
  hireDate: dateString,
  caregiver_rate_trng_orient: z.coerce.number().optional(),
  minimum_client_care_pay_rate: z.coerce.number().optional(),
});
export type OfferLetterFormData = z.infer<typeof offerLetterSchema>;

export const caregiverResponsibilitiesSchema = z.object({
    caregiverResponsibilitiesSignature: z.string().min(1, 'Signature is required.'),
    caregiverResponsibilitiesSignatureDate: requiredDateString,
});
export type CaregiverResponsibilitiesFormData = z.infer<typeof caregiverResponsibilitiesSchema>;

export const telephonyInstructionsSchema = z.object({
  telephonyInstructionsAcknowledged: z.boolean().optional(),
});
export type TelephonyInstructionsFormData = z.infer<typeof telephonyInstructionsSchema>;

export const emergencyProcedureSchema = z.object({
    emergencyProcedureSignature: z.string().min(1, 'Signature is required.'),
    emergencyProcedureSignatureDate: requiredDateString,
});
export type EmergencyProcedureFormData = z.infer<typeof emergencyProcedureSchema>;

export const onboardingSignaturesSchema = z.object({
    hcs501EmployeeSignature: z.string().optional(),
    applicantSignature1: z.string().optional(),
    applicantSignature2: z.string().optional(),
    lic508Signature: z.string().optional(),
    soc341aSignature: z.string().optional(),
    arbitrationAgreementSignature: z.string().optional(),
    drugAlcoholPolicySignature: z.string().optional(),
    drugAlcoholPolicyRepSignature: z.string().optional(),
    jobDescriptionSignature: z.string().optional(),
    clientAbandonmentSignature: z.string().optional(),
    clientAbandonmentWitnessSignature: z.string().optional(),
    orientationAgreementSignature: z.string().optional(),
    orientationAgreementWitnessSignature: z.string().optional(),
    acknowledgmentSignature: z.string().optional(),
    confidentialityAgreementEmployeeSignature: z.string().optional(),
    confidentialityAgreementRepSignature: z.string().optional(),
    trainingAcknowledgementSignature: z.string().optional(),
    offerLetterSignature: z.string().optional(),
    caregiverResponsibilitiesSignature: z.string().optional(),
    emergencyProcedureSignature: z.string().optional(),
    emergencyProcedureSignatureDate: dateString,
});
export type OnboardingSignatures = z.infer<typeof onboardingSignaturesSchema>;

export const interviewQuestionsSchema = z.object({
  q_decideBecomeCaregiver: z.string().optional(),
  q_rewardingChallenging: z.string().optional(),
  q_strengthsWeaknesses: z.string().optional(),
  q_specializedTraining: z.string().optional(),
  q_careerGoals: z.string().optional(),
  q_dementiaExperience: z.string().optional(),
  q_clientUpsetHome: z.string().optional(),
  q_clientTellingLeave: z.string().optional(),
  q_clientCombative: z.string().optional(),
  q_clientHittingScratching: z.string().optional(),
  q_deceasedSpouse: z.string().optional(),
  q_difficultSituation: z.string().optional(),
  q_clientRefusal: z.string().optional(),
  q_criticismFeedback: z.string().optional(),
  q_medicalEmergencyNoOffice: z.string().optional(),
  q_clientNotes: z.string().optional(),
});
export type InterviewQuestionsFormData = z.infer<typeof interviewQuestionsSchema>;

export const caregiverFormSchema = generalInfoSchema
  .merge(experienceSchema)
  .merge(certificationsSchema)
  .merge(availabilitySchema)
  .merge(transportationSchema)
  .merge(hcs501Object.partial())
  .merge(emergencyContactSchema.partial())
  .merge(lic508Object.partial())
  .merge(soc341aSchema.partial())
  .merge(referenceVerification1Object.partial())
  .merge(referenceVerification2Object.partial())
  .merge(arbitrationAgreementSchema.partial())
  .merge(drugAlcoholPolicySchema.partial())
  .merge(hcaJobDescriptionSchema.partial())
  .merge(clientAbandonmentSchema.partial())
  .merge(employeeOrientationAgreementSchema.partial())
  .merge(acknowledgmentFormSchema.partial())
  .merge(confidentialityAgreementSchema.partial())
  .merge(trainingAcknowledgementSchema.partial())
  .merge(offerLetterSchema.partial())
  .merge(caregiverResponsibilitiesSchema.partial())
  .merge(telephonyInstructionsSchema.partial())
  .merge(emergencyProcedureSchema.partial())
  .extend({ 
    lightHousekeepingAcknowledged: z.boolean().optional()
  });


export type CaregiverProfile = z.infer<typeof caregiverFormSchema> & { id: string, canWorkWithCovid?: boolean, cna?: boolean, covidVaccine?: boolean };

export const appointmentSchema = z.object({
  caregiverId: z.string(),
  startTime: z.date(),
  endTime: z.date(),
  preferredTimes: z.array(z.date()).optional(),
  inviteSent: z.boolean().optional(),
  appointmentStatus: z.string().optional(),
  cancelReason: z.string().trim().optional(),
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
  interviewNotes: z.string().trim().optional(),
  candidateRating: z.string().trim().optional(),
  phoneScreenPassed: z.enum(["Yes", "No", "N/A"]),
  aiGeneratedInsight: z.string().trim().optional(),
  googleMeetLink: z.string().trim().optional(),
  googleEventId: z.string().trim().optional(),
  createdAt: z.any().optional(),
  finalInterviewStatus: z.enum(['Passed', 'Failed', 'Pending', 'Pending reference checks', 'Rejected at Orientation', 'No Show', 'Process Terminated']).optional(),
  finalInterviewNotes: z.string().trim().optional(),
  orientationScheduled: z.boolean().optional(),
  orientationDateTime: z.date().optional(),
  rejectionReason: z.string().trim().optional(),
  rejectionNotes: z.string().trim().optional(),
  rejectionDate: z.date().optional(),
  hiringDocsNotificationSentAt: z.any().optional(),
  onboardingFormsInitiated: z.boolean().optional(),
}).merge(interviewQuestionsSchema.partial());

export type Interview = z.infer<typeof interviewSchema> & { id: string };

export const caregiverEmployeeSchema = z.object({
  caregiverProfileId: z.string().min(1, 'Caregiver Profile ID is required.'),
  interviewId: z.string().min(1, 'Interview ID is required.'),
  inPersonInterviewDate: dateString,
  hireDate: requiredDateString,
  hiringComments: z.string().trim().optional(),
  hiringManager: z.string().trim(),
  teletrackPin: z.string().trim().min(1, 'TeleTrack PIN is required.'),
});

export type CaregiverEmployee = z.infer<typeof caregiverEmployeeSchema> & { id: string };

export const careLogTemplateSchema = z.object({
  name: z.string().trim().min(3, "Template name must be at least 3 characters."),
  description: z.string().trim().optional(),
  subsections: z.array(z.string()).min(1, "At least one subsection must be selected."),
});
export type CareLogTemplate = z.infer<typeof careLogTemplateSchema> & { id: string, createdAt: any, lastUpdatedAt: any };

export const careLogGroupSchema = z.object({
  clientId: z.string(),
  clientName: z.string().trim(),
  caregiverEmails: z.array(z.string().trim().toLowerCase().email()),
  careLogTemplateId: z.string().optional(),
  clientAccessEnabled: z.boolean().default(false),
  status: z.enum(["Active", "Inactive"]).optional(),
  vaClientId: z.string().trim().optional(),
  vaLast4SSN: z.string().trim().optional(),
  vaReferralNumber: z.string().trim().optional(),
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
});

export type CareLogGroup = z.infer<typeof careLogGroupSchema> & { id: string };

const careLogBaseSchema = z.object({
  careLogGroupId: z.string(),
  caregiverId: z.string().trim().toLowerCase().email("Caregiver ID must be a valid email."),
  caregiverName: z.string().trim(),
  shiftDateTime: z.any().optional(),
  shiftEndDateTime: z.any().optional(),
  logNotes: z.string().trim().optional(),
  logImages: z.array(z.string()).optional(), 
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
});

export const careLogSchema = careLogBaseSchema.extend({
  templateData: z.any().optional(),
}).refine(data => data.logNotes || data.templateData, {
  message: "Either log notes or template data must be provided.",
  path: ["logNotes"],
});
export type CareLog = z.infer<typeof careLogSchema> & { id: string };


export const clientCareRequestSchema = z.object({
    clientId: z.string(),
    clientName: z.string().trim(),
    clientEmail: z.string().trim().toLowerCase().email(),
    preferredDateTime: z.any(),
    duration: z.string().trim(),
    reason: z.string().trim(),
    preferredCaregiver: z.string().trim().optional(),
    urgency: z.string().trim(),
    status: z.enum(["pending", "reviewed", "scheduled", "denied"]),
    createdAt: z.any(),
    adminNotes: z.string().trim().optional(),
});
export type ClientCareRequest = z.infer<typeof clientCareRequestSchema> & { id: string };

export const videoCheckinRequestSchema = z.object({
    clientId: z.string(),
    clientName: z.string().trim(),
    clientEmail: z.string().trim().toLowerCase().email(),
    requestedBy: z.string().trim(),
    notes: z.string().trim().optional(),
    status: z.enum(['pending', 'scheduled', 'completed']),
    createdAt: z.any(),
    caregiverEmail: z.string().trim().toLowerCase().email().optional(),
    scheduledAt: z.any().optional(),
    googleMeetLink: z.string().trim().url().optional(),
});
export type VideoCheckinRequest = z.infer<typeof videoCheckinRequestSchema> & { id: string };

const clientSignupDraftSchema = z.object({
  clientName: z.string().trim().min(1, { message: "Client Name is required." }),
  clientCity: z.string().trim().min(1, { message: "City is required." }),
  clientState: z.string().trim().min(1, { message: "State is required." }),
  clientPhone: z.string().trim().min(1, { message: "Phone is required." }),
  clientEmail: z.string().trim().toLowerCase().email({ message: "A valid client email is required to send the signature link." }),
});

export const clientSignupFormSchema = clientSignupDraftSchema.extend({
  payor: z.string().trim().optional(),
  officeTodaysDate: dateString,
  officeReferralDate: dateString,
  officeInitialContactDate: dateString,
  clientAddress: z.string().trim().optional(),
  clientPostalCode: z.string().trim().optional(),
  clientSSN: z.string().trim().optional(),
  clientDOB: dateString,
  emergencyContactName: z.string().trim().optional(),
  emergencyContactRelationship: z.string().trim().optional(),
  emergencyContactHomePhone: z.string().trim().optional(),
  emergencyContactWorkPhone: z.string().trim().optional(),
  secondEmergencyContactName: z.string().trim().optional(),
  secondEmergencyContactRelationship: z.string().trim().optional(),
  secondEmergencyContactPhone: z.string().trim().optional(),
  homemakerCompanion: z.boolean().optional(),
  personalCare: z.boolean().optional(),
  daysPerWeek: z.string().trim().optional(),
  hoursPerDay: z.string().trim().optional(),
  contractStartDate: dateString,
  hourlyRate: z.coerce.number().optional(),
  minimumHoursPerShift: z.coerce.number().optional(),
  rateCardDate: dateString,
  policyNumber: z.string().trim().optional(),
  policyPeriod: z.string().trim().optional(),
  clientInitials: z.string().trim().optional(),
  receivedPrivacyPractices: z.boolean().optional(),
  receivedClientRights: z.boolean().optional(),
  receivedTransportationWaiver: z.boolean().optional(),
  receivedPaymentAgreement: z.boolean().optional(),
  receivedAdditionalDisclosures: z.boolean().optional(),
  clientSignature: z.string().optional(),
  clientPrintedName: z.string().trim().optional(),
  clientSignatureDate: dateString,
  clientRepresentativeSignature: z.string().optional(),
  clientRepresentativePrintedName: z.string().trim().optional(),
  clientRepresentativeSignatureDate: dateString,
  firstLightRepresentativeSignature: z.string().optional(),
  firstLightRepresentativeTitle: z.string().trim().optional(),
  firstLightRepresentativeSignatureDate: dateString,
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
  companionCare_other: z.string().trim().optional(),
  personalCare_provideAlzheimersCare: z.boolean().optional(),
  personalCare_provideMedicationReminders: z.boolean().optional(),
  personalCare_assistWithDressingGrooming: z.boolean().optional(),
  personalCare_assistWithBathingHairCare: z.boolean().optional(),
  personalCare_assistWithFeedingSpecialDiets: z.boolean().optional(),
  personalCare_assistWithMobilityAmbulationTransfer: z.boolean().optional(),
  personalCare_assistWithIncontinenceCare: z.boolean().optional(),
  personalCare_assistWithOther: z.string().trim().optional(),
  servicePlanClientInitials: z.string().trim().optional(),
  agreementClientName: z.string().trim().optional(),
  agreementClientSignature: z.string().optional(),
  agreementSignatureDate: dateString,
  agreementRelationship: z.string().trim().optional(),
  agreementRepSignature: z.string().optional(),
  agreementRepDate: dateString,
  transportationWaiverClientSignature: z.string().optional(),
  transportationWaiverClientPrintedName: z.string().trim().optional(),
  transportationWaiverWitnessSignature: z.string().optional(),
  transportationWaiverDate: dateString,
});
export type ClientSignupFormData = z.infer<typeof clientSignupFormSchema>;

export const finalizationSchema = clientSignupFormSchema.extend({
  hourlyRate: z.coerce.number().min(1, "Hourly rate is required."),
  minimumHoursPerShift: z.coerce.number().min(1, "Minimum hours per shift is required."),
  rateCardDate: requiredDateString,
  clientInitials: z.string().trim().min(1, "Client initials for the hiring clause are required."),
  receivedPrivacyPractices: z.literal(true, { errorMap: () => ({ message: "Must be acknowledged" }) }),
  receivedClientRights: z.literal(true, { errorMap: () => ({ message: "Must be acknowledged" }) }),
  receivedPaymentAgreement: z.literal(true, { errorMap: () => ({ message: "Must be acknowledged" }) }),
  firstLightRepresentativeSignature: z.string().min(1, "FirstLight representative signature is required."),
  firstLightRepresentativeTitle: z.string().trim().min(1, "FirstLight representative title is required."),
  firstLightRepresentativeSignatureDate: requiredDateString,
  servicePlanClientInitials: z.string().trim().min(1, "Client initials for the service plan are required."),
  agreementClientName: z.string().trim().min(1, "Client name for payment agreement is required."),
  agreementRepSignature: z.string().min(1, "FirstLight representative signature for payment agreement is required."),
  agreementRepDate: requiredDateString,
}).superRefine((data, ctx) => {
    if (data.clientSignature?.trim() === '' && data.clientRepresentativeSignature?.trim() === '') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Either client or representative signature is required in the Acknowledgement section.", path: ["clientSignature"] });
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

const tppBaseFinalizationSchema = z.object({
  clientName: z.string().trim().min(1, { message: "Client Name is required." }),
  clientEmail: z.string().trim().toLowerCase().email(),
  clientAddress: z.string().trim().min(1),
  clientCity: z.string().trim().min(1),
  clientState: z.string().trim().min(1),
  clientPostalCode: z.string().trim().min(1),
  clientPhone: z.string().trim().min(1),
  clientDOB: dateString,
  payor: z.string().trim().min(1, "Payor name is required."),
  clientInitials: z.string().trim().min(1, "Client initials for the hiring clause are required."),
  receivedPrivacyPractices: z.literal(true, { errorMap: () => ({ message: "Must acknowledge receipt of Privacy Practices." }) }),
  firstLightRepresentativeSignature: z.string().min(1, "FirstLight representative signature is required."),
  firstLightRepresentativeTitle: z.string().trim().min(1, "FirstLight representative title is required."),
  firstLightRepresentativeSignatureDate: requiredDateString,
  receivedTransportationWaiver: z.boolean().optional(),
  transportationWaiverClientSignature: z.string().optional(),
  transportationWaiverClientPrintedName: z.string().trim().optional(),
  transportationWaiverWitnessSignature: z.string().optional(),
  transportationWaiverDate: dateString,
  clientSignature: z.string().optional(),
  clientRepresentativeSignature: z.string().optional(),
  clientPrintedName: z.string().trim().optional(),
  clientSignatureDate: dateString,
  clientRepresentativePrintedName: z.string().trim().optional(),
  clientRepresentativeSignatureDate: dateString,
  receivedAdditionalDisclosures: z.boolean().optional(),
  agreementClientSignature: z.string().optional(),
  agreementSignatureDate: dateString,
  agreementRelationship: z.string().trim().optional(),
  agreementRepSignature: z.string().optional(),
  agreementRepDate: dateString,
});

export const tppFinalizationSchema = tppBaseFinalizationSchema.superRefine((data, ctx) => {
    if (!data.clientSignature && !data.clientRepresentativeSignature) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Either the client's or the representative's signature is required in the Acknowledgement section.",
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

   if(data.receivedTransportationWaiver) {
    if (!data.transportationWaiverClientSignature) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Client signature is required for the waiver.", path: ["transportationWaiverClientSignature"] });
    if (!data.transportationWaiverClientPrintedName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Printed name is required for the waiver.", path: ["transportationWaiverClientPrintedName"] });
    if (!data.transportationWaiverWitnessSignature) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Witness signature is required for the waiver.", path: ["transportationWaiverWitnessSignature"] });
    if (!data.transportationWaiverDate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date is required for the waiver.", path: ["transportationWaiverDate"] });
   }
});

export const clientSignaturePayloadSchema = z.object({
  signupId: z.string(),
  clientSignature: z.string().optional(),
  clientRepresentativeSignature: z.string().optional(),
  agreementClientSignature: z.string().min(1, "Agreement Signature is required."),
  clientPrintedName: z.string().trim().optional(),
  clientSignatureDate: dateString,
  clientRepresentativePrintedName: z.string().trim().optional(),
  clientRepresentativeSignatureDate: dateString,
  initials: z.string().trim().min(1, { message: "Initials are required for the hiring clause." }),
  servicePlanClientInitials: z.string().trim().min(1, { message: "Initials are required for the service plan section."}),
  agreementRelationship: z.string().trim().optional(),
  agreementSignatureDate: dateString,
  transportationWaiverClientSignature: z.string().optional(),
  transportationWaiverClientPrintedName: z.string().trim().optional(),
  transportationWaiverWitnessSignature: z.string().optional(),
  transportationWaiverDate: dateString,
}).superRefine((data, ctx) => {
    if (!data.clientSignature && !data.clientRepresentativeSignature) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Either client or representative signature is required.", path: ["clientSignature"] });
    }
});

export const tppClientSignaturePayloadSchema = z.object({
  signupId: z.string(),
  clientSignature: z.string().optional(),
  clientRepresentativeSignature: z.string().optional(),
  clientPrintedName: z.string().trim().optional(),
  clientSignatureDate: dateString,
  clientRepresentativePrintedName: z.string().trim().optional(),
  clientRepresentativeSignatureDate: dateString,
  initials: z.string().trim().min(1, { message: "Initials are required for the hiring clause." }),
  transportationWaiverClientSignature: z.string().optional(),
  transportationWaiverClientPrintedName: z.string().trim().optional(),
  transportationWaiverWitnessSignature: z.string().optional(),
  transportationWaiverDate: dateString,
  agreementClientSignature: z.string().optional(),
  agreementSignatureDate: dateString,
}).superRefine((data, ctx) => {
    if (!data.clientSignature && !data.clientRepresentativeSignature) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A client or representative signature is required.", path: ["clientSignature"] });
    }
});

export const ExtractCareLogInputSchema = z.object({
  imageDataUri: z.string().describe(
    "A photo of a handwritten care log, as a data URI that must include a " +
    "MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ).optional(),
  textContent: z.string().trim().describe(
    "The plain text content of a care log note."
  ).optional(),
}).refine(data => data.imageDataUri || data.textContent, {
  message: 'Either imageDataUri or textContent must be provided.',
});
export type ExtractCareLogInput = z.infer<typeof ExtractCareLogInputSchema>;

export const ExtractCareLogOutputSchema = z.object({
  shiftDateTime: z.string().datetime().describe(
    "The exact start date and time of the shift, extracted from the notes. " +
    "This must be in a valid ISO 8601 format (e.g., '2024-07-29T14:30:00Z'). " +
    "If no date or time can be found, use the current date and time."
  ),
  extractedText: z.string().trim().describe('The full, raw text extracted from the provided content.'),
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

export type InitialContact = z.infer<typeof initialContactSchema> & { id: string, smsFollowUpSent?: boolean, clientPhone?: string, pets?: string };

export const campaignTemplateSchema = z.object({
    name: z.string().trim(),
    description: z.string().trim().optional(),
    type: z.enum(['email', 'sms']),
    intervalDays: z.number().min(0),
    intervalHours: z.number().min(0).optional(),
    subject: z.string().trim().optional(),
    body: z.string().trim(),
    sendImmediatelyFor: z.array(z.string()),
    createdAt: z.any(),
    lastUpdatedAt: z.any(),
});
export type CampaignTemplate = z.infer<typeof campaignTemplateSchema> & { id: string };

export const referralSchema = z.object({
    referrerClientId: z.string(),
    referralCodeUsed: z.string().trim(),
    newClientInitialContactId: z.string(),
    newClientName: z.string().trim(),
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
    description: z.string().trim(),
    status: z.enum(['Available', 'Applied', 'Expired']),
    createdAt: z.any(),
    appliedAt: z.any().optional(),
});
export type Reward = z.infer<typeof rewardSchema> & { id: string };

export const referralProfileSchema = z.object({
    clientId: z.string(),
    referralCode: z.string().trim(),
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
    text: z.string().trim(),
    direction: z.enum(['inbound', 'outbound']),
    timestamp: z.any(),
});
export type SmsMessage = z.infer<typeof smsMessageSchema> & { id: string };

export const ClientCareNeedsSchema = z.object({
    clientAddress: z.string().trim().optional(),
    clientCity: z.string().trim().optional(),
    pets: z.string().trim().optional(),
    estimatedHours: z.string().trim().optional(),
    promptedCall: z.string().trim().optional(),
    companionCare_mealPreparation: z.boolean().optional(),
    companionCare_cleanKitchen: z.boolean().optional(),
    companionCare_assistWithLaundry: z.boolean().optional(),
    companionCare_dustFurniture: z.boolean().optional(),
    companionCare_assistWithEating: z.boolean().optional(),
    companionCare_provideAlzheimersRedirection: z.boolean().optional(),
    companionCare_escortAndTransportation: z.boolean().optional(),
    personalCare_provideAlzheimersCare: z.boolean().optional(),
    level_1_independent_to_verbal_reminders: z.boolean().optional(),
    level_2_transfer_stand_by_assist: z.boolean().optional(),
    level_2_mild_memory_impairment: z.boolean().optional(),
    level_3_transfer_one_person_assist: z.boolean().optional(),
    level_3_impaired_memory: z.boolean().optional(),
    level_4_transfer_two_person_or_mechanical_lift: z.boolean().optional(),
    level_4_severe_cognitive_and_memory_impairment: z.boolean().optional(),
});
export type ClientCareNeeds = z.infer<typeof ClientCareNeedsSchema>;

export const CaregiverForRecommendationSchema = z.object({
    id: z.string(),
    name: z.string().trim(),
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    supportedLevelOfCare: z.number(),
    dementiaExperience: z.boolean(),
    worksWithPets: z.boolean(),
    hasDriversLicense: z.boolean(),
    availability: z.any(),
});
export type CaregiverForRecommendation = z.infer<typeof CaregiverForRecommendationSchema>;

export const teleTrackWeeklyShiftsInventorySchema = z.object({
    weekStart: z.string().trim(),
    weekEnd: z.string().trim(),
    shifts: z.array(z.object({
        scheduleId: z.string().trim(),
        date: z.string().trim(),
        caregiver: z.object({ name: z.string().trim() }),
        client: z.object({ clientId: z.string().trim(), name: z.string().trim() }),
        arrivalTime: z.string().trim(),
        departureTime: z.string().trim(),
        hours: z.number(),
    })),
    syncedAt: z.any(),
});
export type TeleTrackWeeklyShiftsInventory = z.infer<typeof teleTrackWeeklyShiftsInventorySchema> & { id: string };

export const teleTrackCalloffWeeklyCaregiversListSchema = z.object({
    clients: z.array(z.object({
        clientName: z.string().trim(),
        caregivers: z.array(z.object({ caregiverName: z.string().trim() }))
    })),
    totalClients: z.number(),
    extractedAt: z.string().trim(),
    syncedAt: z.any(),
});
export type TeleTrackCalloffWeeklyCaregiversList = z.infer<typeof teleTrackCalloffWeeklyCaregiversListSchema> & { id: string };

export const replacementRecommendationSchema = z.object({
    caregiverId: z.string(),
    caregiverName: z.string().trim(),
    score: z.number(),
    reasons: z.array(z.string().trim()),
    isPriorCaregiver: z.boolean(),
    overtimeHoursAvailable: z.number(),
    dailyAvailability: z.string().trim(),
});
export type ReplacementRecommendation = z.infer<typeof replacementRecommendationSchema>;

export const vaTaskTemplateSchema = z.object({
  name: z.string().trim().min(3),
  description: z.string().trim().optional(),
  tasks: z.array(z.string()).min(1),
});
export type VATaskTemplate = z.infer<typeof vaTaskTemplateSchema> & { id: string, createdAt: any, lastUpdatedAt: any };

export const vaMedicalRecordSchema = z.object({
    clientId: z.string(),
    clientName: z.string().trim(),
    caregiverId: z.string().trim().optional().nullable(),
    date: z.any(),
    day: z.string().trim(),
    caregiverName: z.string().trim(),
    ratePlan: z.string().trim().optional().nullable(),
    arrivalTime: z.string().trim(),
    departureTime: z.string().trim(),
    createdAt: z.any(),
    tasks: z.record(z.boolean().nullable().optional()).optional(),
    providerSignature: z.string().trim().optional().nullable(),
});
export type VAMedicalRecord = z.infer<typeof vaMedicalRecordSchema> & { id: string };

export const RecommendationPayloadSchema = z.object({
    clientCareNeeds: ClientCareNeedsSchema,
    availableCaregivers: z.array(CaregiverForRecommendationSchema),
});
export type RecommendationPayload = z.infer<typeof RecommendationPayloadSchema>;

export const clientSchema = z.object({
  "Client Name": z.string().trim(),
  "DOB": z.string().trim().optional(),
  "Address": z.string().trim(),
  "aptUnit": z.string().trim().optional(),
  "City": z.string().trim(),
  "Zip": z.string().trim(),
  "Mobile": z.string().trim(),
  "Email": z.string().trim().toLowerCase().optional(),
  "ContactName": z.string().trim().optional(),
  "ContactMobile": z.string().trim().optional(),
  status: z.enum(["Active", "Inactive"]),
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
});

export type Client = z.infer<typeof clientSchema> & { id: string };

export const activeCaregiverSchema = z.object({
  "Name": z.string().trim(),
  "dob": z.string().trim().optional(),
  "Address": z.string().trim().optional(),
  "Apt": z.string().trim().optional(),
  "City": z.string().trim().optional(),
  "State": z.string().trim().optional(),
  "Zip": z.string().trim().optional(),
  "Mobile": z.string().trim().optional(),
  "Hire Date": z.string().trim().optional(),
  "Email": z.string().trim().toLowerCase().email(),
  "Drivers Lic": z.string().trim().optional(),
  "Caregiver Lic": z.string().trim().optional(),
  "TTiD-PIN": z.string().trim().optional(),
  status: z.enum(["Active", "Inactive"]),
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
});

export type ActiveCaregiver = z.infer<typeof activeCaregiverSchema> & { id: string };
