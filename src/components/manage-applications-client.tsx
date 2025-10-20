
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { collection, doc } from "firebase/firestore";
import { firestore, useCollection, useMemoFirebase } from "@/firebase";
import type { CaregiverProfile } from "@/lib/types";
import { generalInfoSchema } from "@/lib/types";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { format } from "date-fns";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

type GeneralInfoFormData = z.infer<typeof generalInfoSchema>;

export default function ManageApplicationsClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<CaregiverProfile[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] =
    useState<CaregiverProfile | null>(null);

  const [isSearching, startSearchTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();

  const { toast } = useToast();
  const db = firestore;

  const caregiverProfilesRef = useMemoFirebase(
    () => (db ? collection(db, "caregiver_profiles") : null),
    [db]
  );
  const { data: allCaregivers, isLoading: caregiversLoading } =
    useCollection<CaregiverProfile>(caregiverProfilesRef);

  const form = useForm<GeneralInfoFormData>({
    resolver: zodResolver(generalInfoSchema),
  });

  const handleSearch = () => {
    if (!searchTerm.trim() || !allCaregivers) return;
    startSearchTransition(() => {
      const lowercasedTerm = searchTerm.toLowerCase();
      const results = allCaregivers.filter(
        (caregiver) =>
          caregiver.fullName.toLowerCase().includes(lowercasedTerm) ||
          (caregiver.phone && caregiver.phone.includes(searchTerm))
      );
      setSearchResults(results);
    });
  };

  const handleSelectCaregiver = (caregiver: CaregiverProfile) => {
    setSelectedCaregiver(caregiver);
    setSearchResults([]);
    setSearchTerm("");
    form.reset({
      fullName: caregiver.fullName,
      email: caregiver.email,
      phone: caregiver.phone,
      address: caregiver.address,
      city: caregiver.city,
      state: caregiver.state,
      zip: caregiver.zip,
    });
  };

  const onSubmit = (data: GeneralInfoFormData) => {
    if (!selectedCaregiver || !db) return;
    
    startSubmitTransition(() => {
      try {
        const profileRef = doc(db, "caregiver_profiles", selectedCaregiver.id);
        updateDocumentNonBlocking(profileRef, data);
        
        toast({
          title: "Success",
          description: "Caregiver profile update initiated.",
        });
        
        // The UI will update via real-time listener.
        // We'll clear the selection to allow a new search.
        setSelectedCaregiver(null);

      } catch (error) {
        // The non-blocking update function will emit a global error, which is caught by FirebaseErrorListener.
        // We can also show a local toast here.
        toast({
            title: "Error",
            description: "Failed to update profile. Check console for details.",
            variant: "destructive",
        });
      }
    });
  };

  const handleCancel = () => {
    setSelectedCaregiver(null);
    form.reset();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Search for a Caregiver</CardTitle>
          <CardDescription>
            Search by full name or phone number to edit their application information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter name or phone number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={!!selectedCaregiver}
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching || !searchTerm.trim() || !!selectedCaregiver}
            >
              {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
              <span className="ml-2">Search</span>
            </Button>
          </div>
          {(isSearching || caregiversLoading) && (
            <p className="text-sm text-muted-foreground mt-2">Loading...</p>
          )}
          {searchResults.length > 0 && (
            <ul className="mt-4 border rounded-md divide-y">
              {searchResults.map((caregiver) => {
                const createdAt = (caregiver.createdAt as any)?.toDate();
                return (
                  <li key={caregiver.id} className="p-2 hover:bg-muted">
                    <button
                      onClick={() => handleSelectCaregiver(caregiver)}
                      className="w-full text-left flex justify-between items-center"
                    >
                      <div>
                        <p className="font-semibold">{caregiver.fullName}</p>
                        <p className="text-sm text-muted-foreground">
                          {caregiver.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{caregiver.phone}</p>
                        {createdAt && <p className="text-xs text-muted-foreground">Applied: {format(createdAt, "PPp")}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedCaregiver && (
        <Card>
          <CardHeader>
            <CardTitle>Editing Profile for: {selectedCaregiver.fullName}</CardTitle>
            <CardDescription>
              Update the general information below and click save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="fullName" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="state" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                  <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <div className="flex justify-end gap-4">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
