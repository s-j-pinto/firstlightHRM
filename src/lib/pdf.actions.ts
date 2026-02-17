

// This file now acts as a barrel, re-exporting the individual PDF generators.
// This keeps the import paths consistent for the rest of the application
// while allowing for easier maintenance of the PDF generation logic.

export { generateHcs501Pdf } from './pdf-generators/hcs501';
export { generateEmergencyContactPdf } from './pdf-generators/emergency-contact';
export { generateReferenceVerificationPdf } from './pdf-generators/reference-verification';
export { generateLic508Pdf } from './pdf-generators/lic508';
export { generateSoc341aPdf } from './pdf-generators/soc341a';
export { generateHcaJobDescriptionPdf } from './pdf-generators/hca-job-description';
export { generateDrugAlcoholPolicyPdf } from './pdf-generators/drug-alcohol-policy';
export { generateClientAbandonmentPdf } from './pdf-generators/client-abandonment';
export { generateArbitrationAgreementPdf } from './pdf-generators/arbitration-agreement';
export { generateEmployeeOrientationAgreementPdf } from './pdf-generators/employee-orientation-agreement';
export { generateAcknowledgmentFormPdf } from './pdf-generators/acknowledgment-form';
export { generateConfidentialityAgreementPdf } from './pdf-generators/confidentiality-agreement';
export { generateTrainingAcknowledgementPdf } from './pdf-generators/training-acknowledgement';
export { generateClientIntakePdf } from './pdf-generators/client-intake';
