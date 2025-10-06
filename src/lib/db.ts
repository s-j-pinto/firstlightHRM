import type { CaregiverProfile, Appointment } from "./types";
import { addDays, set } from 'date-fns';

// In-memory store
let caregivers: CaregiverProfile[] = [];
let appointments: (Appointment & { caregiver?: CaregiverProfile })[] = [];
let caregiverIdCounter = 1;
let appointmentIdCounter = 1;

// Seed data
const seedCaregivers: Omit<CaregiverProfile, "id">[] = [
  {
    fullName: "Jane Doe",
    email: "jane.doe@example.com",
    phone: "123-456-7890",
    address: "123 Main St",
    city: "Anytown",
    state: "CA",
    zip: "12345",
    dateOfBirth: new Date("1990-05-15"),
    yearsExperience: 5,
    previousRoles: "Senior Care Assistant at Golden Years",
    summary: "Compassionate and experienced caregiver with a focus on dementia care.",
    cnaLicense: "CNA123456",
    availableDays: ["monday", "wednesday", "friday"],
    preferredShift: "mornings",
    hasCar: "yes",
    validLicense: "yes",
    canChangeBrief: true,
    canTransfer: true,
    canPrepareMeals: true,
    canDoBedBath: true,
    canUseHoyerLift: false,
    canUseGaitBelt: true,
    canUsePurwick: false,
    canEmptyCatheter: true,
    canEmptyColostomyBag: false,
    canGiveMedication: true,
    canTakeBloodPressure: true,
    hasDementiaExperience: true,
    hasHospiceExperience: false,
    hca: true,
    hha: false,
    cna: true,
    liveScan: true,
    negativeTbTest: true,
    cprFirstAid: true,
    canWorkWithCovid: true,
    covidVaccine: true,
    otherLanguages: "Spanish",
    otherCertifications: "Dementia Care Specialist",
  },
  {
    fullName: "John Smith",
    email: "john.smith@example.com",
    phone: "098-765-4321",
    address: "456 Oak Ave",
    city: "Someville",
    state: "CA",
    zip: "54321",
    dateOfBirth: new Date("1985-11-20"),
    yearsExperience: 8,
    previousRoles: "Live-in Caregiver, Pediatric Special Needs Aide",
    summary: "Dedicated caregiver with extensive experience in pediatric and special needs care.",
    cnaLicense: "",
    otherCertifications: "Certified Pediatric Nurse Assistant (CPNA)",
    availableDays: ["tuesday", "thursday", "saturday", "sunday"],
    preferredShift: "flexible",
    hasCar: "yes",
    validLicense: "yes",
    canChangeBrief: true,
    canTransfer: true,
    canPrepareMeals: true,
    canDoBedBath: true,
    canUseHoyerLift: true,
    canUseGaitBelt: true,
    canUsePurwick: true,
    canEmptyCatheter: true,
    canEmptyColostomyBag: true,
    canGiveMedication: true,
    canTakeBloodPressure: true,
    hasDementiaExperience: true,
    hasHospiceExperience: true,
    hca: true,
    hha: true,
    cna: false,
    liveScan: true,
    negativeTbTest: true,
    cprFirstAid: true,
    canWorkWithCovid: false,
    covidVaccine: true,
  }
];

const initializeDb = () => {
  if (caregivers.length === 0) {
    seedCaregivers.forEach(c => addCaregiver(c));

    const today = new Date();
    const firstAppointmentDate = set(addDays(today, 2), { hours: 9, minutes: 30, seconds: 0, milliseconds: 0 });
    const secondAppointmentDate = set(addDays(today, 4), { hours: 13, minutes: 30, seconds: 0, milliseconds: 0 });
    
    addAppointment({
      caregiverId: "1",
      caregiverName: "Jane Doe",
      caregiverEmail: "jane.doe@example.com",
      caregiverPhone: "123-456-7890",
      startTime: firstAppointmentDate,
      endTime: new Date(firstAppointmentDate.getTime() + 60 * 60 * 1000)
    });

    addAppointment({
        caregiverId: "2",
        caregiverName: "John Smith",
        caregiverEmail: "john.smith@example.com",
        caregiverPhone: "098-765-4321",
        startTime: secondAppointmentDate,
        endTime: new Date(secondAppointmentDate.getTime() + 60 * 60 * 1000)
    });
  }
};

export const addCaregiver = (profile: Omit<CaregiverProfile, "id">): CaregiverProfile => {
  const newCaregiver = { ...profile, id: String(caregiverIdCounter++) };
  caregivers.push(newCaregiver);
  console.log("Added new caregiver:", newCaregiver);
  return newCaregiver;
};

export const addAppointment = (appointment: Omit<Appointment, "id">): Appointment => {
  const newAppointment = { ...appointment, id: String(appointmentIdCounter++) };
  appointments.push(newAppointment);
  return newAppointment;
};

export const getCaregiverById = (id: string): CaregiverProfile | undefined => {
  return caregivers.find(c => c.id === id);
};

export const getAppointments = (): (Appointment & { caregiver?: CaregiverProfile })[] => {
  return appointments.map(apt => {
    const caregiver = getCaregiverById(apt.caregiverId);
    return { ...apt, caregiver };
  });
};

initializeDb();
