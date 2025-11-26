
"use client";

import { useState, useTransition, ChangeEvent } from 'react';
import { processActiveCaregiverUpload } from '@/lib/active-caregivers.actions';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Label } from '@/components/ui/label';

export default function ManageCaregiverAvailabilityClient() {
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

    startUploadTransition(() => {
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target && typeof event.target.result === 'string') {
                const csvText = event.target.result;
                const uploadResult = await processActiveCaregiverUpload(csvText);

                if (uploadResult.error) {
                    toast({ title: 'Upload Failed', description: uploadResult.message, variant: 'destructive', duration: 10000 });
                } else {
                    toast({ title: 'Upload Successful', description: uploadResult.message });
                }

                if (uploadResult.caregiversFound && uploadResult.caregiversFound.length > 0) {
                    toast({
                        title: 'Caregivers Parsed from CSV',
                        description: `Found ${uploadResult.caregiversFound.length} unique names: ${uploadResult.caregiversFound.join(', ')}`,
                        duration: 15000,
                    });
                } else {
                     toast({
                        title: 'No Caregivers Found',
                        description: 'The parser did not identify any caregiver names in the uploaded file. Please check the file format.',
                        variant: 'destructive',
                    });
                }
            }
        };
        reader.readAsText(file);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Caregiver Availability</CardTitle>
          <CardDescription>
            Upload a weekly availability schedule as a CSV file. The file should have a header row with days/dates, and subsequent rows for each caregiver's schedule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="availability-file-upload">Availability CSV File</Label>
                <Input id="availability-file-upload" type="file" accept=".csv" onChange={handleFileChange} />
            </div>
            <Button onClick={handleUpload} disabled={isUploading || !file}>
              {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
              Upload Availability
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
