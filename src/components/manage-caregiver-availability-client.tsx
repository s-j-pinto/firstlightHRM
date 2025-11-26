
"use client";

import { useState, useTransition, ChangeEvent, ReactNode } from 'react';
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
                    toast({ title: 'Upload Finished', description: uploadResult.message, duration: 10000 });
                }
                
                if (uploadResult.debugPreview && uploadResult.debugPreview.length > 0) {
                     const description: ReactNode = (
                        <div className="text-xs space-y-2 mt-2">
                            <p>Here's a sample of the data parsed from your CSV:</p>
                            <ul className="list-disc pl-4 bg-muted p-2 rounded-md">
                                {uploadResult.debugPreview.map(item => (
                                    <li key={item.name}>
                                        <strong>{item.name}:</strong>
                                        <ul className="list-disc pl-5">
                                            {item.data.map((slot, index) => <li key={index}>{slot}</li>)}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );

                    toast({
                        title: `Found ${uploadResult.debugPreview.length} caregivers to process.`,
                        description: description,
                        duration: 20000,
                    });
                } else if (!uploadResult.error) {
                     toast({
                        title: 'No Availability Data Found',
                        description: 'The parser did not find any valid "Scheduled Availability" data to process. Please check the file format.',
                        variant: 'destructive',
                        duration: 10000
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
