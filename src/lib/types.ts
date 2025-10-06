import { z } from "zod";

export const generalInfoSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  phone: z.string().min(10, "Phone number must be at least 10 digits."),
  address: z.string().min(5, "Address is required."),
  city: z.string().min(2, "City is required."),
  state: z.string().min(2, "State is required."),
  zip: z.string().min(5, "Zip code is required."),
  dateOfBirth: z.date({ required_error: "Date of birth is required." }),
});

export const experienceSchema = z.object({
  yearsExperience: z.coerce.number().min(0, "Years of experience is required."),
  previousRoles: z.string().optional(),
  specializations: z.array(z.string()).optional(),
  summary: z.string().min(20, "Please provide a brief summary of your experience (min 20 characters)."),
  canChangeBrief: z.boolean().optional(),
  canTransfer: z.boolean().optional(),
  canPrepareMeals: z.boolean().optional(),
  canDoBedBath: z.boolean().optional(),
  canUseHoyerLift: z.boolean().optional(),
  canUseGaitBelt: z.boolean().optional(),
  canUsePurwick: z.boolean().optional(),
  canEmptyCatheter: z.boolean().optional(),
  canEmptyColostomyBag: z.boolean().optional(),
  canGiveMedication: z.boolean().optional(),
  canTakeBloodPressure: z.boolean().optional(),
  hasDementiaExperience: z.boolean().optional(),
  hasHospiceExperience: z.boolean().optional(),
});

export const certificationsSchema = z.object({
  cprCertified: z.boolean().default(false),
  cnaLicense: z.string().optional(),
  otherCertifications: z.string().optional(),
});

export const availabilitySchema = z.object({
  availableDays: z.array(z.string()).min(1, "Please select at least one available day."),
  preferredShift: z.enum(["mornings", "afternoons", "evenings", "nights", "flexible"]),
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
  caregiverName: z.string(),
  caregiverEmail: z.string(),
  caregiverPhone: z.string(),
  startTime: z.date(),
  endTime: z.date(),
});

export type Appointment = z.infer<typeof appointmentSchema> & { id: string };
