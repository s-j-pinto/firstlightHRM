
"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { doc } from "firebase/firestore";

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Save, X, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useUser, useDoc, useMemoFirebase, firestore } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { lic508Schema, type Lic508FormData, type CaregiverProfile } from "@/lib/types";
import { saveLic508Data } from "@/lib/candidate-hiring-forms.actions";

const defaultFormValues: Lic508FormData = {
  convictedInCalifornia: undefined,
};

export default function LIC508Page() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const { toast } = useToast();
    const [isSaving, startSavingTransition] = useTransition();
    
    const caregiverProfileRef = useMemoFirebase(
      () => (user?.uid ? doc(firestore, 'caregiver_profiles', user.uid) : null),
      [user?.uid]
    );
    const { data: existingData, isLoading: isDataLoading } = useDoc<CaregiverProfile>(caregiverProfileRef);

    const form = useForm<Lic508FormData>({
      resolver: zodResolver(lic508Schema),
      defaultValues: defaultFormValues,
    });
    
    useEffect(() => {
        if (existingData) {
            form.reset({
                ...defaultFormValues,
                ...existingData
            });
        }
    }, [existingData, form]);

    const onSubmit = (data: Lic508FormData) => {
      if (!user?.uid) {
        toast({ title: 'Error', description: 'You must be logged in to save the form.', variant: 'destructive'});
        return;
      }
      startSavingTransition(async () => {
        const result = await saveLic508Data(user.uid, data);
        if (result.error) {
          toast({ title: "Save Failed", description: result.error, variant: 'destructive'});
        } else {
          toast({ title: "Success", description: "Your LIC 508 form has been saved."});
          router.push('/candidate-hiring-forms');
        }
      });
    }
    
    const isLoading = isUserLoading || isDataLoading;

    if(isLoading) {
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
        </div>
      )
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="text-sm text-muted-foreground">
                    State of California – Health and Human Services Agency
                    <br />
                    California Department of Social Services
                </div>
                <CardTitle className="text-center pt-4 tracking-wider">
                    CRIMINAL RECORD STATEMENT & OUT-OF-STATE DISCLOSURE
                </CardTitle>
            </CardHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="pt-6 space-y-6">
                <Separator />
                <p className="text-sm text-muted-foreground mt-6 text-center">
                    State law requires that persons associated with licensed care facilities, Home Care Aide Registry or TrustLine Registry applicants be fingerprinted and disclose any conviction. A conviction is any plea of guilty or nolo contendere (no contest) or a verdict of guilty. The fingerprints will be used to obtain a copy of any criminal history you may have.
                </p>

                <div className="border p-4 rounded-md">
                     <FormField
                        control={form.control}
                        name="convictedInCalifornia"
                        render={({ field }) => (
                           <FormItem className="space-y-2">
                               <FormLabel>Have you ever been convicted of a crime in California?</FormLabel>
                               <FormControl>
                                   <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                                       <FormItem className="flex items-center space-x-2">
                                           <RadioGroupItem value="yes" id="convicted-yes" />
                                           <FormLabel htmlFor="convicted-yes" className="font-normal">Yes</FormLabel>
                                       </FormItem>
                                       <FormItem className="flex items-center space-x-2">
                                           <RadioGroupItem value="no" id="convicted-no" />
                                           <FormLabel htmlFor="convicted-no" className="font-normal">No</FormLabel>
                                       </FormItem>
                                   </RadioGroup>
                               </FormControl>
                               <FormMessage />
                           </FormItem>
                        )}
                    />
                </div>

            </CardContent>
            <CardFooter className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => router.push('/candidate-hiring-forms')}>
                  <X className="mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                  Save Form
                </Button>
            </CardFooter>
            </form>
            </Form>
        </Card>
    );
}
