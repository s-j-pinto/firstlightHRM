
"use client";

import { useState, useTransition, ChangeEvent, useMemo } from 'react';
import Papa from 'papaparse';
import { collection, query, where } from 'firebase/firestore';
import { firestore, useCollection, useMemoFirebase } from '@/firebase';
import { processActiveCaregiverUpload } from '@/lib/active-caregivers.actions';
import { ActiveCaregiver } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, User, Phone, Home, Mail, Calendar, KeyRound, Fingerprint, BadgeCent } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageActiveCaregiversClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const { toast } = useToast();
  const db = firestore;

  const caregiversRef = useMemoFirebase(() => {
    if (!db) return null;
    // This query will only run if the collection exists.
    return query(collection(db, "caregivers_active"), where("status", "==", "ACTIVE"));
  }, [db]);

  const { data: activeCaregivers, isLoading: caregiversLoading } = useCollection<ActiveCaregiver>(caregiversRef);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select a CSV file to upload.', variant: 'destructive' });
      return;
    }

    startUploadTransition(() => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const requiredFields = ["Email"];
          const headers = results.meta.fields;
          if (!headers || !requiredFields.every(field => headers.includes(field))) {
            toast({
              title: 'Invalid CSV Format',
              description: `The CSV must contain at least the following column: ${requiredFields.join(', ')}`,
              variant: 'destructive',
            });
            return;
          }

          const uploadResult = await processActiveCaregiverUpload(results.data as any[]);
          
          if (uploadResult.error) {
            toast({ title: 'Upload Failed', description: uploadResult.message, variant: 'destructive' });
          } else {
            toast({ title: 'Upload Successful', description: uploadResult.message });
            setFile(null);
            const fileInput = document.getElementById('caregiver-file-upload') as HTMLInputElement;
            if(fileInput) fileInput.value = '';
          }
        },
        error: (error) => {
          toast({ title: 'Parsing Error', description: `Error parsing CSV file: ${error.message}`, variant: 'destructive' });
        }
      });
    });
  };

  const caregiversToDisplay = activeCaregivers ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Active Caregiver Data</CardTitle>
          <CardDescription>
            Upload a CSV file with caregiver information. The "Email" column is required as a unique identifier.
            Existing caregivers will be updated, new ones will be added, and any caregivers not in the file will be marked as INACTIVE.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="caregiver-file-upload">Caregiver CSV File</Label>
                <Input id="caregiver-file-upload" type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? <Loader2 className="animate-spin" /> : <Upload />}
              <span className="ml-2">Upload File</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Active Caregivers</CardTitle>
          <CardDescription>List of all currently active caregivers in the system.</CardDescription>
        </CardHeader>
        <CardContent>
            {caregiversLoading ? (
                <div className="flex justify-center items-center h-48">
                    <Loader2 className="h-8 w-8 animate-spin text-accent" />
                    <p className="ml-4 text-muted-foreground">Loading caregivers...</p>
                </div>
            ) : caregiversToDisplay.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {caregiversToDisplay.map(cg => (
                        <Card key={cg.id} className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center text-xl">
                                    <User className="mr-2 h-5 w-5 text-accent"/> {cg.Name}
                                </CardTitle>
                                <CardDescription>{cg['D.O.B.'] ? `DOB: ${cg['D.O.B.']}` : ''}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="flex items-start"><Home className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> {cg.Address}{cg['Apt'] ? `, ${cg['Apt']}` : ''}, {cg.City}, {cg.State} {cg.Zip}</p>
                                <p className="flex items-start"><Phone className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> {cg.Mobile}</p>
                                <p className="flex items-start"><Mail className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> {cg.Email}</p>
                                <p className="flex items-start"><Calendar className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> Hire Date: {cg['Hire Date']}</p>
                                <p className="flex items-start"><Fingerprint className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> Drivers Lic: {cg['Drivers Lic']}</p>
                                <p className="flex items-start"><BadgeCent className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> Caregiver Lic: {cg['Caregiver Lic']}</p>
                                <p className="flex items-start"><KeyRound className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground"/> PIN: {cg.PIN}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <p className="text-center text-muted-foreground py-8">No active caregivers found. Upload a CSV file to get started.</p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
