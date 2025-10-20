
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
  zip: z.string().min(5, "Zip code is required."),
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
  interviewDateTime: z.date(),
  interviewType: z.enum(["Phone", "In-Person", "Google Meet"]),
  interviewNotes: z.string().optional(),
  candidateRating: z.number().min(0).max(5),
  phoneScreenPassed: z.enum(["Yes", "No", "N/A"]),
  aiGeneratedInsight: z.string().optional(),
  inPersonInterviewDate: z.date().optional(),
  googleMeetLink: z.string().optional(),
  createdAt: z.date().optional(),
});

export type Interview = z.infer<typeof interviewSchema> & { id: string };

export const caregiverEmployeeSchema = z.object({
  caregiverProfileId: z.string().min(1, 'Caregiver Profile ID is required.'),
  interviewId: z.string().min(1, 'Interview ID is required.'),
  inPersonInterviewDate: z.coerce.date().optional(),
  hireDate: z.coerce.date(),
  hiringComments: z.string().optional(),
  hiringManager: z.string(),
  startDate: z.coerce.date(),
  teletrackPin: z.string().min(1, 'TeleTrack PIN is required.'),
});

export type CaregiverEmployee = z.infer<typeof caregiverEmployeeSchema> & { id: string };

export const clientSchema = z.object({
  "Client Name": z.string(),
  "DOB": z.string().optional(),
  "Address": z.string(),
  "Apt/Unit": z.string().optional(),
  "City": z.string(),
  "Zip": z.string(),
  "Mobile": z.string(),
  "ContactName": z.string().optional(),
  "ContactMobile": z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  createdAt: z.any(),
  lastUpdatedAt: z.any(),
});

export type Client = z.infer<typeof clientSchema> & { id: string };
