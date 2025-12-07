
"use client";

import { useState, useTransition, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { processActiveCaregiverUpload } from '@/lib/active-caregivers.actions';
import { useCollection, useMemoFirebase, firestore } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { ActiveCaregiver } from '@/lib/types';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageActiveCaregiversClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const { toast } = useToast();

  const caregiversRef = useMemoFirebase(() => collection(firestore, 'caregivers_active'), [firestore]);
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

    startUploadTransition(async () => {
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Active Caregiver Data</CardTitle>
          <CardDescription>
            Upload a CSV file to add or update caregiver records. This process will sync the database with your file, deactivating caregivers not present in the upload.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="caregiver-file-upload">Caregiver CSV File</Label>
                <Input id="caregiver-file-upload" type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
              Upload File
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="text-2xl font-bold tracking-tight font-headline mb-4">Current Active Caregivers</h2>
        {caregiversLoading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <p className="ml-4 text-muted-foreground">Loading caregivers...</p>
            </div>
        ) : activeCaregivers && activeCaregivers.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {activeCaregivers.filter(c => c.status === 'Active').map((caregiver) => (
                    <Card key={caregiver.id}>
                        <CardHeader>
                            <CardTitle>{caregiver.Name}</CardTitle>
                            <CardDescription>{caregiver.Email}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p><strong>D.O.B:</strong> {caregiver.dob || 'N/A'}</p>
                            <p><strong>Address:</strong> {`${caregiver.Address || ''} ${caregiver.Apt || ''}`.trim()}</p>
                            <p><strong>Location:</strong> {`${caregiver.City || ''}, ${caregiver.State || ''} ${caregiver.Zip || ''}`.trim()}</p>
                            <p><strong>Mobile:</strong> {caregiver.Mobile || 'N/A'}</p>
                            <p><strong>Hire Date:</strong> {caregiver['Hire Date'] || 'N/A'}</p>
                            <p><strong>Driver&apos;s License:</strong> {caregiver['Drivers Lic'] || 'N/A'}</p>
                            <p><strong>Caregiver License:</strong> {caregiver['Caregiver Lic'] || 'N/A'}</p>
                            <p><strong>TTid-PIN:</strong> {caregiver['TTiD-PIN'] || 'N/A'}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        ) : (
            <div className="text-center py-16 border-dashed border-2 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900">No Active Caregivers Found</h3>
                <p className="mt-1 text-sm text-muted-foreground">Upload a CSV file to add active caregivers.</p>
            </div>
        )}
      </div>
    </div>
  );
}
