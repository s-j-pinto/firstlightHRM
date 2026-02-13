

"use client";

import { useState } from "react";
import { useForm, type FieldNames } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { useFirestore, useUser, errorEmitter, FirestorePermissionError } from "@/firebase";
import {
  Briefcase,
  Calendar,
  Car,
  CheckCircle,
  FileText,
  User,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { caregiverFormSchema,
  generalInfoSchema,
  experienceSchema,
  certificationsSchema,
  availabilitySchema,
  transportationSchema,
} from "@/lib/types";
import { submitCaregiverProfile } from "@/lib/actions";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

type CaregiverFormData = z.infer<typeof caregiverFormSchema>;

const steps = [
  { id: 1, title: "General", icon: <User className="h-5 w-5" />, fields: Object.keys(generalInfoSchema.shape) as FieldNames<CaregiverFormData>[] },
  { id: 2, title: "Experience", icon: <Briefcase className="h-5 w-5" />, fields: Object.keys(experienceSchema.shape) as FieldNames<CaregiverFormData>[] },
  { id: 3, title: "Certifications", icon: <FileText className="h-5 w-5" />, fields: Object.keys(certificationsSchema.shape) as FieldNames<CaregiverFormData>[] },
  { id: 4, title: "Availability", icon: <Calendar className="h-5 w-5" />, fields: ["availability"] as FieldNames<CaregiverFormData>[] },
  { id: 5, title: "Transportation", icon: <Car className="h-5 w-5" />, fields: Object.keys(transportationSchema.shape) as FieldNames<CaregiverFormData>[] },
];

const availabilityDays = [
  { id: "monday", label: "Monday" },
  { id: "tuesday", label: "Tuesday" },
  { id: "wednesday", label: "Wednesday" },
  { id: "thursday", label: "Thursday" },
  { id: "friday", label: "Friday" },
  { id: "saturday", label: "Saturday" },
  { id: "sunday", label: "Sunday" },
] as const;

const shifts = [
    { id: "morning", label: "Morning" },
    { id: "afternoon", label: "Afternoon" },
    { id: "evening", label: "Evening" },
    { id: "night", label: "Night" },
] as const;


const experienceCheckboxes = [
    { id: "canChangeBrief", label: "Able to change brief?" },
    { id: "canTransfer", label: "Able to Transfer?" },
    { id: "canPrepareMeals", label: "Able to prepare meals (COOK OR REHEAT)?" },
    { id: "canDoBedBath", label: "Able to bed bath or shower assistance?" },
    { id: "canUseHoyerLift", label: "Able to use Hoyer Lift?" },
    { id: "canUseGaitBelt", label: "Able to use Gait Belt?" },
    { id: "canUsePurwick", label: "Able to use a Purwick?" },
    { id: "canEmptyCatheter", label: "Able to empty catheter?" },
    { id: "canEmptyColostomyBag", label: "Able to empty colostomy bag?" },
    { id: "canGiveMedication", label: "Able to give medication?" },
    { id: "canTakeBloodPressure", label: "Able to take blood Pressure?" },
    { id: "hasDementiaExperience", label: "Experience with Dementia patients?" },
    { id: "hasHospiceExperience", label: "Experience with hospice patients?" },
] as const;

const certificationCheckboxes = [
    { id: "hca", label: "HCA(Home Care Aide)" },
    { id: "hha", label: "HHA" },
    { id: "liveScan", label: "Live Scan(fingerprint)" },
    { id: "negativeTbTest", label: "Negative TB-test" },
    { id: "cprFirstAid", label: "CPR/First Aid" },
] as const;


export function CaregiverForm({ onSuccess }: { onSuccess: (id: string, name: string) => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<CaregiverFormData>({
    resolver: zodResolver(caregiverFormSchema),
    defaultValues: {
      uid: user?.uid,
      fullName: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip: "",
      driversLicenseNumber: "",
      yearsExperience: 0,
      previousRoles: "",
      summary: "",
      cnaLicense: "",
      otherCertifications: "",
      availability: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
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
      hasDementiaExperience: false,
      hasHospiceExperience: false,
      hca: false,
      hha: false,
      liveScan: false,
      otherLanguages: "",
      negativeTbTest: false,
      cprFirstAid: false,
    },
  });

  const nextStep = async () => {
    const fields = steps[currentStep - 1].fields;
    const isValid = await form.trigger(fields, { shouldFocus: true });
    if (isValid) {
      setCurrentStep((prev) => (prev < steps.length ? prev + 1 : prev));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev));
  };

  const onSubmit = async (data: CaregiverFormData) => {
    setIsSubmitting(true);
    const db = firestore;
    if (!db) {
      throw new Error("Firestore is not initialized");
    }
    const colRef = collection(db, "caregiver_profiles");
    const docRef = await addDoc(colRef, { ...data, uid: user?.uid, createdAt: Timestamp.now() }).catch((serverError) => {
      const permissionError = new FirestorePermissionError({
        path: colRef.path,
        operation: "create",
        requestResourceData: data,
      });
      errorEmitter.emit("permission-error", permissionError);
      throw serverError; // Re-throw to be caught by outer catch
    });
    // This server action is now only for redirection
    await submitCaregiverProfile({
      caregiverId: docRef.id,
      caregiverName: data.fullName,
      caregiverEmail: data.email,
      caregiverPhone: data.phone,
    });
    setIsSubmitting(false);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto my-8 shadow-lg">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center font-headline">
          Join Our Team of Caregivers
        </CardTitle>
        <CardDescription className="text-center">
          Complete the following steps to create your profile.
        </CardDescription>
        <div className="pt-4">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2",
                      currentStep > step.id ? "bg-accent text-accent-foreground border-accent" : "",
                      currentStep === step.id ? "border-accent" : "border-border"
                    )}
                  >
                    {currentStep > step.id ? <CheckCircle className="h-5 w-5" /> : step.icon}
                  </div>
                  <p className={cn("mt-2 text-sm", currentStep === step.id ? "font-semibold text-accent" : "text-muted-foreground")}>{step.title}</p>
                </div>
                {index < steps.length - 1 && <div className="w-16 mx-2 h-0.5 bg-border" />}
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {currentStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="fullName" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input placeholder="(123) 456-7890" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input placeholder="123 Main St" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input placeholder="Anytown" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="state" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input placeholder="CA" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="driversLicenseNumber" render={({ field }) => ( <FormItem><FormLabel>Driver&apos;s License No.</FormLabel><FormControl><Input placeholder="Enter license number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="12345" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>
            )}
            {currentStep === 2 && (
              <div className="space-y-6">
                <FormField control={form.control} name="yearsExperience" render={({ field }) => ( <FormItem className="w-24"><FormLabel>Years of Experience</FormLabel><FormControl><Input type="number" min="0" placeholder="5" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="previousRoles" render={({ field }) => ( <FormItem><FormLabel>Previous Roles (optional)</FormLabel><FormControl><Textarea placeholder="e.g., Senior Care Assistant, Pediatric Aide" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="summary" render={({ field }) => ( <FormItem><FormLabel>Experience Summary</FormLabel><FormControl><Textarea placeholder="Describe your caregiving experience, skills, and passion." {...field} rows={5} /></FormControl><FormMessage /></FormItem> )} />
                 <div className="space-y-4">
                    <FormLabel>Skills & Experience</FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {experienceCheckboxes.map((item) => (
                            <FormField
                                key={item.id}
                                control={form.control}
                                name={item.id}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="font-normal">
                                                {item.label}
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        ))}
                    </div>
                </div>
              </div>
            )}
            {currentStep === 3 && (
                <div className="space-y-6">
                     <div className="space-y-4">
                        <FormLabel>Certifications (Please check all that apply)</FormLabel>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {certificationCheckboxes.map((item) => (
                                <FormField
                                    key={item.id}
                                    control={form.control}
                                    name={item.id}
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                            <FormControl>
                                                <Checkbox
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                                <FormLabel className="font-normal">
                                                    {item.label}
                                                </FormLabel>
                                            </div>
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                    <FormField control={form.control} name="otherLanguages" render={({ field }) => ( <FormItem><FormLabel>What languages other than English do you speak?</FormLabel><FormControl><Input placeholder="e.g., Spanish, Tagalog" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="otherCertifications" render={({ field }) => ( <FormItem><FormLabel>Other Certifications or Training (optional)</FormLabel><FormControl><Textarea placeholder="List any other relevant certifications not listed above" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
            )}
            {currentStep === 4 && (
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="availability"
                  render={() => (
                    <FormItem>
                      <div className="mb-4">
                        <FormLabel className="text-base">
                          Preferred Shifts
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">Select all the shifts you are available for each day.</p>
                      </div>
                      <div className="space-y-4">
                        {availabilityDays.map((day) => (
                          <div key={day.id} className="p-4 border rounded-lg">
                            <h4 className="font-semibold mb-2">{day.label}</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {shifts.map((shift) => (
                                <FormField
                                  key={shift.id}
                                  control={form.control}
                                  name={`availability.${day.id}`}
                                  render={({ field }) => (
                                    <FormItem
                                      key={shift.id}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(
                                            shift.id
                                          )}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([
                                                  ...(field.value || []),
                                                  shift.id,
                                                ])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) =>
                                                      value !== shift.id
                                                  )
                                                );
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal">
                                        {shift.label}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                       <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            {currentStep === 5 && (
                <div className="space-y-6">
                     <FormField control={form.control} name="hasCar" render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>Do you have a reliable vehicle?</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="no" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="validLicense" render={({ field }) => (
                        <FormItem className="space-y-3">
                            <FormLabel>Do you have a valid driver&apos;s license or valid California State ID ?</FormLabel>
                            <FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="yes" /></FormControl><FormLabel className="font-normal">Yes</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="no" /></FormControl><FormLabel className="font-normal">No</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
            )}

            <div className="flex justify-between pt-4">
              <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 1}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              {currentStep < steps.length ? (
                <Button type="button" onClick={nextStep} className="bg-accent hover:bg-accent/90">
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting} className="bg-accent hover:bg-accent/90">
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                  Submit Application
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
