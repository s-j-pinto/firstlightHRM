
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

        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
            toast({ title: 'Invalid CSV', description: 'The CSV must have at least two header rows.', variant: 'destructive' });
            return;
        }
        
        const daysHeader = lines[0].split(',').map(h => h.trim());
        const datesHeader = lines[1].split(',').map(h => h.trim());

        const combinedHeader = daysHeader.map((day, index) => {
            // Only include pairs where the day exists
            if (day) {
                return `${day} (${datesHeader[index] || ''})`;
            }
            return null;
        }).filter(Boolean).join(' | ');


        toast({
            title: 'CSV Header Read',
            description: `Combined Header: ${combinedHeader}`,
            duration: 8000,
        });
        
        // Temporarily disabled full upload for debugging header
        /*
        startUploadTransition(async () => {
            const uploadResult = await processCaregiverAvailabilityUpload(text);
            
            if (uploadResult.error) {
                toast({ title: 'Upload Failed', description: uploadResult.message, variant: 'destructive' });
            } else {
                toast({ title: 'Upload Successful', description: uploadResult.message });
                setFile(null);
                const fileInput = document.getElementById('availability-file-upload') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
            }
        });
        */
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Caregiver Availability</CardTitle>
          <CardDescription>
            Upload a weekly availability schedule as a CSV file. The first column should be "Caregiver Name", followed by columns for each day of the week ("Monday", "Tuesday", etc.). The cells should contain "Available" followed by time slots (e.g., "Available 9am-5pm").
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
