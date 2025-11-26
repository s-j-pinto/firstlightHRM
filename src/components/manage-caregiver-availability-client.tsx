
"use client";

import { useState, useTransition, ChangeEvent } from 'react';
import { processCaregiverAvailabilityUpload } from '@/lib/active-caregivers.actions';

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

    const reader = new FileReader();
    reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) {
            toast({ title: 'File Error', description: 'Could not read the selected file.', variant: 'destructive' });
            return;
        }

        startUploadTransition(async () => {
          const result = await processCaregiverAvailabilityUpload(text);
          if (result.error) {
            toast({ title: 'Upload Failed', description: result.message, variant: 'destructive' });
          } else {
            toast({ title: 'Upload Successful', description: result.message });
          }
        });
    };
    reader.onerror = () => {
        toast({ title: 'File Read Error', description: 'There was an error reading the file.', variant: 'destructive' });
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Caregiver Availability</CardTitle>
          <CardDescription>
            Upload a weekly availability schedule as a CSV file. The file should have two header rows (Day, then Date), followed by pairs of rows for each caregiver (Name, then Availability).
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
