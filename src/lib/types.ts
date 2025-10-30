

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
  candidateRating: z.number().min(0).max(5).optional(),
  phoneScreenPassed: z.enum(["Yes", "No", "N/A"]),
  aiGeneratedInsight: z.string().optional(),
  googleMeetLink: z.string().optional(),
  createdAt: z.date().optional(),
  finalInterviewStatus: z.enum(['Passed', 'Failed', 'Pending']).optional(),
  orientationScheduled: z.boolean().optional(),
  orientationDateTime: z.date().optional(),
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
  status: z.enum(["ACTIVE", "INACTIVE"]),
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
  status: z.enum(["ACTIVE", "INACTIVE"]),
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
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
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

export const clientSignupFormSchema = z.object({
  clientEmail: z.string().email({ message: "A valid client email is required to send the signature link." }),
  clientName: z.string().min(1, { message: "Client Name is required." }),
  clientAddress: z.string().min(1, { message: "Address is required." }),
  clientCity: z.string().min(1, { message: "City is required." }),
  clientState: z.string().min(1, { message: "State is required." }),
  clientPostalCode: z.string().min(1, { message: "Postal Code is required." }),
  clientPhone: z.string().min(1, { message: "Phone is required." }),
  clientSSN: z.string().optional(),
  clientDOB: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  emergencyContactHomePhone: z.string().optional(),
  emergencyContactWorkPhone: z.string().optional(),
  secondEmergencyContactName: z.string().optional(),
  secondEmergencyContactRelationship: z.string().optional(),
  secondEmergencyContactPhone: z.string().optional(),
});
export type ClientSignupFormData = z.infer<typeof clientSignupFormSchema>;


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
