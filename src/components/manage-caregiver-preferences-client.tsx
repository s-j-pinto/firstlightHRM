"use client";

import { useState, useTransition, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { processActiveCaregiverPreferencesUpload } from '@/lib/active-caregivers.actions';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageCaregiverPreferencesClient() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, startUploadTransition] = useTransition();
  const { toast } = useToast();

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
          const requiredFields = ["Name"];
          const headers = results.meta.fields;
          if (!headers || !requiredFields.every(field => headers.includes(field))) {
            toast({
              title: 'Invalid CSV Format',
              description: `The CSV must contain at least a 'Name' column.`,
              variant: 'destructive',
            });
            return;
          }

          const uploadResult = await processActiveCaregiverPreferencesUpload(results.data as any[]);
          
          if (uploadResult.error) {
            toast({ title: 'Upload Failed', description: uploadResult.message, variant: 'destructive' });
          } else {
            toast({ title: 'Upload Successful', description: uploadResult.message });
            setFile(null);
            const fileInput = document.getElementById('preferences-file-upload') as HTMLInputElement;
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
          <CardTitle>Upload Preferences & Skills</CardTitle>
          <CardDescription>
            Upload a CSV file with caregiver preferences (e.g., works with pets, allergies). The system will match caregivers by name and update their records.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="preferences-file-upload">Preferences CSV File</Label>
                <Input id="preferences-file-upload" type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
              Upload Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
