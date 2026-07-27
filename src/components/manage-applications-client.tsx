
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { doc, getDoc } from "firebase/firestore";
import { useFirestore } from "@/firebase";
import type { CaregiverProfile } from "@/lib/types";
import { generalInfoSchema } from "@/lib/types";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { format } from "date-fns";
import { deleteCaregiverProfile, resetCaregiverInterview, searchCandidatesAction } from "@/lib/caregiver.actions";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Trash2, RotateCcw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type GeneralInfoFormData = z.infer<typeof generalInfoSchema>;

export default function ManageApplicationsClient() {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverProfile | null>(null);

  const [isSearching, startSearchTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isResetting, startResetTransition] = useTransition();


  const { toast } = useToast();
  const db = useFirestore();

  const form = useForm<GeneralInfoFormData>({
    resolver: zodResolver(generalInfoSchema),
  });

  const handleSearch = () => {
    if (!searchTerm.trim()) return;
    startSearchTransition(async () => {
        const response = await searchCandidatesAction({ namePrefix: searchTerm, limit: 20 });
        if (response.results) {
            setSearchResults(response.results);
        }
    });
  };

  const handleSelectCaregiver = async (candidate: any) => {
    if (!db) return;
    try {
        const docRef = doc(db, "caregiver_profiles", candidate.id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            const caregiver = { ...snapshot.data(), id: snapshot.id } as CaregiverProfile;
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
              gender: caregiver.gender,
            });
        }
    } catch (error) {
        toast({ title: "Error", description: "Failed to fetch candidate profile.", variant: "destructive" });
    }
  };

  const onSubmit = (data: GeneralInfoFormData) => {
    if (!selectedCaregiver || !db) return;
    
    startSubmitTransition(() => {
      const profileRef = doc(db, "caregiver_profiles", selectedCaregiver.id);
      const updateData = { ...data, fullNameLowercase: data.fullName.toLowerCase() };
      updateDocumentNonBlocking(profileRef, updateData);
      toast({ title: "Success", description: "Profile update initiated." });
      setSelectedCaregiver(null);
    });
  };

  const handleCancel = () => {
    setSelectedCaregiver(null);
    form.reset();
  };

  const handleDeleteProfile = () => {
    if (!selectedCaregiver) return;
    startDeleteTransition(async () => {
      const result = await deleteCaregiverProfile(selectedCaregiver.id);
      if (!result.error) { toast({ title: 'Success', description: result.message }); handleCancel(); }
    });
  };

  const handleResetInterview = () => {
    if (!selectedCaregiver) return;
    startResetTransition(async () => {
      const result = await resetCaregiverInterview(selectedCaregiver.id);
      if (!result.error) { toast({ title: 'Success', description: result.message }); handleCancel(); }
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Applicant Search</CardTitle>
          <CardDescription>Search for an applicant to edit their profile information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Enter name or phone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
            <Button onClick={handleSearch} disabled={isSearching || !searchTerm.trim()}>{isSearching ? <Loader2 className="animate-spin" /> : <Search />}<span className="ml-2">Search</span></Button>
          </div>
          {searchResults.length > 0 && (
            <ul className="mt-4 border rounded-md divide-y">
              {searchResults.map((caregiver) => (
                <li key={caregiver.id} className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center" onClick={() => handleSelectCaregiver(caregiver)}>
                  <div><p className="font-semibold">{caregiver.fullName}</p><p className="text-sm text-muted-foreground">{caregiver.email}</p></div>
                  <Badge variant="outline">{caregiver.hiringStatus || 'Applied'}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selectedCaregiver && (
        <Card>
          <CardHeader><CardTitle>Editing Profile: {selectedCaregiver.fullName}</CardTitle></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField control={form.control} name="fullName" render={({ field }) => ( <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                  <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                  <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                  <FormField control={form.control} name="gender" render={({ field }) => ( <FormItem><FormLabel>Gender</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></FormItem> )} />
                  <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                  <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>City</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                  <FormField control={form.control} name="state" render={({ field }) => ( <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                  <FormField control={form.control} name="zip" render={({ field }) => ( <FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )} />
                </div>
                 <div className="flex justify-between items-center pt-6">
                    <div className="flex gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button type="button" variant="destructive" disabled={isDeleting} size="sm"><Trash2 className="mr-2 h-4 w-4" />Delete</Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Profile?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the caregiver profile and all related records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteProfile}>Continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button type="button" variant="outline" disabled={isResetting} size="sm"><RotateCcw className="mr-2 h-4 w-4" />Reset Interview</Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset Interview?</AlertDialogTitle><AlertDialogDescription>This will delete interview records but keep the profile.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleResetInterview}>Continue</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="flex gap-4">
                        <Button type="button" variant="outline" onClick={handleCancel}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin mr-2" />}Save Changes</Button>
                    </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
