
import type { CaregiverProfile, OnboardingSignatures } from './types';
import { 
    hcs501AdminSchema,
    drugAlcoholPolicyAdminSchema,
    employeeOrientationAgreementAdminSchema,
} from './types';
import { z } from 'zod';

export interface FormDefinition {
  name: string;
  href: string;
  completionKey: keyof CaregiverProfile | keyof OnboardingSignatures;
  pdfAction: string;
  adminSchema?: z.ZodObject<any, any, any> | z.ZodEffects<any,any,any>;
}

export const hiringForms: FormDefinition[] = [
  { name: "HCS 501 - Personnel Record 2019", href: "/candidate-hiring-forms/hcs501", completionKey: 'hcs501EmployeeSignature', pdfAction: 'hcs501', adminSchema: hcs501AdminSchema },
  { name: "Caregiver Emergency Contact Numbers", href: "/candidate-hiring-forms/emergency-contact", completionKey: 'emergencyContact1_name', pdfAction: 'emergencyContact' },
  { name: "Reference Verification 1", href: "/candidate-hiring-forms/reference-verification-1", completionKey: 'applicantSignature1', pdfAction: 'referenceVerification1' },
  { name: "Reference Verification 2", href: "/candidate-hiring-forms/reference-verification-2", completionKey: 'applicantSignature2', pdfAction: 'referenceVerification2' },
  { name: "LIC 508 - Criminal Record Statement", href: "/candidate-hiring-forms/lic508", completionKey: 'lic508Signature', pdfAction: 'lic508' },
  { name: "SOC 341A - Elder Abuse Reporting Form", href: "/candidate-hiring-forms/soc341a", completionKey: 'soc341aSignature', pdfAction: 'soc341a' },
];

export const onboardingForms: FormDefinition[] = [
  { name: "Mutual Arbitration Agreement", href: "/candidate-hiring-forms/arbitration-agreement", completionKey: 'arbitrationAgreementSignature', pdfAction: 'arbitrationAgreement' },
  { name: "Drug and/or Alcohol Testing Consent Form", href: "/candidate-hiring-forms/drug-alcohol-policy", completionKey: 'drugAlcoholPolicySignature', pdfAction: 'drugAlcoholPolicy', adminSchema: drugAlcoholPolicyAdminSchema },
  { name: "HCA job description-Rancho-Cucamonga", href: "/candidate-hiring-forms/hca-job-description", completionKey: 'jobDescriptionSignature', pdfAction: 'hcaJobDescription' },
  { name: "Client Abandonment", href: "/candidate-hiring-forms/client-abandonment", completionKey: 'clientAbandonmentSignature', pdfAction: 'clientAbandonment' },
  { name: "EMPLOYEE ORIENTATION AGREEMENT", href: "/candidate-hiring-forms/employee-orientation-agreement", completionKey: 'orientationAgreementSignature', pdfAction: 'employeeOrientationAgreement', adminSchema: employeeOrientationAgreementAdminSchema },
  { name: "FirstLightHomeCare_AcknowledgmentForm", href: "/candidate-hiring-forms/acknowledgment-form", completionKey: 'acknowledgmentSignature', pdfAction: 'acknowledgmentForm' },
  { 
    name: "FirstLightHomeCare_CONFIDENTIALITY_AGREEMENT", 
    href: "/candidate-hiring-forms/confidentiality-agreement", 
    completionKey: 'confidentialityAgreementEmployeeSignature', 
    pdfAction: 'confidentialityAgreement'
  },
  { name: "FirstLightHomeCareTrainingAcknowledgement", href: "/candidate-hiring-forms/training-acknowledgement", completionKey: 'trainingAcknowledgementSignature', pdfAction: 'trainingAcknowledgement' },
  { name: "MASTER-FLHC Offer Letter revised-2-16-26", href: "/candidate-hiring-forms/offer-letter", completionKey: 'offerLetterSignature', pdfAction: 'offerLetter' },
  { name: "Caregiver Responsibilities", href: "/candidate-hiring-forms/caregiver-responsibilities", completionKey: 'caregiverResponsibilitiesSignature', pdfAction: 'caregiverResponsibilities' },
  { name: "Light Housekeeping", href: "/candidate-hiring-forms/light-housekeeping", completionKey: 'lightHousekeepingAcknowledged', pdfAction: 'lightHousekeeping' },
  { name: "Caregiver Telephony Instructions", href: "/candidate-hiring-forms/caregiver-telephony-instructions", completionKey: 'telephonyInstructionsAcknowledged', pdfAction: 'caregiverTelephonyInstructions' },
  { name: "Caregiver Emergency Procedures", href: "/candidate-hiring-forms/emergency-procedure", completionKey: 'emergencyProcedureSignature', pdfAction: 'emergencyProcedure' },
];
